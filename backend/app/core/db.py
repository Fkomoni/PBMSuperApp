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
    _bootstrap_admin()


def _bootstrap_admin() -> None:
    """If ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD are set, upsert
    that account with role=admin on every boot. Idempotent: creates the
    row on first run, resets password + ensures role=admin on later runs
    so the operator can recover access by just rotating the env var.
    """
    from app.core.config import settings
    from app.core.passwords import hash_password
    from app.models import Provider
    from sqlalchemy import select

    email = (settings.admin_bootstrap_email or "").strip().lower()
    password = settings.admin_bootstrap_password
    if not email or not password:
        return

    import logging as _l
    log = _l.getLogger("rxhub.boot")
    try:
        with SessionLocal() as db:
            existing = db.scalar(select(Provider).where(Provider.email == email))
            if existing:
                existing.role = "admin"
                existing.is_active = True
                existing.password_hash = hash_password(password)
                existing.name = existing.name or settings.admin_bootstrap_name
                log.info("BOOT  admin bootstrap: promoted %s to role=admin", email)
            else:
                db.add(Provider(
                    email=email,
                    name=settings.admin_bootstrap_name,
                    password_hash=hash_password(password),
                    role="admin",
                    is_active=True,
                ))
                log.info("BOOT  admin bootstrap: created %s with role=admin", email)
            db.commit()
    except Exception as e:  # never let a bootstrap glitch crash the app
        log.warning("BOOT  admin bootstrap failed: %s", e)


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
            ("pharmacy_code",   "VARCHAR(64)"),
            ("external_ref",            "VARCHAR(64)"),
            ("external_tracking_code",  "VARCHAR(64)"),
            ("external_status",         "VARCHAR(32)"),
            ("external_pharmacy_name",  "VARCHAR(255)"),
            ("external_synced_at",      "TIMESTAMP WITH TIME ZONE"),
        ]
        with engine.begin() as conn:
            for col, ddl in to_add:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE medication_requests ADD COLUMN {col} {ddl}"))
