"""P2.3 hire-me inbound — public contact form + owner inbox.

POST /users/{username}/contact : unauthenticated; honeypot + Redis rate limit
  (3/hour/IP), stores a ContactMessage row, fires an email notification.
GET  /users/me/contacts        : authenticated; owner's inbox, newest first.
"""
from __future__ import annotations

import re
from html import escape

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import ContactMessage, User
from app.services.cache import get_redis
from app.services.email import send_email

router = APIRouter(tags=["contact"])

_RATE_LIMIT_MAX = 3
_RATE_LIMIT_WINDOW_SECS = 3600

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContactIn(BaseModel):
    from_name: str = Field(min_length=1, max_length=128)
    from_email: str = Field(min_length=3, max_length=254)
    from_company: str | None = Field(default=None, max_length=128)
    body: str = Field(min_length=20, max_length=4000)
    website: str | None = Field(default=None, max_length=256)  # honeypot

    @field_validator("from_email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _check_rate_limit(ip: str) -> None:
    key = f"osh:contact:rl:{ip}"
    redis = get_redis()
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, _RATE_LIMIT_WINDOW_SECS)
    if count > _RATE_LIMIT_MAX:
        raise HTTPException(429, "Too many messages — try again later")


def _render_email(msg: ContactMessage) -> str:
    company_line = (
        f"<p><strong>Company:</strong> {escape(msg.from_company)}</p>"
        if msg.from_company
        else ""
    )
    body_html = escape(msg.body).replace("\n", "<br/>")
    return f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px;">
  <h2 style="margin: 0 0 16px;">New message via OpenSourceHire</h2>
  <p style="color:#555;">Someone reached out from your public profile.</p>
  <div style="background:#f6f6f8;border-radius:12px;padding:16px 20px;margin:16px 0;">
    <p style="margin:0 0 8px;"><strong>From:</strong> {escape(msg.from_name)} &lt;{escape(msg.from_email)}&gt;</p>
    {company_line}
    <p style="margin:12px 0 4px;"><strong>Message:</strong></p>
    <p style="margin:0;line-height:1.5;">{body_html}</p>
  </div>
  <p style="font-size:12px;color:#888;">Reply directly to this email to respond to {escape(msg.from_name)}.</p>
</div>
""".strip()


@router.post("/users/{username}/contact", status_code=202)
async def send_contact(
    username: str,
    payload: ContactIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    if payload.website:
        # Honeypot tripped — pretend success so bots don't retry.
        return {"ok": True}

    # collapse suspicious whitespace runs, but keep user formatting otherwise
    if re.fullmatch(r"\s*", payload.body):
        raise HTTPException(400, "Message is empty")

    target = (
        db.query(User).filter(User.github_login.ilike(username)).one_or_none()
    )
    if target is None:
        raise HTTPException(404, "User not found")

    ip = _client_ip(request)
    await _check_rate_limit(ip)

    msg = ContactMessage(
        to_user_id=target.id,
        from_name=payload.from_name.strip(),
        from_email=payload.from_email,
        from_company=(payload.from_company or "").strip() or None,
        body=payload.body.strip(),
        ip=ip,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    if target.email:
        await send_email(
            to=target.email,
            subject=f"New message from {msg.from_name} via OpenSourceHire",
            html=_render_email(msg),
            reply_to=msg.from_email,
        )

    return {"ok": True}


@router.get("/users/me/contacts")
def list_contacts(
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    q = (
        db.query(ContactMessage)
        .filter(ContactMessage.to_user_id == user.id)
        .order_by(ContactMessage.created_at.desc())
    )
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "from_name": r.from_name,
                "from_email": r.from_email,
                "from_company": r.from_company,
                "body": r.body,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }
