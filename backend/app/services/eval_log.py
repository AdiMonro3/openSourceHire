"""SQLite audit log for every Claude call.

Backend-side writer for the eval harness. The same DB file (path controlled
by `EVAL_DB_PATH`, defaulting to `<repo>/eval/results/eval.sqlite`) is read
by `eval/run_study.py` to compute metrics. Logging never raises — a broken
audit log must not break agent execution.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


def _default_db_path() -> Path:
    env = os.environ.get("EVAL_DB_PATH")
    if env:
        return Path(env)
    # backend/app/services/eval_log.py → repo root → eval/results/eval.sqlite
    repo_root = Path(__file__).resolve().parents[3]
    return repo_root / "eval" / "results" / "eval.sqlite"


_SCHEMA = """
CREATE TABLE IF NOT EXISTS agent_calls (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            REAL    NOT NULL,
    agent         TEXT    NOT NULL,
    tier          TEXT    NOT NULL,
    model         TEXT,
    user_id       INTEGER,
    prompt_hash   TEXT,
    input_tokens  INTEGER,
    output_tokens INTEGER,
    cache_read    INTEGER,
    cache_write   INTEGER,
    latency_ms    INTEGER,
    output_text   TEXT,
    metadata      TEXT,
    error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_calls_agent ON agent_calls(agent);
CREATE INDEX IF NOT EXISTS idx_agent_calls_user  ON agent_calls(user_id);
"""

_lock = threading.Lock()
_initialized: set[str] = set()


def _ensure_db(path: Path) -> None:
    key = str(path)
    if key in _initialized:
        return
    with _lock:
        if key in _initialized:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(path) as con:
            con.executescript(_SCHEMA)
        _initialized.add(key)


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    p = _default_db_path()
    _ensure_db(p)
    con = sqlite3.connect(p, timeout=10.0)
    try:
        yield con
        con.commit()
    finally:
        con.close()


def log_agent_call(
    *,
    agent: str,
    tier: str,
    model: str | None,
    user_id: int | None = None,
    prompt_hash: str = "",
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    cache_read: int | None = None,
    cache_write: int | None = None,
    latency_ms: int = 0,
    output_text: str | None = None,
    metadata: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    if os.environ.get("EVAL_LOG_DISABLED") == "1":
        return
    try:
        with _connect() as con:
            con.execute(
                """
                INSERT INTO agent_calls (
                    ts, agent, tier, model, user_id, prompt_hash,
                    input_tokens, output_tokens, cache_read, cache_write,
                    latency_ms, output_text, metadata, error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    time.time(),
                    agent,
                    tier,
                    model,
                    user_id,
                    prompt_hash,
                    input_tokens,
                    output_tokens,
                    cache_read,
                    cache_write,
                    latency_ms,
                    (output_text or "")[:20000],
                    json.dumps(metadata) if metadata else None,
                    error,
                ),
            )
    except Exception:
        # Logging is best-effort; never propagate.
        pass
