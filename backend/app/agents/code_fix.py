"""Code Fix Agent (Fix Mode).

Given an issue + its cached fix plan + exactly one file's current text,
propose an edited version of that file. Output is always structured JSON so
the router can apply (or stitch back, for range edits) without parsing
freeform prose.

Prompt-cache layout mirrors issue_understanding: system rules + issue/plan
block are cached; the live file body is the only non-cached block, so
iterating on the same file (e.g. "try a simpler approach") hits cache after
call 1.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.agents.base import call_claude, cached_text_block, parse_json
from app.agents.issue_understanding import understand_issue
from app.models import FixFile, FixSession, Issue
from app.services.cache import cache_key, get_json, set_json

CODE_FIX_SYSTEM = """You are a senior engineer pair-programming with an OSS newcomer inside
a browser editor. You propose edits to ONE file at a time based on an issue
and its fix plan. You do NOT invent file paths you have not been shown. You
do NOT execute code. You do NOT recommend tooling changes outside this file.

You will receive:
  - The issue (cached).
  - The fix plan from the understanding agent (cached).
  - Exactly one source file: {path, language, full_content_or_window}.
  - Optional: contributor's instruction, and/or a selected line range.

Output ONLY valid JSON:
{
  "strategy": "full_replace" | "no_change_needed" | "range_replace",
  "proposed_content": "<the full new file body (or range body) verbatim>",
  "range": {"start_line": <int>, "end_line": <int>} | null,
  "rationale": "<2-4 sentences explaining what you changed and why, referencing the issue>",
  "summary_of_change": "<one imperative-mood line, <=72 chars, for the commit summary later>",
  "confidence": "low" | "medium" | "high",
  "unresolved": ["<question you cannot answer without running the code>", ...]
}

Rules:
- If the file is already correct for this issue, return "no_change_needed"
  with rationale and put blockers in "unresolved".
- Preserve formatting, indentation, and unrelated lines exactly. Diff surgically.
- Never stub out unrelated code paths. If you cannot fix without breaking
  something, return "no_change_needed" and put the blocker in "unresolved".
- Do not remove imports unless the fix genuinely makes them unused.
- Keep changes proportional to the issue. This is a PR, not a refactor.
- For range_replace, "proposed_content" is the replacement for lines
  [start_line, end_line] inclusive (1-indexed), nothing outside that range.
"""

# Budget for sending the file verbatim. Beyond this, we send a windowed view
# and require range_replace back so the router can stitch without re-reading
# megabytes through the model.
MAX_FULL_CONTENT_BYTES = 32 * 1024

# Lines of context kept around the selection / top + bottom of a large file.
WINDOW_AROUND_SELECTION = 200
WINDOW_HEAD = 200
WINDOW_TAIL = 100


def _extension_to_language(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return {
        "py": "python",
        "pyi": "python",
        "js": "javascript",
        "jsx": "javascript",
        "mjs": "javascript",
        "cjs": "javascript",
        "ts": "typescript",
        "tsx": "typescript",
        "go": "go",
        "rs": "rust",
        "java": "java",
        "kt": "kotlin",
        "scala": "scala",
        "rb": "ruby",
        "php": "php",
        "c": "c",
        "h": "c",
        "cc": "cpp",
        "cpp": "cpp",
        "hpp": "cpp",
        "cs": "csharp",
        "swift": "swift",
        "m": "objc",
        "sh": "shell",
        "bash": "shell",
        "zsh": "shell",
        "sql": "sql",
        "yaml": "yaml",
        "yml": "yaml",
        "toml": "toml",
        "json": "json",
        "md": "markdown",
    }.get(ext, "text")


def _windowed(
    content: str, selection: tuple[int, int] | None
) -> tuple[str, tuple[int, int] | None]:
    """Return (windowed_text, (start_line, end_line)) when large; else (content, None)."""
    if len(content.encode("utf-8", "ignore")) <= MAX_FULL_CONTENT_BYTES:
        return content, None

    lines = content.splitlines()
    total = len(lines)
    if selection is not None:
        start, end = selection
        start = max(1, start)
        end = min(total, max(start, end))
        lo = max(1, start - WINDOW_AROUND_SELECTION)
        hi = min(total, end + WINDOW_AROUND_SELECTION)
        window = "\n".join(lines[lo - 1 : hi])
        return window, (lo, hi)

    # No selection — send head + tail. We still return a range so the model
    # knows it's editing a window, not the whole file.
    head = lines[:WINDOW_HEAD]
    tail = lines[-WINDOW_TAIL:] if total > WINDOW_HEAD + WINDOW_TAIL else []
    if tail:
        sep = f"\n... [{total - WINDOW_HEAD - WINDOW_TAIL} lines elided] ...\n"
        window = "\n".join(head) + sep + "\n".join(tail)
    else:
        window = "\n".join(head)
    return window, (1, min(total, WINDOW_HEAD))


async def _load_fix_plan(db: Session, issue_id: int, github_token: str) -> dict[str, Any]:
    """Reuse the cached understanding output; recompute on miss."""
    key = cache_key("understand:v1", issue_id)
    cached = await get_json(key)
    if cached is not None:
        return cached
    result = await understand_issue(db, issue_id, github_token)
    await set_json(key, result, 60 * 60)
    return result


async def propose_edit(
    db: Session,
    session_id: int,
    file_id: int,
    github_token: str,
    user_prompt: str | None = None,
    selection: tuple[int, int] | None = None,
) -> dict[str, Any]:
    session = db.get(FixSession, session_id)
    if session is None:
        raise ValueError(f"FixSession {session_id} not found")
    fix_file = db.get(FixFile, file_id)
    if fix_file is None or fix_file.session_id != session_id:
        raise ValueError(f"FixFile {file_id} not in session {session_id}")
    issue = db.get(Issue, session.issue_id)
    if issue is None:
        raise ValueError(f"Issue {session.issue_id} not found")

    plan = await _load_fix_plan(db, session.issue_id, github_token)
    current_text = fix_file.draft_text if fix_file.draft_text is not None else fix_file.original_text
    windowed_text, window_range = _windowed(current_text, selection)

    language = _extension_to_language(fix_file.path)

    issue_block = (
        "# Issue\n"
        + json.dumps(
            {
                "number": issue.number,
                "title": issue.title,
                "url": issue.url,
                "labels": issue.labels or [],
                "body": (issue.body or "")[:4000],
            },
            indent=2,
        )
        + "\n\n# Fix plan (from understanding agent)\n"
        + json.dumps(plan, indent=2)
    )

    file_payload = {
        "path": fix_file.path,
        "language_hint": language,
        "is_windowed": window_range is not None,
        "window_range": (
            {"start_line": window_range[0], "end_line": window_range[1]}
            if window_range
            else None
        ),
        "user_prompt": user_prompt or None,
        "selection": (
            {"start_line": selection[0], "end_line": selection[1]} if selection else None
        ),
        "content": windowed_text,
    }

    user_message = (
        "File under edit:\n```json\n"
        + json.dumps({k: v for k, v in file_payload.items() if k != "content"}, indent=2)
        + "\n```\n\nCurrent content:\n```"
        + language
        + "\n"
        + windowed_text
        + "\n```\n\n"
        + (
            "Return 'range_replace' with range matching window_range."
            if window_range is not None
            else "Return 'full_replace' with the complete new file body (or 'no_change_needed')."
        )
    )

    raw = await call_claude(
        system=[
            cached_text_block(CODE_FIX_SYSTEM),
            cached_text_block(issue_block),
        ],
        messages=[{"role": "user", "content": user_message}],
        tier="sonnet",
        max_tokens=4096,
        temperature=0.2,
        agent="code_fix",
        metadata={
            "session_id": session_id,
            "file_id": file_id,
            "path": fix_file.path,
            "windowed": window_range is not None,
            "has_prompt": bool(user_prompt),
        },
    )
    parsed = parse_json(raw)
    if not isinstance(parsed, dict):
        raise ValueError("code_fix returned non-object JSON")

    parsed.setdefault("strategy", "no_change_needed")
    parsed.setdefault("proposed_content", "")
    parsed.setdefault("range", None)
    parsed.setdefault("rationale", "")
    parsed.setdefault("summary_of_change", "")
    parsed.setdefault("confidence", "medium")
    parsed.setdefault("unresolved", [])

    if parsed["strategy"] not in ("full_replace", "no_change_needed", "range_replace"):
        parsed["strategy"] = "no_change_needed"

    # If we sent a window, force range semantics so the router can stitch back.
    if window_range is not None and parsed["strategy"] == "full_replace":
        parsed["strategy"] = "range_replace"
        parsed["range"] = {"start_line": window_range[0], "end_line": window_range[1]}

    parsed["summary_of_change"] = str(parsed["summary_of_change"])[:120]
    return parsed


def apply_proposal(original_text: str, proposal: dict[str, Any]) -> str | None:
    """Translate a code_fix proposal into a full file body.

    Returns the new file body, or None for "no_change_needed".
    """
    strategy = proposal.get("strategy")
    if strategy == "no_change_needed":
        return None
    if strategy == "full_replace":
        return str(proposal.get("proposed_content") or "")
    if strategy == "range_replace":
        rng = proposal.get("range") or {}
        start = int(rng.get("start_line") or 1)
        end = int(rng.get("end_line") or start)
        lines = original_text.splitlines(keepends=False)
        start = max(1, min(start, len(lines) + 1))
        end = max(start, min(end, len(lines)))
        replacement = str(proposal.get("proposed_content") or "").splitlines(keepends=False)
        new_lines = lines[: start - 1] + replacement + lines[end:]
        trailing_nl = "\n" if original_text.endswith("\n") else ""
        return "\n".join(new_lines) + trailing_nl
    return None
