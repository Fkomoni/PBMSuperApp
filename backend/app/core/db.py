"""SQLAlchemy engine + session. Uses SQLite by default (so the API runs without
external services), Postgres in production via DATABASE_URL.
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def _url() -> str:
    """Return the SQLAlchemy-shaped DB URL.

    Render (and most Postgres providers) hand out URLs starting with
    `postgres://` or `postgresql://`. SQLAlchemy reads those as psycopg2,
    which we don't ship. We installed psycopg v3, so force the driver.
    Defaults to SQLite for local dev when DATABASE_URL is unset.
    """
    url = settings.database_url
    if not url:
        return "sqlite:///./rxhub.db"
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
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
    _run_migrations()


def _run_migrations() -> None:
    """Tiny idempotent SQL migrations for columns SQLAlchemy's create_all
    doesn't back-fill on existing tables. Keep each block safe to run every
    boot; prefer ALTER TABLE IF NOT EXISTS / try-except patterns.
    """
    from sqlalchemy import inspect, text

    insp = inspect(engine)

    # providers.role — default to 'provider' so existing rows keep signing in.
    cols = {c["name"] for c in insp.get_columns("providers")} if insp.has_table("providers") else set()
    if "role" not in cols and "providers" in insp.get_table_names():
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE providers ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'provider'"))

    # medication_requests — enrollee contact fields we added for WellaHealth.
    if insp.has_table("medication_requests"):
        existing = {c["name"] for c in insp.get_columns("medication_requests")}
        to_add = [
            ("enrollee_phone",  "VARCHAR(32)"),
            ("enrollee_email",  "VARCHAR(255)"),
            ("enrollee_dob",    "VARCHAR(32)"),
            ("enrollee_gender", "VARCHAR(16)"),
            ("enrollee_first_name", "VARCHAR(128)"),
            ("enrollee_last_name",  "VARCHAR(128)"),
            ("urgency",         "VARCHAR(16) NOT NULL DEFAULT 'routine'"),
            ("treating_doctor", "VARCHAR(255)"),
            ("ref_code",        "VARCHAR(32)"),
        ]
        with engine.begin() as conn:
            for col, ddl in to_add:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE medication_requests ADD COLUMN {col} {ddl}"))
