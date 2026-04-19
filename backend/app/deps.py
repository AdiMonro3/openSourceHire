from collections.abc import Generator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User


def _user_from_bearer(request: Request, db: Session) -> User | None:
    """Resolve the CLI via `Authorization: Bearer <api_token>`.

    Session cookies stay the primary auth for the web app; this path is
    only used by the `osh` CLI and any other non-browser clients.
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    if not token:
        return None
    return db.query(User).filter_by(api_token=token).one_or_none()


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    bearer_user = _user_from_bearer(request, db)
    if bearer_user is not None:
        return bearer_user
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Stale session")
    return user


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    bearer_user = _user_from_bearer(request, db)
    if bearer_user is not None:
        return bearer_user
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    return db.get(User, user_id)


__all__ = ["get_db", "get_current_user", "get_current_user_optional"]
