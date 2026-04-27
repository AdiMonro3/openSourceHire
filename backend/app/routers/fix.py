"""Fix Mode router.

Lets a signed-in user open an issue, edit repo files in the browser, get AI
assistance per file, and open a PR (fork → branch → commit → PR) — all
without leaving openSource-Hire. Public repos only; no code execution.
"""
from __future__ import annotations

import difflib
import re
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.agents.code_fix import apply_proposal, propose_edit
from app.agents.issue_understanding import understand_issue
from app.agents.pr_coach import coach_pr
from app.deps import get_current_user, get_db
from app.integrations.github import (
    MAX_EDITABLE_FILE_BYTES,
    ForkNameCollision,
    GitHubWriteError,
    create_blob,
    create_commit,
    create_or_update_ref,
    create_pull_request,
    create_tree,
    ensure_fork,
    fetch_default_branch_head,
    fetch_file_contents,
    fetch_repo_tree_full,
)
from app.models import FixFile, FixSession, Issue, Repo, User
from app.services.cache import cache_key, get_json, set_json
from app.services.policy import append_ai_disclosure

router = APIRouter(tags=["fix"])

UNDERSTAND_TTL = 60 * 60
_PATH_RE = re.compile(r"^[A-Za-z0-9_./\-]+$")


class AddFileBody(BaseModel):
    path: str = Field(min_length=1, max_length=512)


class UpdateFileBody(BaseModel):
    draft_text: str = Field(max_length=MAX_EDITABLE_FILE_BYTES)


class AiEditBody(BaseModel):
    prompt: str | None = Field(default=None, max_length=2000)
    selection: dict[str, int] | None = None


