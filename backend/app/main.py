import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import admin, auth, debug, lookup, medications, requests
from app.core.config import settings
from app.core.db import init_db

# Unique per-build marker. Bump the string when you want the startup log
# to make the running commit unmistakable.
BUILD_MARKER = "rxhub-api @ debug-endpoints 2026-04-19"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger = logging.getLogger("rxhub.boot")
    logger.setLevel(logging.INFO)
    logger.info("=" * 60)
    logger.info("BOOT  %s", BUILD_MARKER)
    logger.info("BOOT  env=%s  prefix=%s  server_time=%s",
                settings.environment, settings.api_prefix, datetime.now(timezone.utc).isoformat())
    logger.info("BOOT  prognosis_base_url=%s  user_set=%s  pass_set=%s  override_set=%s",
                settings.prognosis_base_url,
                bool(settings.prognosis_username),
                bool(settings.prognosis_password),
                bool(settings.prognosis_auth_header))
    logger.info("=" * 60)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    # CORS — never silently fall back to "*". If the env var literally contains
    # "*" we allow all origins but disable credentials (browsers refuse the
    # combo anyway). Any other value is treated as a comma-separated allow-list.
    raw_origins = (settings.cors_origins or "").strip()
    if raw_origins == "*":
        allow_origins, allow_credentials = ["*"], False
    else:
        allow_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
        allow_credentials = bool(allow_origins)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Log Pydantic validation errors with a body snippet so we can see
    # exactly which field tripped the 422 on /medication-requests, etc.
    # Bodies for credential-carrying endpoints are never logged or echoed.
    vlogger = logging.getLogger("rxhub.validation")

    _SENSITIVE_PATHS = (
        "/login",
        "/providers/register",
        "/auth/session-exchange",
        "/_debug/prognosis/test-login",
    )

    @app.exception_handler(RequestValidationError)
    async def _log_validation_error(request: Request, exc: RequestValidationError):
        is_sensitive = any(p in request.url.path for p in _SENSITIVE_PATHS)
        if is_sensitive:
            vlogger.warning(
                "422 on %s %s · errors=%s · body=<redacted: credential-bearing path>",
                request.method, request.url.path,
                json.dumps(exc.errors(), default=str)[:1500],
            )
        else:
            try:
                body_bytes = await request.body()
                body_snippet = body_bytes.decode("utf-8", errors="replace")[:1000]
            except Exception:
                body_snippet = "(body unavailable)"
            vlogger.warning(
                "422 on %s %s · errors=%s · body=%s",
                request.method, request.url.path,
                json.dumps(exc.errors(), default=str)[:1500],
                body_snippet,
            )
        # Never echo the raw request body back to the client — it may contain
        # passwords / shared secrets / tokens that callers sent accidentally.
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors()},
        )

    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(lookup.router, prefix=settings.api_prefix)
    app.include_router(medications.router, prefix=settings.api_prefix)
    app.include_router(requests.router, prefix=settings.api_prefix)
    app.include_router(admin.router, prefix=settings.api_prefix)
    app.include_router(debug.router, prefix=settings.api_prefix)

    @app.get("/")
    async def root():
        return {"app": settings.app_name, "env": settings.environment, "prefix": settings.api_prefix}

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
