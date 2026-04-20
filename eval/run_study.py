"""End-to-end eval runner.

Reads `ground_truth.jsonl`, replays each user through Scout, computes
precision@k against the labeled issues, and writes the run + per-user
predictions into the same SQLite file the agent audit log uses.

Usage (from repo root)::

    uv run --project backend python eval/run_study.py
    uv run --project backend python eval/run_study.py --k 5 --name "scout-v1"

Optional PR-message style eval::

    uv run --project backend python eval/run_study.py \\
        --pr-style-file eval/pr_style_pairs.jsonl

`pr_style_pairs.jsonl` rows: {"candidate": "...", "reference": "..."}.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from eval import store as eval_store  # noqa: E402
from eval.metrics import bleu, cosine_similarity, mean, precision_at_k  # noqa: E402


def _load_ground_truth(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        if row.get("_comment"):
            continue
        if not row.get("github_login"):
            continue
        rows.append(row)
    return rows


async def _score_user(
    db,
    user_login: str,
    expected_issues: list[str],
    k: int,
) -> dict[str, Any]:
    from app.agents.scout import rank_issues_for_user
    from app.models import User

    user = db.query(User).filter_by(github_login=user_login).one_or_none()
    if user is None:
        return {
            "login": user_login,
            "skipped": "user not in db (run /users/me/profile/refresh first)",
            "predictions": [],
            "precision_at_k": None,
        }

    rankings = await rank_issues_for_user(db, user.id, k=k)
    predicted_urls = [r["url"] for r in rankings]
    p_at_k = precision_at_k(predicted_urls, expected_issues, k) if expected_issues else None
    return {
        "login": user_login,
        "user_id": user.id,
        "predictions": [
            {
                "rank": i + 1,
                "url": r["url"],
                "score": r.get("score"),
                "is_match": r["url"] in set(expected_issues) if expected_issues else None,
            }
            for i, r in enumerate(rankings)
        ],
        "precision_at_k": p_at_k,
    }


def _pr_style_metrics(path: Path) -> dict[str, float]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    if not rows:
        return {}

    bleus = [bleu(r["candidate"], r["reference"]) for r in rows]
    out = {"pr_style_bleu_mean": mean(bleus), "pr_style_pairs": float(len(rows))}

    refs_with_emb = [r for r in rows if r.get("candidate_embedding") and r.get("reference_embedding")]
    if refs_with_emb:
        sims = [
            cosine_similarity(r["candidate_embedding"], r["reference_embedding"])
            for r in refs_with_emb
        ]
        out["pr_style_embed_sim_mean"] = mean(sims)
    return out


def _agent_call_summary(since_ts: float) -> dict[str, Any]:
    with eval_store.connect() as con:
        cur = con.execute(
            """
            SELECT agent,
                   COUNT(*)            AS n,
                   AVG(latency_ms)     AS avg_latency_ms,
                   SUM(input_tokens)   AS input_tokens,
                   SUM(output_tokens)  AS output_tokens,
                   SUM(cache_read)     AS cache_read,
                   SUM(error IS NOT NULL) AS errors
            FROM agent_calls
            WHERE ts >= ?
            GROUP BY agent
            """,
            (since_ts,),
        )
        return {row["agent"]: dict(row) for row in cur.fetchall()}


async def _amain() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--ground-truth",
        type=Path,
        default=REPO_ROOT / "eval" / "ground_truth.jsonl",
    )
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--name", type=str, default="scout")
    parser.add_argument(
        "--pr-style-file",
        type=Path,
        default=None,
        help="Optional JSONL of {candidate, reference} pairs for BLEU/cosine.",
    )
    args = parser.parse_args()

    from app.db.session import SessionLocal

    rows = _load_ground_truth(args.ground_truth)
    if not rows:
        print(f"No ground-truth rows in {args.ground_truth}", file=sys.stderr)
        return 1

    started = time.time()
    run_id = eval_store.start_run(
        args.name,
        config={"k": args.k, "n_users": len(rows), "ground_truth": str(args.ground_truth)},
    )
    print(f"# study run id={run_id}  users={len(rows)}  k={args.k}")

    db = SessionLocal()
    try:
        per_user: list[dict[str, Any]] = []
        for row in rows:
            res = await _score_user(db, row["github_login"], row.get("expected_issues") or [], args.k)
            per_user.append(res)
            if res.get("skipped"):
                print(f"  - {res['login']}: SKIP ({res['skipped']})")
                continue
            for pred in res["predictions"]:
                eval_store.add_prediction(
                    run_id,
                    res["login"],
                    pred["rank"],
                    pred["url"],
                    pred["score"],
                    pred["is_match"],
                )
            tag = "" if res["precision_at_k"] is None else f"  p@{args.k}={res['precision_at_k']:.2f}"
            print(f"  - {res['login']}: {len(res['predictions'])} predictions{tag}")
    finally:
        db.close()

    scored = [r["precision_at_k"] for r in per_user if r["precision_at_k"] is not None]
    metrics: dict[str, Any] = {
        f"precision_at_{args.k}_mean": mean(scored) if scored else None,
        "users_scored": len(scored),
        "users_skipped": sum(1 for r in per_user if r.get("skipped")),
    }

    if args.pr_style_file and args.pr_style_file.exists():
        metrics.update(_pr_style_metrics(args.pr_style_file))

    metrics["agent_calls"] = _agent_call_summary(started)
    eval_store.finish_run(run_id, metrics)

    print("\n# metrics")
    print(json.dumps(metrics, indent=2, default=str))
    return 0


def main() -> int:
    return asyncio.run(_amain())


if __name__ == "__main__":
    raise SystemExit(main())
