"""Public-profile router (P2.1).

Two surfaces:
  * POST /users/me/portfolio/publish — authenticated; fetches live GitHub data,
    runs the Portfolio Builder agent, and caches both raw snapshot + narrative
    into the `portfolios` table. Every public page view reads from that row,
    so there is exactly one Claude call per publish (not per view).
  * GET /users/{username}/public — unauthenticated; returns the cached payload
    plus approved testimonials. 404 if the user hasn't published yet.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.portfolio_builder import build_portfolio_narrative
from app.deps import get_current_user, get_db
from app.integrations.github import fetch_viewer_portfolio
from app.models import PortfolioRow, SkillProfileRow, Testimonial, User

router = APIRouter(tags=["portfolio"])


def _assemble_raw_portfolio(viewer: dict) -> dict:
    """Shape the raw GraphQL viewer payload like /users/me/portfolio does.

    Duplicated here (instead of calling the existing endpoint) because we
    already have the viewer blob in hand and don't want a second HTTP hop.
    """
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
    weeks = [
        [
            {"date": d.get("date"), "count": d.get("contributionCount") or 0}
            for d in (w.get("contributionDays") or [])
        ]
        for w in (calendar.get("weeks") or [])
    ]

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


@router.post("/users/me/portfolio/publish")
async def publish_portfolio(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    viewer = await fetch_viewer_portfolio(user.access_token, pr_count=30)
    raw = _assemble_raw_portfolio(viewer)

    skill_row = db.get(SkillProfileRow, user.id)
    skill_profile = skill_row.profile if skill_row else None

    narrative = await build_portfolio_narrative(
        raw, skill_profile, user_id=user.id
    )

    payload = {
        "narrative": narrative,
        "portfolio": raw,
        "skill_profile": skill_profile,
    }

    row = db.get(PortfolioRow, user.id)
    if row is None:
        row = PortfolioRow(user_id=user.id, narrative=payload)
        db.add(row)
    else:
        row.narrative = payload
    db.commit()
    db.refresh(row)

    return {
        **payload,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
        "published": True,
    }


@router.get("/users/{username}/public")
def public_profile(username: str, db: Session = Depends(get_db)) -> dict:
    target = (
        db.query(User).filter(User.github_login.ilike(username)).one_or_none()
    )
    if target is None:
        raise HTTPException(404, "User not found")

    row = db.get(PortfolioRow, target.id)
    if row is None:
        raise HTTPException(404, "Portfolio not published yet")

    testimonials = (
        db.query(Testimonial)
        .filter(Testimonial.to_user_id == target.id, Testimonial.approved.is_(True))
        .order_by(Testimonial.created_at.desc())
        .all()
    )
    testimonials_out = [
        {
            "id": t.id,
            "from_name": t.from_name,
            "from_role": t.from_role,
            "body": t.body,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in testimonials
    ]

    payload = row.narrative or {}
    return {
        "user": {
            "github_login": target.github_login,
            "name": target.name,
            "avatar_url": target.avatar_url,
        },
        "narrative": payload.get("narrative") or {},
        "portfolio": payload.get("portfolio") or {},
        "skill_profile": payload.get("skill_profile"),
        "testimonials": testimonials_out,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
    }
