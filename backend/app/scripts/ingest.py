"""Cron entrypoint: refresh beginner-issue feed from curated seed repos.

Run periodically (every ~30m) via a system cron / Actions workflow:

    uv run python -m app.scripts.ingest [per_repo_limit]

Requires GITHUB_SERVICE_TOKEN in .env (a classic or fine-grained PAT with
public_repo read scope — no user scopes needed).
"""
from __future__ import annotations

import asyncio
import json
import sys

from app.config import get_settings
from app.db.session import SessionLocal
from app.services.ingestion import ingest_seed_repos


def main() -> None:
    settings = get_settings()
    token = settings.github_service_token
    if not token:
        sys.stderr.write(
            "error: GITHUB_SERVICE_TOKEN is not set. "
            "Add a PAT to .env before running ingestion.\n"
        )
        sys.exit(2)

    per_repo_limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30

    async def _run() -> dict:
        with SessionLocal() as db:
            return await ingest_seed_repos(db, token, per_repo_limit=per_repo_limit)

    stats = asyncio.run(_run())
    print(json.dumps(stats, indent=2, default=str))


if __name__ == "__main__":
    main()
