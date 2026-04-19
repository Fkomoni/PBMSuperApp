"""SQLAlchemy engine + session. Uses SQLite by default (so the API runs without
external services), Postgres in production via DATABASE_URL.
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def _url() -> str:
    url = settings.database_url or "sqlite:///./rxhub.db"
    return url


engine_kwargs: dict = {"pool_pre_ping": True}
if _url().startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(_url(), **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401 — ensure models are imported so Base.metadata is populated

    Base.metadata.create_all(bind=engine)
