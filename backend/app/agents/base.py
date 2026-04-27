"""Shared Claude client with prompt-caching helpers.

All agents must call Claude through this module so prompt-cache control,
model selection, structured-output parsing, and audit logging stay
consistent.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from functools import lru_cache
from typing import Any, Literal

from anthropic import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncAnthropic,
    RateLimitError,
)
from anthropic.types import MessageParam, TextBlockParam
from fastapi import HTTPException

from app.config import get_settings
from app.services.eval_log import log_agent_call

logger = logging.getLogger(__name__)

ModelTier = Literal["sonnet", "haiku"]


def _resolve_model(tier: ModelTier) -> str:
    s = get_settings()
    return s.llm_sonnet_model if tier == "sonnet" else s.llm_haiku_model


@lru_cache
def get_anthropic() -> AsyncAnthropic:
    """Returns an AsyncAnthropic client; if ANTHROPIC_BASE_URL is set, points
    the SDK at that gateway (z.ai GLM, self-hosted proxies, etc.).

    ``max_retries=5`` lets the SDK's built-in exponential back-off ride out
    transient upstream 429/5xx — helpful against third-party gateways that
    return short "service overloaded" bursts (e.g. z.ai code 1305).
    """
    s = get_settings()
    kwargs: dict = {"api_key": s.anthropic_api_key, "max_retries": 5}
    if s.anthropic_base_url:
        kwargs["base_url"] = s.anthropic_base_url
    return AsyncAnthropic(**kwargs)


def cached_text_block(text: str) -> TextBlockParam:
    """Wrap a long, repeated chunk (repo context, system prompt) so Claude caches it."""
    return {
        "type": "text",
        "text": text,
        "cache_control": {"type": "ephemeral"},
    }


def _hash_prompt(system: str | list[TextBlockParam], messages: list[MessageParam]) -> str:
    h = hashlib.sha256()
    if isinstance(system, str):
        h.update(system.encode("utf-8", "ignore"))
    else:
        for blk in system:
            h.update(blk.get("text", "").encode("utf-8", "ignore"))
    h.update(b"\x00")
    h.update(json.dumps(messages, sort_keys=True, default=str).encode("utf-8", "ignore"))
    return h.hexdigest()[:16]


async def call_claude(
    *,
    system: str | list[TextBlockParam],
    messages: list[MessageParam],
    tier: ModelTier = "sonnet",
    max_tokens: int = 2048,
    temperature: float = 0.2,
    agent: str = "unknown",
    user_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    client = get_anthropic()
    model = _resolve_model(tier)
    sys_param = system if isinstance(system, list) else [{"type": "text", "text": system}]
    prompt_hash = _hash_prompt(system, messages)

    started = time.perf_counter()
    error: str | None = None
    text = ""
    usage: Any = None
    try:
        res = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=sys_param,
            messages=messages,
        )
        parts = [b.text for b in res.content if getattr(b, "type", None) == "text"]
        text = "".join(parts)
        usage = getattr(res, "usage", None)
        return text
    except (RateLimitError, APITimeoutError, APIConnectionError) as e:
        error = f"{type(e).__name__}: {e}"
        logger.warning("Claude upstream unavailable (agent=%s tier=%s): %s", agent, tier, e)
        raise HTTPException(
            status_code=503,
            detail="AI service is temporarily overloaded. Please retry in a moment.",
        ) from e
    except APIStatusError as e:
        error = f"{type(e).__name__}: {e}"
        logger.warning(
            "Claude API error (agent=%s tier=%s status=%s): %s",
            agent, tier, getattr(e, "status_code", "?"), e,
        )
        if getattr(e, "status_code", 0) in (429, 502, 503, 504):
            raise HTTPException(
                status_code=503,
                detail="AI service is temporarily overloaded. Please retry in a moment.",
            ) from e
        raise
    except Exception as e:
        error = f"{type(e).__name__}: {e}"
        raise
    finally:
        latency_ms = int((time.perf_counter() - started) * 1000)
        log_agent_call(
            agent=agent,
            tier=tier,
            model=model,
            user_id=user_id,
            prompt_hash=prompt_hash,
            input_tokens=getattr(usage, "input_tokens", None),
            output_tokens=getattr(usage, "output_tokens", None),
            cache_read=getattr(usage, "cache_read_input_tokens", None),
            cache_write=getattr(usage, "cache_creation_input_tokens", None),
            latency_ms=latency_ms,
            output_text=text,
            metadata=metadata,
            error=error,
        )


_JSON_BLOCK = re.compile(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", re.DOTALL)


def parse_json(text: str) -> Any:
    """Extract JSON from a Claude response that may be wrapped in fences or prose."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = _JSON_BLOCK.search(text)
    if m:
        return json.loads(m.group(1))
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise ValueError(f"Could not parse JSON from Claude response: {text[:200]}")
