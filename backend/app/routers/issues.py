"""Issue detail endpoints (P0.6)."""
from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.agents.issue_understanding import understand_issue
from app.agents.pr_coach import coach_pr
from app.deps import get_current_user, get_db
from app.models import Issue, Repo, User
from app.services.cache import cache_key, get_json, set_json

router = APIRouter(prefix="/issues", tags=["issues"])

UNDERSTAND_TTL = 60 * 60  # 1h — repo context is cached longer; this just
# avoids re-calling the LLM when a user refreshes the page.
COACH_TTL = 60 * 30  # 30m — short, since the same user iterates on drafts.


class CoachRequest(BaseModel):
    draft: str = Field(min_length=1, max_length=8000)


@router.get("/by-url")
def get_issue_by_url(
    url: str,
    user: User = Depends(get_current_user),  # noqa: ARG001
    db: Session = Depends(get_db),
) -> dict:
    """Resolve a GitHub issue URL to the local row.

    Used by the `osh` CLI, which only knows the user-facing URL. We trim a
    trailing slash and match case-insensitively since GitHub URLs are.
    """
    normalized = url.strip().rstrip("/").lower()
    issue = (
        db.query(Issue).filter(func.lower(Issue.url) == normalized).one_or_none()
    )
    if issue is None:
        raise HTTPException(404, "Issue not in index — try viewing it in the web app first")
    return {"id": issue.id, "number": issue.number, "title": issue.title, "url": issue.url}


@router.get("/{issue_id}")
def get_issue(
    issue_id: int,
    user: User = Depends(get_current_user),  # noqa: ARG001
    db: Session = Depends(get_db),
) -> dict:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "Issue not found")
    repo = db.get(Repo, issue.repo_id)
    return {
        "id": issue.id,
        "number": issue.number,
        "title": issue.title,
        "body": issue.body,
        "url": issue.url,
        "state": issue.state,
        "labels": issue.labels,
        "comments": issue.comments_count,
        "bounty_usd": issue.bounty_amount_usd,
        "repo": {
            "name": repo.name_with_owner if repo else "",
            "description": repo.description if repo else None,
            "stars": repo.stargazers_count if repo else 0,
            "language": repo.primary_language if repo else None,
            "topics": repo.topics if repo else [],
            "is_curated": repo.is_curated if repo else False,
        },
    }


@router.get("/{issue_id}/understand")
async def understand(
    issue_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    key = cache_key("understand:v1", issue_id)
    cached = await get_json(key)
    if cached is not None:
        return cached

    try:
        result = await understand_issue(db, issue_id, user.access_token)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc

    await set_json(key, result, UNDERSTAND_TTL)
    return result


@router.post("/{issue_id}/pr-coach")
async def pr_coach(
    issue_id: int,
    payload: CoachRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    draft_hash = hashlib.sha256(payload.draft.strip().encode()).hexdigest()[:16]
    key = cache_key("pr-coach:v1", {"issue": issue_id, "draft": draft_hash})
    cached = await get_json(key)
    if cached is not None:
        return cached

    try:
        result = await coach_pr(db, issue_id, user.access_token, payload.draft)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    await set_json(key, result, COACH_TTL)
    return result
