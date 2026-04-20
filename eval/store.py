"""SQLite store for the eval harness.

Two responsibilities:
  - Read the `agent_calls` table that backend writes via
    `app.services.eval_log` (schema is created there on first write).
  - Own the `study_runs` / `study_predictions` tables that this harness
    populates as it scores models against ground truth.

Both tables live in the same SQLite file so a study run can join its
predictions against the agent calls that produced them.
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

DEFAULT_DB_PATH = Path(
    os.environ.get(
        "EVAL_DB_PATH",
        Path(__file__).resolve().parent / "results" / "eval.sqlite",
    )
)

_STUDY_SCHEMA = """
CREATE TABLE IF NOT EXISTS study_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          REAL NOT NULL,
    name        TEXT NOT NULL,
    config_json TEXT,
    metrics     TEXT
);

CREATE TABLE IF NOT EXISTS study_predictions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      INTEGER NOT NULL REFERENCES study_runs(id) ON DELETE CASCADE,
    user_login  TEXT    NOT NULL,
    rank        INTEGER NOT NULL,
    issue_url   TEXT,
    score       REAL,
    is_match    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pred_run ON study_predictions(run_id);
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
            con.executescript(_STUDY_SCHEMA)
        _initialized.add(key)


@contextmanager
def connect(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    p = Path(path) if path else DEFAULT_DB_PATH
    _ensure_db(p)
    con = sqlite3.connect(p, timeout=10.0)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def start_run(name: str, config: dict[str, Any], db_path: Path | None = None) -> int:
    with connect(db_path) as con:
        cur = con.execute(
            "INSERT INTO study_runs (ts, name, config_json) VALUES (?, ?, ?)",
            (time.time(), name, json.dumps(config)),
        )
        return int(cur.lastrowid or 0)


def finish_run(run_id: int, metrics: dict[str, Any], db_path: Path | None = None) -> None:
    with connect(db_path) as con:
        con.execute(
            "UPDATE study_runs SET metrics = ? WHERE id = ?",
            (json.dumps(metrics), run_id),
        )


def add_prediction(
    run_id: int,
    user_login: str,
    rank: int,
    issue_url: str | None,
    score: float | None,
    is_match: bool | None,
    db_path: Path | None = None,
) -> None:
    with connect(db_path) as con:
        con.execute(
            """
            INSERT INTO study_predictions (run_id, user_login, rank, issue_url, score, is_match)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                user_login,
                rank,
                issue_url,
                score,
                None if is_match is None else int(is_match),
            ),
        )
