from __future__ import annotations

import hashlib
import json
from typing import Any

import redis.asyncio as aioredis

from app.config import get_settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            get_settings().redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


def cache_key(namespace: str, payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str).encode()
    digest = hashlib.sha256(raw).hexdigest()[:24]
    return f"osh:{namespace}:{digest}"


async def get_json(key: str) -> Any | None:
    raw = await get_redis().get(key)
    return json.loads(raw) if raw else None


async def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    await get_redis().set(key, json.dumps(value, default=str), ex=ttl_seconds)
