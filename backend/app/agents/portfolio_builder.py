"""Portfolio Builder Agent (P2.1).

Turns a contributor's raw GitHub portfolio + skill profile into a
recruiter-readable narrative: a headline, a short summary, strengths, and
per-PR impact blurbs explaining *why* each merged PR mattered.

The tone/instruction block is cached since it never changes. Fact data is
small (already aggregated by /users/me/portfolio) so we send it directly.
Output is cached in the `portfolios` table — one Claude call per publish,
not per page view.
"""
from __future__ import annotations

import json
from typing import Any

from app.agents.base import call_claude, cached_text_block, parse_json

PORTFOLIO_SYSTEM = """You are a technical recruiter's editor. You turn raw
open-source contribution data into a concise, credible profile page that a
hiring manager can skim in 30 seconds.

You are given:
  - The contributor's skill profile (languages, interests, summary).
  - Headline stats (merged PRs, lines added/removed, active repos).
  - Up to 10 merged pull requests (title, repo, stars, additions, deletions).

Produce a JSON object with this schema:
{
  "headline": "<one line, <=90 chars, framed as what they do+where>",
  "summary": "<2-3 sentences, neutral third-person, evidence-backed>",
  "strengths": [
    { "label": "<short, e.g. 'Systems Python'>", "evidence": "<1 sentence>" }
  ],
  "highlights": [
    {
      "pr_url": "<exact URL from input>",
      "impact": "<1 sentence — what the PR changed>",
      "why_it_matters": "<1 sentence — why a hiring manager should care>"
    }
  ],
  "recommended_next_steps": ["<actionable suggestion>", ...]
}

Rules:
  - Be calibrated. Do not inflate ("world-class", "expert") unless the
    evidence (repo stars, PR scale, maintainer status) clearly supports it.
  - 3-6 strengths. Each must map to concrete evidence from the input.
  - 3-5 highlights. Pick the PRs with the most signal (high-star repo,
    substantial diff, cross-cutting changes). Echo `pr_url` verbatim.
  - 2-4 next_steps: concrete repos/issue types that would extend the
    strongest existing threads. Do not suggest unrelated tech.
  - If data is thin (e.g. 0-2 merged PRs), say so honestly in `summary`
    and keep highlights to what exists. Do not fabricate.
  - Output ONLY valid JSON. No markdown, no commentary.
"""

MAX_HIGHLIGHTS_IN = 10


def _pick_highlight_prs(merged_prs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rank merged PRs by a rough signal score and keep the top N for the LLM."""
    def score(pr: dict[str, Any]) -> int:
        repo = pr.get("repo") or {}
        stars = int(repo.get("stars") or 0)
        diff = int(pr.get("additions") or 0) + int(pr.get("deletions") or 0)
        files = int(pr.get("changed_files") or 0)
        return stars * 10 + diff + files * 5

    return sorted(merged_prs, key=score, reverse=True)[:MAX_HIGHLIGHTS_IN]


def _build_fact_sheet(
    portfolio: dict[str, Any],
    skill_profile: dict[str, Any] | None,
) -> dict[str, Any]:
    user = portfolio.get("user") or {}
    stats = portfolio.get("stats") or {}
    prs = _pick_highlight_prs(portfolio.get("merged_prs") or [])
    compact_prs = [
        {
            "title": pr.get("title"),
            "url": pr.get("url"),
            "merged_at": pr.get("merged_at"),
            "additions": pr.get("additions") or 0,
            "deletions": pr.get("deletions") or 0,
            "changed_files": pr.get("changed_files") or 0,
            "repo": {
                "name": (pr.get("repo") or {}).get("name"),
                "stars": (pr.get("repo") or {}).get("stars") or 0,
                "language": (pr.get("repo") or {}).get("language"),
            },
        }
        for pr in prs
    ]
    return {
        "user": {
            "login": user.get("login"),
            "name": user.get("name"),
            "bio": user.get("bio"),
            "location": user.get("location"),
        },
        "skill_profile": {
            "summary": (skill_profile or {}).get("summary"),
            "skills": (skill_profile or {}).get("skills") or [],
            "interests": (skill_profile or {}).get("interests") or [],
        },
        "stats": stats,
        "merged_prs_ranked": compact_prs,
    }


async def build_portfolio_narrative(
    portfolio: dict[str, Any],
    skill_profile: dict[str, Any] | None,
    *,
    user_id: int | None = None,
) -> dict[str, Any]:
    facts = _build_fact_sheet(portfolio, skill_profile)
    user_message = (
        "Contributor fact sheet:\n```json\n"
        + json.dumps(facts, indent=2)
        + "\n```"
    )

    raw = await call_claude(
        system=[cached_text_block(PORTFOLIO_SYSTEM)],
        messages=[{"role": "user", "content": user_message}],
        tier="sonnet",
        max_tokens=1600,
        temperature=0.3,
        agent="portfolio_builder",
        user_id=user_id,
        metadata={
            "login": (facts.get("user") or {}).get("login"),
            "pr_count": len(facts["merged_prs_ranked"]),
        },
    )
    parsed = parse_json(raw)
    if not isinstance(parsed, dict):
        raise ValueError("portfolio_builder returned non-object JSON")

    parsed.setdefault("headline", "")
    parsed.setdefault("summary", "")
    parsed.setdefault("strengths", [])
    parsed.setdefault("highlights", [])
    parsed.setdefault("recommended_next_steps", [])
    return parsed
