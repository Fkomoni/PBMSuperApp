import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.routers import auth, enrollees, acute_orders, dashboard, riders, stock, claims, reports, audit

app = FastAPI(
    title="Leadway RxHub — PBM Portal API",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — explicit origins only, never wildcard in prod ──────────────────────
_raw = os.getenv("CORS_ORIGINS", "http://localhost:5174")
CORS_ORIGINS = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,         prefix="/api")
app.include_router(enrollees.router,    prefix="/api")
app.include_router(acute_orders.router, prefix="/api")
app.include_router(dashboard.router,    prefix="/api")
app.include_router(riders.router,       prefix="/api")
app.include_router(stock.router,        prefix="/api")
app.include_router(claims.router,       prefix="/api")
app.include_router(reports.router,      prefix="/api")
app.include_router(audit.router,        prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "service": "pbm", "env": settings.ENVIRONMENT}
