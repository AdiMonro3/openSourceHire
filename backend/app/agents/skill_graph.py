"""Skill-Graph Agent (P0.3).

Reads the user's GitHub viewer profile, distills it into a structured fact
sheet, then asks Claude Sonnet 4.6 to synthesize a SkillProfile.

The "fact sheet" is deterministic and small; only it (not raw GitHub blobs)
is sent to Claude. The instruction block is wrapped in a cache_control text
block so repeated calls hit the prompt cache.
"""
from __future__ import annotations

from collections import Counter
from typing import Any

from app.agents.base import call_claude, cached_text_block, parse_json
from app.integrations.github import fetch_viewer_profile

SKILL_GRAPH_SYSTEM = """You are an engineering-skills analyst.

Given a structured fact sheet about a developer's GitHub activity, output a
JSON object describing their skill profile. Be calibrated and conservative —
do not over-claim levels.

Schema:
{
  "skills": [
    { "name": "<Language or framework>", "level": 1-5, "evidence": "<short>" }
  ],
  "interests": ["<topic>", ...],
  "summary": "<2 sentences, neutral tone>"
}

Rules:
- Level 1: tried it once. Level 2: small projects. Level 3: shipped real work.
- Level 4: deep, multi-project experience. Level 5: maintainer-grade.
- Use only what the fact sheet supports. If unclear, lower the level.
- Output ONLY valid JSON. No commentary.
"""


def _summarize_viewer(viewer: dict[str, Any]) -> dict[str, Any]:
    repos = viewer.get("repositories", {}).get("nodes", []) or []
    prs = viewer.get("pullRequests", {}).get("nodes", []) or []

    lang_bytes: Counter[str] = Counter()
    topic_count: Counter[str] = Counter()
    repo_summaries = []

    for r in repos:
        for edge in (r.get("languages") or {}).get("edges", []) or []:
            lang_bytes[edge["node"]["name"]] += int(edge.get("size", 0))
        for t in (r.get("repositoryTopics") or {}).get("nodes", []) or []:
            topic_count[t["topic"]["name"]] += 1
        repo_summaries.append(
            {
                "name": r.get("nameWithOwner"),
                "stars": r.get("stargazerCount", 0),
                "primary_language": (r.get("primaryLanguage") or {}).get("name"),
                "description": (r.get("description") or "")[:200],
            }
        )

    pr_summary = {
        "total": viewer.get("pullRequests", {}).get("totalCount", 0),
        "merged": sum(1 for p in prs if p.get("merged")),
        "external_repos": sorted(
            {
                p["repository"]["nameWithOwner"]
                for p in prs
                if p.get("merged") and "/" in p["repository"]["nameWithOwner"]
            }
        )[:20],
    }

    return {
        "login": viewer.get("login"),
        "name": viewer.get("name"),
        "bio": viewer.get("bio"),
        "language_bytes": dict(lang_bytes.most_common(15)),
        "topics": [t for t, _ in topic_count.most_common(15)],
        "repos": repo_summaries[:15],
        "pull_requests": pr_summary,
    }


async def build_skill_profile(github_token: str) -> dict[str, Any]:
    viewer = await fetch_viewer_profile(github_token)
    facts = _summarize_viewer(viewer)

    user_message = (
        "Fact sheet:\n```json\n" + __import__("json").dumps(facts, indent=2) + "\n```"
    )

    raw = await call_claude(
        system=[cached_text_block(SKILL_GRAPH_SYSTEM)],
        messages=[{"role": "user", "content": user_message}],
        tier="sonnet",
        max_tokens=1500,
        temperature=0.1,
        agent="skill_graph",
        metadata={"login": facts.get("login")},
    )
    parsed = parse_json(raw)
    parsed.setdefault("skills", [])
    parsed.setdefault("interests", [])
    parsed.setdefault("summary", "")
    parsed["github_login"] = facts["login"]
    return parsed
