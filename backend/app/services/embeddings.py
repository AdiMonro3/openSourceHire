"""Embedding service (Voyage AI).

Voyage is Anthropic's first-party embedding recommendation. We use
`voyage-3` (1024 dim) with `input_type`: `"document"` for stored text
(issues, skill summaries) and `"query"` for retrieval-time user vectors —
the small latency the two-sided asymmetric embedding adds pays off in
retrieval quality.
"""
from __future__ import annotations

from typing import Literal

import httpx

from app.config import get_settings

EMBEDDING_DIM = 1024

VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"

InputType = Literal["document", "query"]


class VoyageError(RuntimeError):
    pass


async def embed_texts(
    texts: list[str],
    input_type: InputType = "document",
) -> list[list[float]]:
    if not texts:
        return []

    settings = get_settings()
    if not settings.voyage_api_key:
        raise VoyageError(
            "VOYAGE_API_KEY is not configured. Add it to .env before embedding."
        )

    # Voyage caps input at 128 items per request; chunk defensively.
    batches = [texts[i : i + 128] for i in range(0, len(texts), 128)]
    out: list[list[float]] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for batch in batches:
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
            if res.status_code != 200:
                raise VoyageError(
                    f"Voyage {res.status_code}: {res.text[:300]}"
                )
            payload = res.json()
            out.extend(item["embedding"] for item in payload["data"])
    return out


async def embed_text(text: str, input_type: InputType = "document") -> list[float]:
    vecs = await embed_texts([text], input_type=input_type)
    return vecs[0]
