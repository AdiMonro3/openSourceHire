import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.deps import get_current_user, get_db
from app.models import User

router = APIRouter(prefix="/auth/github", tags=["auth"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_USER_EMAILS_URL = "https://api.github.com/user/emails"

OAUTH_SCOPES = "read:user user:email public_repo"


@router.get("/login")
def github_login(request: Request, intent: str | None = None) -> RedirectResponse:
    settings = get_settings()
    if not settings.github_client_id:
        raise HTTPException(500, "GITHUB_CLIENT_ID not configured")
    state = secrets.token_urlsafe(24)
    request.session["oauth_state"] = state
    if intent in {"publish"}:
        request.session["oauth_intent"] = intent
    else:
        request.session.pop("oauth_intent", None)
    qs = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.github_oauth_callback_url,
            "scope": OAUTH_SCOPES,
            "state": state,
            "allow_signup": "true",
        }
    )
    return RedirectResponse(f"{GITHUB_AUTHORIZE_URL}?{qs}", status_code=status.HTTP_302_FOUND)


@router.get("/callback")
async def github_callback(
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    settings = get_settings()
    saved_state = request.session.pop("oauth_state", None)
    if not saved_state or not secrets.compare_digest(saved_state, state):
        raise HTTPException(400, "Invalid OAuth state")

    async with httpx.AsyncClient(timeout=15.0) as client:
        token_res = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_oauth_callback_url,
            },
            headers={"Accept": "application/json"},
        )
        token_res.raise_for_status()
        access_token = token_res.json().get("access_token")
        if not access_token:
            raise HTTPException(400, "GitHub did not return an access token")

        gh_headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        user_res = await client.get(GITHUB_USER_URL, headers=gh_headers)
        user_res.raise_for_status()
        gh = user_res.json()

        email = gh.get("email")
        if not email:
            emails_res = await client.get(GITHUB_USER_EMAILS_URL, headers=gh_headers)
            if emails_res.status_code == 200:
                primary = next(
                    (e for e in emails_res.json() if e.get("primary") and e.get("verified")),
                    None,
                )
                email = primary["email"] if primary else None

    user = db.query(User).filter_by(github_id=gh["id"]).one_or_none()
    if user is None:
        user = User(
            github_id=gh["id"],
            github_login=gh["login"],
            name=gh.get("name"),
            email=email,
            avatar_url=gh.get("avatar_url"),
            access_token=access_token,
        )
        db.add(user)
    else:
        user.github_login = gh["login"]
        user.name = gh.get("name") or user.name
        user.email = email or user.email
        user.avatar_url = gh.get("avatar_url") or user.avatar_url
        user.access_token = access_token
    db.commit()
    db.refresh(user)

    request.session["user_id"] = user.id
    intent = request.session.pop("oauth_intent", None)

    frontend_origin = settings.cors_origins_list[0] if settings.cors_origins_list else "/"
    landing = "/dashboard/portfolio?first=1" if intent == "publish" else "/dashboard"
    return RedirectResponse(f"{frontend_origin}{landing}", status_code=status.HTTP_302_FOUND)


@router.post("/logout")
def logout(request: Request) -> dict[str, bool]:
    request.session.clear()
    return {"ok": True}


cli_router = APIRouter(prefix="/auth/cli", tags=["auth"])


@cli_router.post("/token")
def issue_cli_token(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Generate (and overwrite) the user's CLI bearer token.

    Session-authenticated: the web app calls this from the profile page, so
    only the browser-logged-in user can mint a token for themselves. Calling
    again rotates the token — the old one stops working immediately.
    """
    token = "osh_" + secrets.token_urlsafe(32)
    user.api_token = token
    db.commit()
    return {"token": token}


@cli_router.delete("/token")
def revoke_cli_token(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    user.api_token = None
    db.commit()
    return {"ok": True}
