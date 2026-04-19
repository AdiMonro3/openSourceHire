"""Personalized issue feed for the signed-in user."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.agents.scout import rank_issues_for_user
from app.deps import get_current_user, get_db
from app.models import SkillProfileRow, User

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("")
async def get_feed(
    limit: int = Query(10, ge=1, le=25),
    prefilter: int = Query(50, ge=10, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if db.get(SkillProfileRow, user.id) is None:
        raise HTTPException(
            status_code=409,
            detail="No skill profile yet. POST /users/me/profile/refresh first.",
        )
    ranked = await rank_issues_for_user(db, user.id, k=limit, prefilter=prefilter)
    return {"items": ranked, "count": len(ranked)}
