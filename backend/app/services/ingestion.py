"""Issue ingestion pipeline.

Walks the curated seed list (and later: dynamically discovered repos),
fetches open `good-first-issue` / `help-wanted` issues via GraphQL,
embeds title+body, and upserts into `repos` / `issues` keyed on the
GitHub GraphQL node id (the canonical unique id — safe dedupe across runs).
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.integrations.github import fetch_repo_beginner_issues, fetch_repo_readme
from app.models import Issue, Repo
from app.services.embeddings import embed_texts
from app.services.policy import detect_anti_ai, is_blocklisted

logger = logging.getLogger(__name__)

SEED_PATH = Path(__file__).resolve().parents[2] / "data" / "seed_repos.txt"

MAX_EMBED_CHARS = 8000


def load_seed_repos(path: Path = SEED_PATH) -> list[str]:
    out: list[str] = []
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    return out


def reputation_score(stars: int, is_curated: bool) -> float:
    base = math.log10(max(stars, 0) + 1) * 10
    if is_curated:
        base += 15
    return round(base, 2)


def _upsert_repo(
    db: Session,
    repo_node: dict[str, Any],
    is_curated: bool,
    is_anti_ai: bool = False,
) -> Repo:
    stars = repo_node.get("stargazerCount", 0) or 0
    topics = [
        t["topic"]["name"]
        for t in (repo_node.get("repositoryTopics") or {}).get("nodes", [])
    ]
    primary_language = (repo_node.get("primaryLanguage") or {}).get("name")

    values = {
        "github_node_id": repo_node["id"],
        "name_with_owner": repo_node["nameWithOwner"],
        "description": repo_node.get("description"),
        "primary_language": primary_language,
        "stargazers_count": stars,
        "forks_count": repo_node.get("forkCount", 0) or 0,
        "topics": topics,
        "reputation_score": reputation_score(stars, is_curated),
        "is_curated": is_curated,
        "is_anti_ai": is_anti_ai,
        "last_scanned_at": datetime.now(timezone.utc),
    }
    stmt = pg_insert(Repo).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Repo.github_node_id],
        set_={
            "name_with_owner": stmt.excluded.name_with_owner,
            "description": stmt.excluded.description,
            "primary_language": stmt.excluded.primary_language,
            "stargazers_count": stmt.excluded.stargazers_count,
            "forks_count": stmt.excluded.forks_count,
            "topics": stmt.excluded.topics,
            "reputation_score": stmt.excluded.reputation_score,
            "is_curated": stmt.excluded.is_curated,
            "is_anti_ai": stmt.excluded.is_anti_ai,
            "last_scanned_at": stmt.excluded.last_scanned_at,
        },
    ).returning(Repo.id)
    repo_id = db.execute(stmt).scalar_one()
    return db.get(Repo, repo_id)


def _issue_embed_input(node: dict[str, Any]) -> str:
    title = node["title"]
    body = node.get("body") or ""
    return f"{title}\n\n{body}".strip()[:MAX_EMBED_CHARS]


def _upsert_issue(
    db: Session, repo_id: int, node: dict[str, Any], embedding: list[float]
) -> None:
    labels = [lb["name"] for lb in (node.get("labels") or {}).get("nodes", [])]
    lowered = [lb.lower() for lb in labels]
    is_gfi = any("good first" in lb for lb in lowered)
    is_hw = any("help wanted" in lb for lb in lowered)

    title = node["title"]
    body = node.get("body") or ""

    values = {
        "github_node_id": node["id"],
        "repo_id": repo_id,
        "number": node["number"],
        "title": title,
        "body": body,
        "url": node["url"],
        "state": node["state"],
        "labels": labels,
        "comments_count": (node.get("comments") or {}).get("totalCount", 0) or 0,
        "is_good_first_issue": is_gfi,
        "is_help_wanted": is_hw,
        "github_created_at": node["createdAt"],
        "github_updated_at": node["updatedAt"],
        "embedding": embedding,
    }
    stmt = pg_insert(Issue).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Issue.github_node_id],
        set_={
            "title": stmt.excluded.title,
            "body": stmt.excluded.body,
            "state": stmt.excluded.state,
            "labels": stmt.excluded.labels,
            "comments_count": stmt.excluded.comments_count,
            "is_good_first_issue": stmt.excluded.is_good_first_issue,
            "is_help_wanted": stmt.excluded.is_help_wanted,
            "github_updated_at": stmt.excluded.github_updated_at,
            "embedding": stmt.excluded.embedding,
        },
    )
    db.execute(stmt)


async def _check_anti_ai(token: str, name_with_owner: str) -> bool:
    if is_blocklisted(name_with_owner):
        return True
    try:
        readme = await fetch_repo_readme(token, name_with_owner)
    except Exception:
        # README fetch is best-effort. If it fails we fall back to the
        # blocklist check only — better to under-block than fail ingestion.
        logger.exception("README fetch failed for %s", name_with_owner)
        readme = None
    return detect_anti_ai(name_with_owner, readme)


async def ingest_repo(
    db: Session,
    token: str,
    name_with_owner: str,
    is_curated: bool = False,
    limit: int = 30,
) -> dict[str, Any]:
    search = await fetch_repo_beginner_issues(token, name_with_owner, limit=limit)
    nodes = search.get("nodes") or []
    if not nodes:
        return {
            "repo": name_with_owner,
            "issues_indexed": 0,
            "total_count": search.get("issueCount", 0) or 0,
        }

    anti_ai = await _check_anti_ai(token, name_with_owner)
    repo = _upsert_repo(db, nodes[0]["repository"], is_curated, is_anti_ai=anti_ai)
    embed_inputs = [_issue_embed_input(n) for n in nodes]
    embeddings = await embed_texts(embed_inputs, input_type="document")
    for node, emb in zip(nodes, embeddings, strict=True):
        _upsert_issue(db, repo.id, node, emb)
    db.commit()

    return {
        "repo": name_with_owner,
        "issues_indexed": len(nodes),
        "total_count": search.get("issueCount", 0) or 0,
        "is_anti_ai": anti_ai,
    }


async def ingest_seed_repos(
    db: Session, token: str, per_repo_limit: int = 30
) -> dict[str, Any]:
    seed = load_seed_repos()
    stats: dict[str, Any] = {
        "repos_scanned": 0,
        "repos_with_issues": 0,
        "issues_indexed": 0,
        "errors": [],
    }
    for name in seed:
        try:
            r = await ingest_repo(
                db, token, name, is_curated=True, limit=per_repo_limit
            )
            stats["repos_scanned"] += 1
            if r["issues_indexed"] > 0:
                stats["repos_with_issues"] += 1
            stats["issues_indexed"] += r["issues_indexed"]
        except Exception as exc:
            logger.exception("Ingest failed for %s", name)
            stats["errors"].append({"repo": name, "error": str(exc)})
    return stats
