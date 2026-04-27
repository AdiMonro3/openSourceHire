"""Embedding service (Voyage AI).

Voyage is Anthropic's first-party embedding recommendation. We use
`voyage-3` (1024 dim) with `input_type`: `"document"` for stored text
(issues, skill summaries) and `"query"` for retrieval-time user vectors —
the small latency the two-sided asymmetric embedding adds pays off in
retrieval quality.

Rate-limit behaviour: the free tier is capped at 3 RPM. To keep the app
usable while billing is unresolved we (a) throttle to one HTTP call per
``_MIN_INTERVAL`` globally, (b) widen the gate for ``_BACKOFF_AFTER_429``
after a 429, and (c) return ``[]`` instead of raising so callers can skip
the affected work. Every failure is logged at WARNING.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Literal

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1024

VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"

InputType = Literal["document", "query"]

_MIN_INTERVAL = 0.4
_BACKOFF_AFTER_429 = 20.0
_throttle_lock = asyncio.Lock()
_next_allowed_ts: float = 0.0


class VoyageError(RuntimeError):
    pass


async def _throttle() -> None:
    """Global gate: at most one Voyage HTTP call per ``_MIN_INTERVAL``."""
    global _next_allowed_ts
    async with _throttle_lock:
        wait = _next_allowed_ts - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        _next_allowed_ts = time.monotonic() + _MIN_INTERVAL


async def embed_texts(
    texts: list[str],
    input_type: InputType = "document",
) -> list[list[float]]:
    """Embed ``texts``. Returns ``[]`` on any HTTP/network failure (logged)."""
    global _next_allowed_ts

    if not texts:
        return []

    settings = get_settings()
    if not settings.voyage_api_key:
        raise VoyageError(
            "VOYAGE_API_KEY is not configured. Add it to .env before embedding."
        )

    batches = [texts[i : i + 128] for i in range(0, len(texts), 128)]
    out: list[list[float]] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for batch in batches:
            await _throttle()
            try:
                res = await client.post(
                    VOYAGE_URL,
                    headers={
                        "Authorization": f"Bearer {settings.voyage_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "input": batch,
                        "model": settings.voyage_model,
                        "input_type": input_type,
                    },
                )
            except httpx.HTTPError as exc:
                logger.warning(
                    "Voyage embed failed: network error input_type=%s batch_size=%d err=%s",
                    input_type, len(batch), exc,
                )
                return []

            if res.status_code != 200:
                logger.warning(
                    "Voyage embed failed: status=%s input_type=%s batch_size=%d body=%s",
                    res.status_code, input_type, len(batch), res.text[:300],
                )
                if res.status_code == 429:
                    _next_allowed_ts = time.monotonic() + _BACKOFF_AFTER_429
                return []

            payload = res.json()
            out.extend(item["embedding"] for item in payload["data"])
    return out


async def embed_text(text: str, input_type: InputType = "document") -> list[float]:
    vecs = await embed_texts([text], input_type=input_type)
    return vecs[0] if vecs else []
