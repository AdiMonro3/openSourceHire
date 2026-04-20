"""Thin Resend wrapper used for P2.3 hire-me notifications.

No-ops (just logs) when RESEND_API_KEY is empty — local dev stays offline
without needing a real account.
"""
from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


async def send_email(
    *,
    to: str,
    subject: str,
    html: str,
    reply_to: str | None = None,
) -> bool:
    """Send an email via Resend. Returns True on success, False on no-op/failure.

    Never raises — email delivery is best-effort and should not break the
    request flow that triggered it.
    """
    settings = get_settings()
    if not settings.resend_api_key:
        logger.info(
            "Email no-op (RESEND_API_KEY empty): to=%s subject=%r", to, subject
        )
        return False

    payload: dict = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                _RESEND_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            )
        if resp.status_code >= 300:
            logger.warning("Resend %s: %s", resp.status_code, resp.text[:400])
            return False
        return True
    except Exception:
        logger.exception("Resend request failed")
        return False
