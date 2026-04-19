"""Issue-Understanding Agent (P0.6).

Given an issue row + its repo, produce a plain-English fix plan a junior OSS
contributor can act on. Repo context (README + filtered file tree) is the
long, repeated chunk — it's wrapped in a cache_control block so every call
for issues in the same repo hits Claude's prompt cache after the first one.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.agents.base import call_claude, cached_text_block, parse_json
from app.integrations.github import fetch_repo_readme, fetch_repo_tree
from app.models import Issue, Repo

UNDERSTANDING_SYSTEM = """You are a senior engineer mentoring an OSS newcomer.

Given an issue and the target repo's README + file tree, produce a concrete,
honest fix plan. Do not hallucinate file paths — only cite paths that appear
in the tree. If the issue is under-specified, say so in clarifying_questions
rather than guessing.

Output ONLY valid JSON matching this schema:
{
  "plain_summary": "<2-3 sentences, plain English, what this issue is asking>",
  "approach": ["<ordered step>", ...],
  "likely_files": ["<path from the tree>", ...],
  "gotchas": ["<pitfall to avoid>", ...],
  "clarifying_questions": ["<ask before starting>", ...],
  "difficulty": "easy" | "medium" | "hard"
}

Rules:
- plain_summary: no jargon, assume the reader may be new to this codebase.
- approach: 3–6 steps max. Each step one sentence.
- likely_files: at most 6, only paths from the provided tree.
- gotchas: only real risks implied by the issue, README, or tree. Skip if none.
- difficulty: easy = <1 day, medium = 1–3 days, hard = >3 days or architectural.
"""

MAX_README_CHARS = 8000
MAX_TREE_PATHS = 200
MAX_BODY_CHARS = 4000


def _format_repo_context(repo: Repo, readme: str | None, tree: list[str]) -> str:
    parts = [
        f"Repository: {repo.name_with_owner}",
        f"Description: {repo.description or '(none)'}",
        f"Primary language: {repo.primary_language or 'unknown'}",
        f"Stars: {repo.stargazers_count}",
        f"Topics: {', '.join(repo.topics or []) or '(none)'}",
        "",
        "# README",
        (readme or "(no README found)")[:MAX_README_CHARS],
        "",
        "# File tree (filtered to source/docs/config)",
    ]
    parts.extend(tree[:MAX_TREE_PATHS])
    return "\n".join(parts)


def _format_issue(issue: Issue) -> str:
    body = (issue.body or "")[:MAX_BODY_CHARS]
    return json.dumps(
        {
            "number": issue.number,
            "title": issue.title,
            "labels": issue.labels or [],
            "url": issue.url,
            "body": body,
        },
        indent=2,
    )


async def understand_issue(
    db: Session, issue_id: int, github_token: str
) -> dict[str, Any]:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise ValueError(f"Issue {issue_id} not found")
    repo = db.get(Repo, issue.repo_id)
    if repo is None:
        raise ValueError(f"Repo {issue.repo_id} not found")

    readme = await fetch_repo_readme(github_token, repo.name_with_owner)
    tree = await fetch_repo_tree(github_token, repo.name_with_owner)

    repo_block = _format_repo_context(repo, readme, tree)
    user_message = "Issue:\n```json\n" + _format_issue(issue) + "\n```"

    raw = await call_claude(
        system=[
            cached_text_block(UNDERSTANDING_SYSTEM),
            cached_text_block(repo_block),
        ],
        messages=[{"role": "user", "content": user_message}],
        tier="sonnet",
        max_tokens=1200,
        temperature=0.2,
    )
    parsed = parse_json(raw)
    parsed.setdefault("plain_summary", "")
    parsed.setdefault("approach", [])
    parsed.setdefault("likely_files", [])
    parsed.setdefault("gotchas", [])
    parsed.setdefault("clarifying_questions", [])
    parsed.setdefault("difficulty", "medium")
    return parsed
