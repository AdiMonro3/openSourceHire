"""Shared Claude client with prompt-caching helpers.

All agents must call Claude through this module so prompt-cache control,
model selection, and structured-output parsing stay consistent.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any, Literal

from anthropic import AsyncAnthropic
from anthropic.types import MessageParam, TextBlockParam

from app.config import get_settings

ModelTier = Literal["sonnet", "haiku"]


def _resolve_model(tier: ModelTier) -> str:
    s = get_settings()
    return s.llm_sonnet_model if tier == "sonnet" else s.llm_haiku_model


@lru_cache
def get_anthropic() -> AsyncAnthropic:
    """Returns an AsyncAnthropic client; if ANTHROPIC_BASE_URL is set, points
    the SDK at that gateway (z.ai GLM, self-hosted proxies, etc.)."""
    s = get_settings()
    kwargs: dict = {"api_key": s.anthropic_api_key}
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


async def call_claude(
    *,
    system: str | list[TextBlockParam],
    messages: list[MessageParam],
    tier: ModelTier = "sonnet",
    max_tokens: int = 2048,
    temperature: float = 0.2,
) -> str:
    client = get_anthropic()
    res = await client.messages.create(
        model=_resolve_model(tier),
        max_tokens=max_tokens,
        temperature=temperature,
        system=system if isinstance(system, list) else [{"type": "text", "text": system}],
        messages=messages,
    )
    parts = [b.text for b in res.content if getattr(b, "type", None) == "text"]
    return "".join(parts)


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
