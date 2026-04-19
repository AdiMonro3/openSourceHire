from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.skill_graph import build_skill_profile
from app.deps import get_current_user, get_db
from app.models import SkillProfileRow, User
from app.services.embeddings import embed_text

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict:
    return {
        "id": user.id,
        "github_login": user.github_login,
        "name": user.name,
        "email": user.email,
        "avatar_url": user.avatar_url,
    }


@router.get("/me/profile")
def get_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(SkillProfileRow, user.id)
    if row is None:
        raise HTTPException(404, "No profile yet — POST /users/me/profile/refresh")
    return row.profile


@router.post("/me/profile/refresh")
async def refresh_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    profile = await build_skill_profile(user.access_token)
    embedding = await embed_text(
        profile.get("summary", "") + " " + " ".join(profile.get("interests", [])),
        input_type="query",
    )

    row = db.get(SkillProfileRow, user.id)
    if row is None:
        row = SkillProfileRow(user_id=user.id, profile=profile, embedding=embedding)
        db.add(row)
    else:
        row.profile = profile
        row.embedding = embedding
    db.commit()
    return profile
