import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import admin, auth, debug, lookup, medications, pharmacies, requests
from app.core.config import settings
from app.core.db import init_db

BUILD_MARKER = "rxhub-api @ security-hardened 2026-04-21"


class _SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger = logging.getLogger("rxhub.boot")
    logger.setLevel(logging.INFO)

    # Validate critical configuration at startup — fail fast rather than silently
    # minting tokens with a publicly known secret.
    _KNOWN_WEAK_SECRETS = {
        "change-me-in-prod",
        "change-me-in-local-dev-only-set-JWT_SECRET-in-production",
        "secret",
        "jwt_secret",
    }
    if settings.environment == "production" and settings.jwt_secret in _KNOWN_WEAK_SECRETS:
        raise RuntimeError(
            "JWT_SECRET is set to a known insecure default. "
            "Set JWT_SECRET to a cryptographically random value of at least 32 characters."
        )
    if settings.environment == "production" and len(settings.jwt_secret) < 32:
        raise RuntimeError(
            "JWT_SECRET must be at least 32 characters in production."
        )

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

    # ── Security headers on every response ──────────────────────────────
    app.add_middleware(_SecurityHeadersMiddleware)

    # ── CORS ─────────────────────────────────────────────────────────────
    # Parse the comma-separated CORS_ORIGINS env var. In local dev with an
    # empty value we allow localhost only; never fall back to "*".
    origins_raw = (settings.cors_origins or "").strip()
    if origins_raw and origins_raw != "*":
        origins = [o.strip() for o in origins_raw.split(",") if o.strip()]
    elif settings.environment != "production":
        # Local dev convenience: allow common localhost ports
        origins = ["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:3000"]
    else:
        # Production requires CORS_ORIGINS to be explicitly set
        raise RuntimeError(
            "CORS_ORIGINS must be set to a comma-separated list of allowed origins in production. "
            "Example: https://rxhub-provider-portal.onrender.com"
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )

    # ── Validation error handler (no body reflection) ─────────────────
    vlogger = logging.getLogger("rxhub.validation")

    @app.exception_handler(RequestValidationError)
    async def _log_validation_error(request: Request, exc: RequestValidationError):
        try:
            body_bytes = await request.body()
            body_snippet = body_bytes.decode("utf-8", errors="replace")[:4000]
        except Exception:
            body_snippet = "(body unavailable)"
        vlogger.warning("422 on %s %s · errors=%s · body=%s",
                        request.method, request.url.path,
                        json.dumps(exc.errors(), default=str)[:1500],
                        body_snippet)
        # Do NOT reflect the request body back — it may contain credentials
        # or sensitive patient data.
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

    # ── Debug router: excluded entirely in production ─────────────────
    # Even though every endpoint requires admin auth, there is no reason
    # to expose diagnostic tooling to the public internet in production.
    if settings.environment != "production":
        app.include_router(debug.router, prefix=settings.api_prefix)

    @app.get("/")
    async def root():
        return {"app": settings.app_name, "env": settings.environment, "prefix": settings.api_prefix}

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
