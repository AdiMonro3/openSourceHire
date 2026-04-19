"""Admin-only endpoints.

Gated behind the current signed-in user's session. For MVP this is any
authenticated user; later we'll restrict to an allowlist.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import User
from app.services.ingestion import ingest_repo, ingest_seed_repos, load_seed_repos

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/ingest")
async def trigger_ingest(
    limit: int = Query(30, ge=1, le=100),
    repos: int | None = Query(None, ge=1, description="Cap # of seed repos"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Run ingestion using the signed-in user's GitHub token.

    Dev convenience — in production a cron worker should call
    `python -m app.scripts.ingest` with a service PAT instead.
    """
    if repos is None:
        return await ingest_seed_repos(db, user.access_token, per_repo_limit=limit)

    seed = load_seed_repos()[:repos]
    stats: dict = {
        "repos_scanned": 0,
        "repos_with_issues": 0,
        "issues_indexed": 0,
        "errors": [],
    }
    for name in seed:
        try:
            r = await ingest_repo(
                db, user.access_token, name, is_curated=True, limit=limit
            )
            stats["repos_scanned"] += 1
            if r["issues_indexed"] > 0:
                stats["repos_with_issues"] += 1
            stats["issues_indexed"] += r["issues_indexed"]
        except Exception as exc:
            stats["errors"].append({"repo": name, "error": str(exc)})
    return stats
