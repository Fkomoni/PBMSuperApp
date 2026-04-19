from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, lookup, medications, requests
from app.core.config import settings
from app.core.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    origins = [o.strip() for o in (settings.cors_origins or "").split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(lookup.router, prefix=settings.api_prefix)
    app.include_router(medications.router, prefix=settings.api_prefix)
    app.include_router(requests.router, prefix=settings.api_prefix)

    @app.get("/")
    async def root():
        return {"app": settings.app_name, "env": settings.environment, "prefix": settings.api_prefix}

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
