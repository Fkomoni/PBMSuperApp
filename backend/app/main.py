import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import admin, auth, debug, lookup, medications, pharmacies, requests
from app.core.config import settings
from app.core.db import init_db
from app.core.limiter import limiter

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
    _prod = settings.environment == "production"
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        # Disable interactive API docs in production — they expose the full
        # endpoint surface and allow unauthenticated "Try it out" calls.
        docs_url=None if _prod else "/docs",
        redoc_url=None if _prod else "/redoc",
        openapi_url=None if _prod else "/openapi.json",
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    origins = [o.strip() for o in (settings.cors_origins or "").split(",") if o.strip()]
    # allow_credentials=True is incompatible with wildcard origins per the
    # Fetch spec. Only enable it when explicit origins are configured.
    is_wildcard = not origins or origins == ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=not is_wildcard,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Log Pydantic validation errors with a body snippet so we can see
    # exactly which field tripped the 422 on /medication-requests, etc.
    vlogger = logging.getLogger("rxhub.validation")

    @app.exception_handler(RequestValidationError)
    async def _log_validation_error(request: Request, exc: RequestValidationError):
        # Log only field locations and error types — never log values, which
        # may contain PHI (member name, DOB, phone, diagnoses, etc.).
        safe_errors = [{"loc": e.get("loc"), "type": e.get("type")} for e in exc.errors()]
        vlogger.warning("422 on %s %s · fields=%s",
                        request.method, request.url.path,
                        json.dumps(safe_errors, default=str))
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors()},
        )

    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(lookup.router, prefix=settings.api_prefix)
    app.include_router(medications.router, prefix=settings.api_prefix)
    app.include_router(pharmacies.router, prefix=settings.api_prefix)
    app.include_router(requests.router, prefix=settings.api_prefix)
    app.include_router(admin.router, prefix=settings.api_prefix)
    # Debug router is excluded entirely in production — even admin-gated
    # diagnostic endpoints have no place on a live service.
    if not _prod:
        app.include_router(debug.router, prefix=settings.api_prefix)

    @app.get("/")
    async def root():
        # Return minimal information in production to reduce reconnaissance surface.
        if _prod:
            return {"status": "ok"}
        return {"app": settings.app_name, "env": settings.environment, "prefix": settings.api_prefix}

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
