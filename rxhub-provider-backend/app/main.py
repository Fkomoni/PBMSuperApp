import json
import logging
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import admin, auth, debug, lookup, medications, pharmacies, requests
from app.core.config import settings
from app.core.db import init_db
from app.core.limiter import limiter

_STATIC_DIR = Path(__file__).parent / "static"

BUILD_MARKER = "rxhub-api @ security-hardened + email-logo 2026-04-21"

# Fields whose values must never appear in server-side logs.
_SENSITIVE_FIELDS = re.compile(
    r'"(password|token|secret|key|authorization|auth|credential)[^"]*"\s*:\s*"[^"]*"',
    re.IGNORECASE,
)


def _scrub(body: str) -> str:
    """Replace values of sensitive JSON fields with REDACTED."""
    return _SENSITIVE_FIELDS.sub(lambda m: m.group(0).rsplit(":", 1)[0] + ': "***REDACTED***"', body)


_MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MB global request size limit


class _RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose declared Content-Length exceeds the hard limit."""
    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl and int(cl) > _MAX_BODY_BYTES:
            return Response(
                content='{"detail":"Request body too large"}',
                status_code=413,
                media_type="application/json",
            )
        return await call_next(request)


class _SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add defence-in-depth HTTP security headers to every response."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        # Skip the lock-down CSP for the brand logo route so email clients
        # can still render the image from a plain <img src="...">.  Every
        # other path keeps the strict 'none' policy.
        if not request.url.path.startswith(("/brand/", "/static/")):
            response.headers["Content-Security-Policy"] = "default-src 'none'"
        # Disable sensitive browser features — this is a backend API, not a page.
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # Block legacy Flash/PDF cross-domain requests.
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail hard in production if insecure defaults are still in place.
    settings.validate_secrets()
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
    is_prod = settings.environment == "production"
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        # Suppress interactive API docs in production — they expose the full
        # endpoint inventory and schema to unauthenticated callers.
        docs_url=None if is_prod else "/docs",
        redoc_url=None if is_prod else "/redoc",
        openapi_url=None if is_prod else "/openapi.json",
    )

    # Reject oversized requests before they reach any handler.
    app.add_middleware(_RequestSizeLimitMiddleware)
    # Security headers on every response.
    app.add_middleware(_SecurityHeadersMiddleware)

    # Attach the rate-limiter state and its 429 error handler.
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    origins = [o.strip() for o in (settings.cors_origins or "").split(",") if o.strip()]
    use_wildcard = not origins or origins == ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if use_wildcard else origins,
        # allow_credentials MUST be False when allow_origins is "*" — the CORS
        # spec forbids the combination and browsers will refuse the response.
        allow_credentials=not use_wildcard,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )

    # Log Pydantic validation errors with a body snippet so we can see
    # exactly which field tripped the 422 on /medication-requests, etc.
    vlogger = logging.getLogger("rxhub.validation")

    @app.exception_handler(RequestValidationError)
    async def _log_validation_error(request: Request, exc: RequestValidationError):
        try:
            body_bytes = await request.body()
            # Scrub sensitive field values (password, token, key, etc.) before
            # writing to the log — the raw body is never sent back to the caller.
            raw = body_bytes.decode("utf-8", errors="replace")[:4000]
            body_snippet = _scrub(raw)
        except Exception:
            body_snippet = "(body unavailable)"
        vlogger.warning("422 on %s %s · errors=%s · body=%s",
                        request.method, request.url.path,
                        json.dumps(exc.errors(), default=str)[:1500],
                        body_snippet)
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

    # Debug router is admin-gated AND suppressed entirely in production so
    # no diagnostic surface (PHI lookups, token refresh, email probes) is
    # reachable on live infrastructure even if a misconfigured JWT secret
    # were somehow exploited.
    if settings.environment != "production":
        app.include_router(debug.router, prefix=settings.api_prefix)

    if _STATIC_DIR.is_dir():
        app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

    @app.get("/brand/leadway-logo.jpg", include_in_schema=False)
    async def brand_logo():
        """Stable, short-URL alias for the Leadway logo — email clients
        prefer compact paths, and this gives us a stable URL to embed in
        every confirmation email regardless of hosting layout changes.
        """
        path = _STATIC_DIR / "leadway-logo.jpg"
        if not path.is_file():
            return JSONResponse(status_code=404, content={"detail": "logo missing"})
        return FileResponse(
            path, media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    @app.get("/")
    async def root():
        return {"app": settings.app_name, "status": "ok"}

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
