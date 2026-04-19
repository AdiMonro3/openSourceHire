"""Maintainer-pledge policy checks (P1.3).

A repo is flagged `is_anti_ai` if either:
  1. Its `owner/repo` appears in `data/anti_ai_repos.txt` (explicit blocklist), or
  2. Its README contains a phrase from `ANTI_AI_PATTERNS` that clearly
     signals the maintainers reject AI-assisted contributions.

Flagged repos are excluded from the scout ranker so we never recommend an
issue the contributor would get their PR closed for.
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

BLOCKLIST_PATH = Path(__file__).resolve().parents[2] / "data" / "anti_ai_repos.txt"

# Phrases chosen to be explicit rejections, not mere mentions of AI. We want
# very few false positives — a repo talking *about* LLMs in their README
# should not get blocked. Matched as case-insensitive substrings.
ANTI_AI_PATTERNS: tuple[str, ...] = (
    "no ai-generated",
    "no ai generated",
    "no llm-generated",
    "no llm generated",
    "ai-generated prs",
    "ai generated prs",
    "ai-generated pull requests",
    "ai generated pull requests",
    "ai-generated contributions",
    "ai generated contributions",
    "no chatgpt",
    "no copilot",
    "no github copilot",
    "do not submit ai",
    "do not use ai to",
    "please do not use ai",
    "will be closed without review",  # usually paired with AI-PR language; see _matches
    "ai-assisted prs are not welcome",
    "ai-assisted contributions are not welcome",
)

# A couple of patterns above are generic enough that we only want to trigger
# them when they co-occur with an AI keyword nearby.
_AI_CONTEXT_TOKENS = ("ai", "llm", "chatgpt", "copilot", "claude", "gpt")
_CONTEXT_REQUIRED = {"will be closed without review"}


def _load_blocklist(path: Path) -> frozenset[str]:
    if not path.exists():
        return frozenset()
    out: set[str] = set()
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        out.add(line.lower())
    return frozenset(out)


@lru_cache(maxsize=1)
def _cached_blocklist() -> frozenset[str]:
    return _load_blocklist(BLOCKLIST_PATH)


def reload_blocklist() -> None:
    """Invalidate the cached blocklist (used in tests)."""
    _cached_blocklist.cache_clear()


def _matches_patterns(readme: str) -> bool:
    lowered = readme.lower()
    for pat in ANTI_AI_PATTERNS:
        idx = lowered.find(pat)
        if idx < 0:
            continue
        if pat in _CONTEXT_REQUIRED:
            window = lowered[max(0, idx - 120) : idx + len(pat) + 120]
            if not any(tok in window for tok in _AI_CONTEXT_TOKENS):
                continue
        return True
    return False


def is_blocklisted(name_with_owner: str) -> bool:
    return name_with_owner.lower() in _cached_blocklist()


def detect_anti_ai(name_with_owner: str, readme: str | None) -> bool:
    if is_blocklisted(name_with_owner):
        return True
    if readme and _matches_patterns(readme):
        return True
    return False


# Exposed for the disclosure-block appender in pr_coach.
AI_DRAFT_DISCLOSURE = (
    "---\n\n"
    "*Drafted with AI assistance via "
    "[openSource-Hire](https://github.com/openSource-Hire). "
    "The author reviewed and tested the changes before opening this PR.*"
)


_DISCLOSURE_MARKER = re.compile(
    r"drafted with ai assistance|ai assistance via|🤖.*generated",
    re.IGNORECASE,
)


def append_ai_disclosure(pr_body: str) -> str:
    """Append the AI-draft disclosure block to a PR body, idempotently."""
    body = (pr_body or "").rstrip()
    if body and _DISCLOSURE_MARKER.search(body):
        return body
    if not body:
        return AI_DRAFT_DISCLOSURE
    return f"{body}\n\n{AI_DRAFT_DISCLOSURE}"
