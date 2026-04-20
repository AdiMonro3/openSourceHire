"""PR Coach Agent (P1.1).

Given an issue + the contributor's rough draft of what they did, produce a
commit message and PR description that mirror the target repo's house style.
Never submits anything — output is text the user copies into GitHub.

Tone mimicry comes from few-shotting the last ~10 merged PRs of the repo.
That block is big and repeats across every draft the same user iterates on,
so it's wrapped in a cache_control block. The static coach rules are also
cached since they never change.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.agents.base import call_claude, cached_text_block, parse_json
from app.integrations.github import fetch_recent_merged_prs
from app.models import Issue, Repo
from app.services.policy import append_ai_disclosure

COACH_SYSTEM = """You are a senior maintainer coaching an OSS contributor on their PR.

You are given:
  - The issue being fixed.
  - A few of the repo's recently-merged PRs, as a tone/format reference.
  - The contributor's plain-English draft of what they changed.

Produce a commit message and PR description that match the repo's observed
house style (structure, voice, level of formality, use of issue refs, emoji
usage, checklist format — mirror what the sample PRs actually do).

Rules:
  - Do not invent changes the contributor did not describe. If the draft is
    too vague to write a body, keep the body short and add one item to
    `questions_for_contributor`.
  - commit_title: imperative mood, <=72 chars, no trailing period.
  - commit_body: optional. Wrap at ~72 chars. Empty string if not needed.
  - pr_title: can be more descriptive than the commit title. Match whatever
    convention the sample PRs use (e.g. "fix:", "[area] ...", plain prose).
  - pr_body: markdown. Include "Fixes #<issue_number>" if the repo's sample
    PRs reference issues that way; otherwise mention the issue in prose.
  - checklist: bullet items the contributor should verify before opening the
    PR (tests, docs, changelog). Only include items the sample PRs or repo
    conventions imply are expected. 0-5 items.
  - questions_for_contributor: anything ambiguous in the draft. 0-3 items.

Output ONLY valid JSON matching this schema:
{
  "commit_title": "<string>",
  "commit_body": "<string, may be empty>",
  "pr_title": "<string>",
  "pr_body": "<markdown string>",
  "checklist": ["<item>", ...],
  "questions_for_contributor": ["<question>", ...]
}
"""

MAX_PR_BODY_CHARS = 1500
MAX_COMMIT_MSG_CHARS = 400
MAX_DRAFT_CHARS = 4000
MAX_ISSUE_BODY_CHARS = 2000


def _truncate(text: str | None, limit: int) -> str:
    t = text or ""
    return t if len(t) <= limit else t[:limit] + "\n…[truncated]"


def _is_bot(login: str | None) -> bool:
    if not login:
        return False
    return login.endswith("[bot]") or login in {"dependabot", "renovate-bot"}


def _format_sample_prs(prs: list[dict[str, Any]]) -> str:
    """Serialize merged PRs into a compact tone-reference block."""
    samples = []
    for pr in prs:
        author = (pr.get("author") or {}).get("login")
        if _is_bot(author):
            continue
        commits = [
            {
                "headline": c.get("commit", {}).get("messageHeadline", ""),
                "body": _truncate(c.get("commit", {}).get("messageBody"), 300),
            }
            for c in (pr.get("commits") or {}).get("nodes") or []
        ][:3]
        samples.append(
            {
                "number": pr.get("number"),
                "title": pr.get("title"),
                "body": _truncate(pr.get("body"), MAX_PR_BODY_CHARS),
                "commits": commits,
                "changed_files": pr.get("changedFiles"),
                "additions": pr.get("additions"),
                "deletions": pr.get("deletions"),
            }
        )
    if not samples:
        return "(no recent merged PRs available — infer a neutral, concise style)"
    return (
        "# Recent merged PRs in this repo (tone + format reference)\n\n"
        "```json\n" + json.dumps(samples, indent=2) + "\n```"
    )


def _format_issue_block(issue: Issue, repo: Repo) -> str:
    return (
        f"Repository: {repo.name_with_owner}\n"
        f"Primary language: {repo.primary_language or 'unknown'}\n\n"
        "# Issue\n"
        + json.dumps(
            {
                "number": issue.number,
                "title": issue.title,
                "url": issue.url,
                "labels": issue.labels or [],
                "body": _truncate(issue.body, MAX_ISSUE_BODY_CHARS),
            },
            indent=2,
        )
    )


async def coach_pr(
    db: Session,
    issue_id: int,
    github_token: str,
    draft: str,
) -> dict[str, Any]:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise ValueError(f"Issue {issue_id} not found")
    repo = db.get(Repo, issue.repo_id)
    if repo is None:
        raise ValueError(f"Repo {issue.repo_id} not found")

    draft_clean = (draft or "").strip()
    if not draft_clean:
        raise ValueError("draft is empty")
    draft_clean = _truncate(draft_clean, MAX_DRAFT_CHARS)

    recent_prs = await fetch_recent_merged_prs(
        github_token, repo.name_with_owner, limit=10
    )
    tone_block = _format_sample_prs(recent_prs)
    issue_block = _format_issue_block(issue, repo)

    user_message = (
        "Contributor's draft of what they changed:\n"
        "```\n" + draft_clean + "\n```\n\n"
        "Write the commit message and PR description."
    )

    raw = await call_claude(
        system=[
            cached_text_block(COACH_SYSTEM),
            cached_text_block(tone_block),
            cached_text_block(issue_block),
        ],
        messages=[{"role": "user", "content": user_message}],
        tier="sonnet",
        max_tokens=1400,
        temperature=0.3,
        agent="pr_coach",
        metadata={
            "issue_id": issue_id,
            "repo": repo.name_with_owner,
            "draft_chars": len(draft_clean),
        },
    )
    parsed = parse_json(raw)
    if not isinstance(parsed, dict):
        raise ValueError("PR coach returned non-object JSON")

    parsed.setdefault("commit_title", "")
    parsed.setdefault("commit_body", "")
    parsed.setdefault("pr_title", "")
    parsed.setdefault("pr_body", "")
    parsed.setdefault("checklist", [])
    parsed.setdefault("questions_for_contributor", [])

    parsed["commit_title"] = str(parsed["commit_title"])[:120]
    parsed["commit_body"] = _truncate(str(parsed["commit_body"]), MAX_COMMIT_MSG_CHARS)
    parsed["pr_body"] = append_ai_disclosure(str(parsed["pr_body"]))
    return parsed
