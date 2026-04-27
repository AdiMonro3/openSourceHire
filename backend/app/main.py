import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.routers import admin as admin_router
from app.routers import auth as auth_router
from app.routers import contact as contact_router
from app.routers import feed as feed_router
from app.routers import fix as fix_router
from app.routers import issues as issues_router
from app.routers import portfolio as portfolio_router
from app.routers import users as users_router

logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(title="OpenSourceHire API", version="0.0.1")

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    https_only=False,
    same_site="lax",
)
app.add_middleware(
    CORSMiddleware,
    # allow_origins=settings.cors_origins_list,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(auth_router.cli_router)
app.include_router(users_router.router)
app.include_router(portfolio_router.router)
app.include_router(contact_router.router)
app.include_router(feed_router.router)
app.include_router(issues_router.router)
app.include_router(fix_router.router)
app.include_router(admin_router.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all so upstream failures (Anthropic, Voyage, GitHub) surface as
    a JSON 500 with CORS headers — otherwise the browser reports a misleading
    CORS error instead of the real cause. CORSMiddleware does not wrap
    exception-handler responses automatically, so we attach the headers here.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    origin = request.headers.get("origin")
    headers: dict[str, str] = {}
    if origin and origin in ("http://localhost:3000",):
        headers["access-control-allow-origin"] = origin
        headers["access-control-allow-credentials"] = "true"
        headers["vary"] = "Origin"
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"},
        headers=headers,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
