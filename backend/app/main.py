import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

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


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Baseline security response headers.

    CSP is intentionally restrictive for the API (which serves JSON, not
    HTML) so even an accidental HTML response can't exfiltrate via
    third-party hosts. The portal's static site hosts its own CSP.
    """

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "no-referrer")
        headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=(), payment=()",
        )
        headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        )
        # HSTS only makes sense over HTTPS — Render terminates TLS so this
        # is always correct in prod. In local dev browsers will ignore it.
        headers.setdefault(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains",
        )
        # Cache-Control: API responses carry PHI; never cache by default.
        headers.setdefault("Cache-Control", "no-store")
        return response


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(SecurityHeadersMiddleware)

    origins = [o.strip() for o in (settings.cors_origins or "").split(",") if o.strip()]
    # Never combine allow_origins=["*"] with allow_credentials=True (CORS spec
    # forbids it; also makes credential replay easier). If origins are
    # unspecified we *deny* cross-origin requests entirely — safer default.
    wildcard = origins == ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins and not wildcard else [],
        allow_origin_regex=None,
        allow_credentials=False if wildcard else True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
        max_age=600,
    )

    # Log Pydantic validation errors with a body snippet so we can see
    # exactly which field tripped the 422 on /medication-requests, etc.
    vlogger = logging.getLogger("rxhub.validation")

    @app.exception_handler(RequestValidationError)
    async def _log_validation_error(request: Request, exc: RequestValidationError):
        # Log only structured error locations — never the raw body, which may
        # carry PHI (enrollee name / DOB / address / meds). Never echo the
        # body back in the HTTP response either.
        vlogger.warning(
            "422 on %s %s · errors=%s",
            request.method,
            request.url.path,
            json.dumps(exc.errors(), default=str)[:1500],
        )
        return JSONResponse(status_code=422, content={"detail": exc.errors()})

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