class SubmitBody(BaseModel):
    pr_title: str | None = Field(default=None, max_length=200)
    pr_body: str | None = Field(default=None, max_length=8000)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _get_owned_session(db: Session, user: User, session_id: int) -> FixSession:
    session = db.get(FixSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(404, "Fix session not found")
    return session


def _get_owned_file(db: Session, user: User, session_id: int, file_id: int) -> tuple[FixSession, FixFile]:
    session = _get_owned_session(db, user, session_id)
    fix_file = db.get(FixFile, file_id)
    if fix_file is None or fix_file.session_id != session.id:
        raise HTTPException(404, "File not in this session")
    return session, fix_file


def _file_meta(f: FixFile) -> dict[str, Any]:
    return {
        "id": f.id,
        "path": f.path,
        "size_bytes": f.size_bytes,
        "is_ai_assisted": f.is_ai_assisted,
        "has_draft": f.draft_text is not None and f.draft_text != f.original_text,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
    }


def _session_summary(session: FixSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "issue_id": session.issue_id,
        "upstream_repo": session.upstream_repo,
        "default_branch": session.upstream_default_branch,
        "base_sha": session.base_sha,
        "fork_full_name": session.fork_full_name,
        "branch_name": session.branch_name,
        "state": session.state,
        "pr_url": session.pr_url,
        "pr_number": session.pr_number,
    }


async def _load_understanding(db: Session, issue_id: int, github_token: str) -> dict[str, Any]:
    key = cache_key("understand:v1", issue_id)
    cached = await get_json(key)
    if cached is not None:
        return cached
    result = await understand_issue(db, issue_id, github_token)
    await set_json(key, result, UNDERSTAND_TTL)
    return result


def _unified_diff(path: str, original: str, draft: str) -> dict[str, Any]:
    a = original.splitlines(keepends=False)
    b = draft.splitlines(keepends=False)
    diff_lines = list(
        difflib.unified_diff(a, b, fromfile=f"a/{path}", tofile=f"b/{path}", lineterm="")
    )
    additions = sum(1 for ln in diff_lines if ln.startswith("+") and not ln.startswith("+++"))
    deletions = sum(1 for ln in diff_lines if ln.startswith("-") and not ln.startswith("---"))
    return {
        "path": path,
        "diff": "\n".join(diff_lines),
        "additions": additions,
        "deletions": deletions,
    }


def _summarize_for_coach(
    understanding: dict[str, Any],
    session: FixSession,
    files: list[FixFile],
    diffs: list[dict[str, Any]],
) -> str:
    """Synthesize a plain-English 'what I changed' draft for pr_coach.

    We never feed pr_coach a raw diff (its prompt explicitly expects
    plain-English intent). Instead: one line per changed file, preferring
    the code_fix summary_of_change; otherwise '+N/-M lines'.
    """
    intent = (understanding.get("plain_summary") or "").strip()
    lines: list[str] = []
    if intent:
        lines.append(intent)
    diff_by_path = {d["path"]: d for d in diffs}
    for f in files:
        if f.draft_text is None or f.draft_text == f.original_text:
            continue
        summary = f.ai_summary_of_change or ""
        d = diff_by_path.get(f.path) or {"additions": 0, "deletions": 0}
        if summary:
            lines.append(f"- {f.path}: {summary}")
        else:
            lines.append(
                f"- {f.path}: edited (+{d['additions']}/-{d['deletions']} lines)"
            )
    lines.append(
        f"\nBase: {session.upstream_repo}@{session.base_sha[:7]} "
        f"({session.upstream_default_branch})."
    )
    return "\n".join(lines).strip()


# ---------------------------------------------------------------------------
# session creation + reads
# ---------------------------------------------------------------------------


@router.post("/issues/{issue_id}/fix/session")
async def create_session(
    issue_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "Issue not found")
    repo = db.get(Repo, issue.repo_id)
    if repo is None:
        raise HTTPException(404, "Repo not found")
    if repo.is_anti_ai:
        raise HTTPException(
            403,
            "This maintainer has asked contributors not to use AI-assisted PRs.",
        )

    existing = (
        db.query(FixSession)
        .filter(
            and_(
                FixSession.user_id == user.id,
                FixSession.issue_id == issue_id,
                FixSession.state == "draft",
            )
        )
        .one_or_none()
    )
    if existing is not None:
        return {
            **_session_summary(existing),
            "files": [_file_meta(f) for f in existing.files],
            "resumed": True,
        }

    head = await fetch_default_branch_head(user.access_token, repo.name_with_owner)
    understanding = await _load_understanding(db, issue_id, user.access_token)
    likely_files: list[str] = list(understanding.get("likely_files") or [])[:6]

    session = FixSession(
        user_id=user.id,
        issue_id=issue_id,
        upstream_repo=repo.name_with_owner,
        upstream_default_branch=head["branch"],
        base_sha=head["sha"],
        state="draft",
    )
    db.add(session)
    db.flush()  # assign session.id

    seeded: list[FixFile] = []
    for path in likely_files:
        try:
            content = await fetch_file_contents(
                user.access_token, repo.name_with_owner, path, ref=head["sha"]
            )
        except GitHubWriteError:
            continue  # skip files the understanding agent hallucinated / got removed
        if content["is_binary"] or content["truncated"] or content["text"] is None:
            continue
        seeded.append(
            FixFile(
                session_id=session.id,
                path=path,
                original_blob_sha=content["sha"],
                original_text=content["text"],
                size_bytes=content["size"],
            )
        )
    db.add_all(seeded)
    db.commit()
    db.refresh(session)

    return {
        **_session_summary(session),
        "files": [_file_meta(f) for f in session.files],
        "resumed": False,
    }


@router.get("/fix/{session_id}")
def get_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(db, user, session_id)
    return {
        **_session_summary(session),
        "files": [_file_meta(f) for f in session.files],
    }


@router.get("/fix/{session_id}/files/{file_id}")
def get_file(
    session_id: int,
    file_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _, fix_file = _get_owned_file(db, user, session_id, file_id)
    return {
        **_file_meta(fix_file),
        "original_text": fix_file.original_text,
        "draft_text": fix_file.draft_text,
        "original_blob_sha": fix_file.original_blob_sha,
    }


@router.put("/fix/{session_id}/files/{file_id}")
def update_file(
    session_id: int,
    file_id: int,
    body: UpdateFileBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _, fix_file = _get_owned_file(db, user, session_id, file_id)
    if len(body.draft_text.encode("utf-8", "ignore")) > MAX_EDITABLE_FILE_BYTES:
        raise HTTPException(422, "Draft exceeds 500KB limit")
    fix_file.draft_text = body.draft_text
    db.commit()
    db.refresh(fix_file)
    return _file_meta(fix_file)


@router.post("/fix/{session_id}/files")
async def add_file(
    session_id: int,
    body: AddFileBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(db, user, session_id)
    if session.state != "draft":
        raise HTTPException(409, "Session is not editable")

    path = body.path.strip().lstrip("/")
    if not _PATH_RE.match(path) or ".." in path.split("/"):
        raise HTTPException(422, "Invalid path")

    already = next((f for f in session.files if f.path == path), None)
    if already is not None:
        return _file_meta(already)

    content = await fetch_file_contents(
        user.access_token, session.upstream_repo, path, ref=session.base_sha
    )
    if content["truncated"]:
        raise HTTPException(422, "File too large to edit in browser (500KB limit)")
    if content["is_binary"] or content["text"] is None:
        raise HTTPException(422, "Binary files are not editable here")

    fix_file = FixFile(
        session_id=session.id,
        path=path,
        original_blob_sha=content["sha"],
        original_text=content["text"],
        size_bytes=content["size"],
    )
    db.add(fix_file)
    db.commit()
    db.refresh(fix_file)
    return _file_meta(fix_file)


@router.delete("/fix/{session_id}/files/{file_id}")
def delete_file(
    session_id: int,
    file_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session, fix_file = _get_owned_file(db, user, session_id, file_id)
    if session.state != "draft":
        raise HTTPException(409, "Session is not editable")
    db.delete(fix_file)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# AI edit + diff
# ---------------------------------------------------------------------------


@router.post("/fix/{session_id}/files/{file_id}/ai-edit")
async def ai_edit(
    session_id: int,
    file_id: int,
    body: AiEditBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session, fix_file = _get_owned_file(db, user, session_id, file_id)
    if session.state != "draft":
        raise HTTPException(409, "Session is not editable")

    selection: tuple[int, int] | None = None
    if body.selection:
        s = int(body.selection.get("start_line") or 0)
        e = int(body.selection.get("end_line") or 0)
        if s >= 1 and e >= s:
            selection = (s, e)

    try:
        proposal = await propose_edit(
            db,
            session_id,
            file_id,
            user.access_token,
            user_prompt=body.prompt,
            selection=selection,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    fix_file.is_ai_assisted = True
    if proposal.get("summary_of_change"):
        fix_file.ai_summary_of_change = str(proposal["summary_of_change"])[:120]
    db.commit()

    return {"file_id": file_id, **proposal}


@router.get("/fix/{session_id}/diff")
def get_diff(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(db, user, session_id)
    files_out: list[dict[str, Any]] = []
    total_add = 0
    total_del = 0
    for f in session.files:
        if f.draft_text is None or f.draft_text == f.original_text:
            continue
        d = _unified_diff(f.path, f.original_text, f.draft_text)
        total_add += d["additions"]
        total_del += d["deletions"]
        files_out.append(d)
    return {"files": files_out, "total_additions": total_add, "total_deletions": total_del}


@router.get("/fix/{session_id}/tree")
async def get_tree(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(db, user, session_id)
    key = cache_key("fix:tree:v1", {"repo": session.upstream_repo, "sha": session.base_sha})
    cached = await get_json(key)
    if cached is not None:
        return cached
    entries = await fetch_repo_tree_full(
        user.access_token, session.upstream_repo, session.base_sha
    )
    blobs = [e for e in entries if e["type"] == "blob"]
    payload = {"paths": blobs}
    await set_json(key, payload, 60 * 60)
    return payload


# ---------------------------------------------------------------------------
# submit / rebase / abandon
# ---------------------------------------------------------------------------


@router.post("/fix/{session_id}/submit")
async def submit(
    session_id: int,
    body: SubmitBody = Body(default_factory=SubmitBody),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(db, user, session_id)
    if session.state == "pr_opened":
        return {
            "pr_url": session.pr_url,
            "pr_number": session.pr_number,
            "branch_name": session.branch_name,
            "fork_full_name": session.fork_full_name,
            "already_open": True,
        }
    if session.state != "draft":
        raise HTTPException(409, f"Session state is {session.state}, cannot submit")

    modified = [
        f for f in session.files
        if f.draft_text is not None and f.draft_text != f.original_text
    ]
    if not modified:
        raise HTTPException(400, "No edits to submit")

    # Freshness check — upstream may have moved while user was editing.
    head = await fetch_default_branch_head(user.access_token, session.upstream_repo)
    if head["sha"] != session.base_sha:
        # Check which of the edited files actually changed upstream.
        drifted: list[str] = []
        for f in modified:
            try:
                current = await fetch_file_contents(
                    user.access_token, session.upstream_repo, f.path, ref=head["sha"]
                )
            except GitHubWriteError:
                drifted.append(f.path)
                continue
            if current["sha"] != f.original_blob_sha:
                drifted.append(f.path)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "conflict": "base_sha_drift",
                "new_base_sha": head["sha"],
                "files_changed_upstream": drifted,
            },
        )

    session.state = "submitting"
    db.commit()

    try:
        fork = await ensure_fork(
            user.access_token, session.upstream_repo, user.github_login
        )
        if not fork["ready"]:
            session.state = "draft"
            db.commit()
            raise HTTPException(
                503, "Fork is still being created by GitHub. Try again in ~30s."
            )
        session.fork_full_name = fork["full_name"]
        db.commit()

        # Build blobs + tree + commit on the fork, pointed at upstream base_sha.
        entries: list[dict[str, str]] = []
        for f in modified:
            blob_sha = await create_blob(
                user.access_token, fork["full_name"], f.draft_text or ""
            )
            entries.append(
                {"path": f.path, "mode": "100644", "type": "blob", "sha": blob_sha}
            )

        understanding = await _load_understanding(
            db, session.issue_id, user.access_token
        )
        diffs = [
            _unified_diff(f.path, f.original_text, f.draft_text or "") for f in modified
        ]
        draft = _summarize_for_coach(understanding, session, modified, diffs)
        coach = await coach_pr(db, session.issue_id, user.access_token, draft)

        commit_message = coach["commit_title"]
        if coach.get("commit_body"):
            commit_message = f"{commit_message}\n\n{coach['commit_body']}"

        tree_sha = await create_tree(
            user.access_token, fork["full_name"], session.base_sha, entries
        )
        commit_sha = await create_commit(
            user.access_token,
            fork["full_name"],
            commit_message,
            tree_sha,
            session.base_sha,
        )
        branch_name = session.branch_name or f"osh/fix-{session.id}"
        await create_or_update_ref(
            user.access_token, fork["full_name"], branch_name, commit_sha
        )
        session.branch_name = branch_name
        db.commit()

        pr_title = (body.pr_title or coach["pr_title"]).strip()
        pr_body_raw = body.pr_body or coach["pr_body"]
        pr_body_final = append_ai_disclosure(pr_body_raw)

        pr = await create_pull_request(
            user.access_token,
            upstream=session.upstream_repo,
            head=f"{user.github_login}:{branch_name}",
            base=session.upstream_default_branch,
            title=pr_title,
            body=pr_body_final,
        )
        session.pr_url = pr["url"]
        session.pr_number = pr["number"]
        session.state = "pr_opened"
        session.last_error = None
        db.commit()

        return {
            "pr_url": pr["url"],
            "pr_number": pr["number"],
            "branch_name": branch_name,
            "fork_full_name": fork["full_name"],
        }
    except ForkNameCollision as exc:
        session.state = "failed"
        session.last_error = str(exc)
        db.commit()
        raise HTTPException(409, str(exc)) from exc
    except GitHubWriteError as exc:
        session.state = "failed"
        session.last_error = str(exc)
        db.commit()
        code = exc.status if exc.status in (401, 403, 404, 409, 422, 429) else 502
        raise HTTPException(code, str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        session.state = "failed"
        session.last_error = f"{type(exc).__name__}: {exc}"
        db.commit()
        raise


@router.post("/fix/{session_id}/rebase")
async def rebase(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(db, user, session_id)
    if session.state not in ("draft", "failed"):
        raise HTTPException(409, f"Cannot rebase from state {session.state}")

    head = await fetch_default_branch_head(user.access_token, session.upstream_repo)
    conflicts: list[dict[str, Any]] = []

    for f in session.files:
        try:
            current = await fetch_file_contents(
                user.access_token, session.upstream_repo, f.path, ref=head["sha"]
            )
        except GitHubWriteError:
            conflicts.append({"path": f.path, "kind": "upstream_deleted"})
            continue

        if current["is_binary"] or current["text"] is None:
            conflicts.append({"path": f.path, "kind": "became_binary"})
            continue

        if current["sha"] == f.original_blob_sha:
            # Upstream hasn't touched this file since session start.
            continue

        if f.draft_text is None or f.draft_text == f.original_text:
            # User hadn't edited it — auto-update to new upstream.
            f.original_blob_sha = current["sha"]
            f.original_text = current["text"]
            f.size_bytes = current["size"]
            conflicts.append({"path": f.path, "kind": "auto_updated"})
        else:
            # Both sides moved — user must reconcile.
            conflicts.append(
                {
                    "path": f.path,
                    "kind": "both_changed",
                    "new_original_text": current["text"],
                    "new_original_blob_sha": current["sha"],
                }
            )

    session.base_sha = head["sha"]
    session.upstream_default_branch = head["branch"]
    session.state = "draft"
    session.last_error = None
    db.commit()

    return {
        "new_base_sha": head["sha"],
        "default_branch": head["branch"],
        "conflicts": conflicts,
    }


@router.post("/fix/{session_id}/abandon")
def abandon(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(db, user, session_id)
    session.state = "abandoned"
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# accept-proposal helper (frontend can apply client-side OR call this)
# ---------------------------------------------------------------------------


@router.post("/fix/{session_id}/files/{file_id}/apply-proposal")
def apply_proposal_endpoint(
    session_id: int,
    file_id: int,
    proposal: dict[str, Any] = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Server-side application of a code_fix proposal.

    Frontend can accept proposals client-side and PUT the result instead; this
    endpoint is a convenience for the 'accept whole' button and for
    range_replace where the stitching logic is already on the server.
    """
    session, fix_file = _get_owned_file(db, user, session_id, file_id)
    if session.state != "draft":
        raise HTTPException(409, "Session is not editable")

    base_text = fix_file.draft_text if fix_file.draft_text is not None else fix_file.original_text
    new_text = apply_proposal(base_text, proposal)
    if new_text is None:
        return _file_meta(fix_file)
    if len(new_text.encode("utf-8", "ignore")) > MAX_EDITABLE_FILE_BYTES:
        raise HTTPException(422, "Proposal exceeds 500KB limit")
    fix_file.draft_text = new_text
    fix_file.is_ai_assisted = True
    if proposal.get("summary_of_change"):
        fix_file.ai_summary_of_change = str(proposal["summary_of_change"])[:120]
    db.commit()
    db.refresh(fix_file)
    return _file_meta(fix_file)
