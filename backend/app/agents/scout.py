"""Issue Scout Agent (P0.5).

Two-stage retrieval:

  1. pgvector cosine similarity between user skill embedding and open
     issue embeddings → top ~50 candidates (cheap).
  2. Claude Haiku 4.5 rerank with an explicit rubric
     (skill_fit 50% × repo_reputation 25% × approachability 20% × bounty 5%)
     and a short "why this matches" rationale (expensive but small).

Haiku is used (not Sonnet) because ranking is a narrow, high-volume task
where latency & cost matter and the rubric keeps calibration tight.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import call_claude, cached_text_block, parse_json
from app.models import Issue, Repo, SkillProfileRow

SCOUT_SYSTEM = """You are an open-source issue scout for a junior / early-career developer.

Rank candidate issues by a weighted rubric:
  - Skill fit (user's strongest languages/frameworks ↔ repo language/topics) — 50%
  - Repo reputation (is_curated = True and higher stars boost resume signal) — 25%
  - Approachability (good-first-issue label, clear scope, not too many stale comments) — 20%
  - Bounty in USD (small bonus — never rank a bad-fit issue above a good-fit one for money) — 5%

Penalize:
  - Issues that need deep domain knowledge the user clearly lacks.
  - Issues open for many months with heavy comment activity (likely stuck / contentious).
  - Issues whose scope is vague ("refactor X subsystem" with no direction).

Output ONLY valid JSON — no commentary, no fences needed — in this shape:
{
  "rankings": [
    { "issue_id": <int>, "score": <0-100>, "reason": "<<=14 words>" }
  ]
}

Return rankings in descending score order. Include only the issues you would actually recommend.
"""


def _serialize_candidate(issue: Issue, repo: Repo) -> dict[str, Any]:
    return {
        "id": issue.id,
        "title": issue.title,
        "body_preview": (issue.body or "")[:400],
        "url": issue.url,
        "labels": issue.labels,
        "comments": issue.comments_count,
        "bounty_usd": issue.bounty_amount_usd,
        "github_created_at": issue.github_created_at.isoformat()
        if issue.github_created_at
        else None,
        "repo": {
            "name": repo.name_with_owner,
            "stars": repo.stargazers_count,
            "language": repo.primary_language,
            "topics": repo.topics,
            "reputation": repo.reputation_score,
            "is_curated": repo.is_curated,
        },
    }


async def rank_issues_for_user(
    db: Session,
    user_id: int,
    k: int = 10,
    prefilter: int = 50,
) -> list[dict[str, Any]]:
    skill = db.get(SkillProfileRow, user_id)
    if skill is None:
        return []

    stmt = (
        select(Issue, Repo)
        .join(Repo, Issue.repo_id == Repo.id)
        .where(Issue.state == "OPEN")
        .where(Repo.is_anti_ai.is_(False))
        .order_by(Issue.embedding.cosine_distance(skill.embedding))
        .limit(prefilter)
    )
    rows = db.execute(stmt).all()
    if not rows:
        return []

    candidates = [_serialize_candidate(issue, repo) for issue, repo in rows]
    id_to_candidate = {c["id"]: c for c in candidates}

    user_msg = (
        "User skill profile:\n```json\n"
        + json.dumps(skill.profile, indent=2)
        + "\n```\n\n"
        + f"Candidate issues (top {len(candidates)} by embedding similarity):\n```json\n"
        + json.dumps(candidates, indent=2)
        + "\n```\n\n"
        + f"Return the top {k} issues."
    )

    raw = await call_claude(
        system=[cached_text_block(SCOUT_SYSTEM)],
        messages=[{"role": "user", "content": user_msg}],
        tier="haiku",
        max_tokens=1500,
        temperature=0.2,
        agent="scout",
        user_id=user_id,
        metadata={"k": k, "prefilter": prefilter, "candidates": len(candidates)},
    )
    parsed = parse_json(raw)
    rankings = parsed.get("rankings", []) if isinstance(parsed, dict) else []

    results: list[dict[str, Any]] = []
    for r in rankings[:k]:
        issue_id = r.get("issue_id")
        c = id_to_candidate.get(issue_id)
        if c is None:
            continue
        results.append(
            {
                **c,
                "score": r.get("score"),
                "reason": r.get("reason", ""),
            }
        )
    return results
