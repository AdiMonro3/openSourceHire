from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.skill_graph import build_skill_profile
from app.deps import get_current_user, get_db
from app.integrations.github import fetch_viewer_portfolio
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
        if not embedding:
            raise HTTPException(
                status_code=503,
                detail="Embedding service is rate-limited. Try again in a minute.",
            )
        row = SkillProfileRow(user_id=user.id, profile=profile, embedding=embedding)
        db.add(row)
    else:
        row.profile = profile
        if embedding:
            row.embedding = embedding
    db.commit()
    return profile


@router.get("/me/portfolio")
async def get_portfolio(user: User = Depends(get_current_user)) -> dict:
    """Merged-PR list, contribution heatmap, and headline stats from GitHub."""
    viewer = await fetch_viewer_portfolio(user.access_token, pr_count=30)

    pr_nodes = ((viewer.get("pullRequests") or {}).get("nodes") or [])
    merged_prs = []
    additions_total = 0
    deletions_total = 0
    repo_set: set[str] = set()
    for pr in pr_nodes:
        repo = pr.get("repository") or {}
        repo_name = repo.get("nameWithOwner")
        if not repo_name:
            continue
        repo_set.add(repo_name)
        additions_total += int(pr.get("additions") or 0)
        deletions_total += int(pr.get("deletions") or 0)
        merged_prs.append(
            {
                "title": pr.get("title"),
                "url": pr.get("url"),
                "merged_at": pr.get("mergedAt"),
                "additions": pr.get("additions") or 0,
                "deletions": pr.get("deletions") or 0,
                "changed_files": pr.get("changedFiles") or 0,
                "repo": {
                    "name": repo_name,
                    "stars": repo.get("stargazerCount") or 0,
                    "language": (repo.get("primaryLanguage") or {}).get("name"),
                },
            }
        )

    calendar = (
        ((viewer.get("contributionsCollection") or {}).get("contributionCalendar"))
        or {}
    )
    weeks = []
    for week in calendar.get("weeks") or []:
        weeks.append(
            [
                {
                    "date": d.get("date"),
                    "count": d.get("contributionCount") or 0,
                }
                for d in (week.get("contributionDays") or [])
            ]
        )

    return {
        "user": {
            "login": viewer.get("login"),
            "name": viewer.get("name"),
            "bio": viewer.get("bio"),
            "location": viewer.get("location"),
            "avatar_url": viewer.get("avatarUrl"),
            "followers": (viewer.get("followers") or {}).get("totalCount") or 0,
            "repos": (viewer.get("repositories") or {}).get("totalCount") or 0,
        },
        "stats": {
            "merged_prs": (viewer.get("pullRequests") or {}).get("totalCount") or 0,
            "lines_added": additions_total,
            "lines_removed": deletions_total,
            "active_repos": len(repo_set),
        },
        "contributions": {
            "total": calendar.get("totalContributions") or 0,
            "weeks": weeks,
        },
        "merged_prs": merged_prs,
    }
