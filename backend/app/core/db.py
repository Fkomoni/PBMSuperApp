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
    _purge_forged_providers()
    _bootstrap_admin()


def _purge_forged_providers() -> None:
    """Remove provider rows created by the pre-fix Prognosis auth bug.

    Before the 2026-04-24 auth hardening, a 200-OK failure payload from
    Prognosis could make /login fabricate a provider from the submitted
    email. Those rows share two tells: no prognosis_id AND no real
    submissions tied to them. We delete only accounts that (a) are not
    admin, (b) have no prognosis_id, (c) have never submitted a request,
    AND (d) still hold the Prognosis-managed placeholder password hash.
    All four conditions together make the row safe to drop.
    """
    from sqlalchemy import delete, select
    from app.models import MedicationRequest, Provider

    import logging as _l
    log = _l.getLogger("rxhub.boot")
    try:
        with SessionLocal() as db:
            # Find candidates — non-admin, no Prognosis id, placeholder pw
            suspects = db.scalars(
                select(Provider).where(
                    Provider.role != "admin",
                    (Provider.prognosis_id.is_(None)) | (Provider.prognosis_id == ""),
                    Provider.password_hash.like("%!prognosis-managed!%"),
                )
            ).all()
            if not suspects:
                return
            # Only delete ones that haven't submitted anything real
            to_delete_ids: list[str] = []
            for p in suspects:
                used = db.scalar(
                    select(MedicationRequest.id).where(MedicationRequest.provider_id == p.id).limit(1)
                )
                if not used:
                    to_delete_ids.append(p.id)
            if not to_delete_ids:
                return
            db.execute(delete(Provider).where(Provider.id.in_(to_delete_ids)))
            db.commit()
            log.warning("BOOT  purged %d forged provider row(s) from pre-fix auth bug", len(to_delete_ids))
    except Exception as e:  # never fail boot over a cleanup glitch
        log.warning("BOOT  forged-provider purge skipped: %s", e)


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
                existing.name = existing.name or settings.admin_bootstrap_name
                # Only reset the password hash when the account was created by
                # Prognosis auto-provision (placeholder hash) — not on every boot.
                # This prevents an accidental env-var leak from immediately
                # cycling the admin password on the running instance.
                _placeholder = "!prognosis-managed!"
                if not existing.password_hash or _placeholder in existing.password_hash:
                    existing.password_hash = hash_password(password)
                    log.info("BOOT  admin bootstrap: promoted %s and set password", email)
                else:
                    log.info("BOOT  admin bootstrap: confirmed role=admin for %s (pw unchanged)", email)
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

    Security note: column names and DDL fragments are taken from the static
    allowlists below — never from external input.  The strict allowlist check
    in _safe_alter_column() prevents any future code path from accidentally
    interpolating attacker-controlled strings into a raw SQL statement.
    """
    from sqlalchemy import inspect, text

    insp = inspect(engine)

    # providers.role — default to 'provider' so existing rows keep signing in.
    cols = {c["name"] for c in insp.get_columns("providers")} if insp.has_table("providers") else set()
    if "role" not in cols and "providers" in insp.get_table_names():
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE providers ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'provider'"))

    # medication_requests — enrollee contact fields we added for WellaHealth.
    # Each entry: (column_name, ddl_fragment).  Both values come from this
    # static list; they are validated against an allowlist before use.
    if insp.has_table("medication_requests"):
        existing = {c["name"] for c in insp.get_columns("medication_requests")}
        to_add = [
            ("enrollee_phone",           "VARCHAR(32)"),
            ("enrollee_email",           "VARCHAR(255)"),
            ("enrollee_dob",             "VARCHAR(32)"),
            ("enrollee_gender",          "VARCHAR(16)"),
            ("enrollee_first_name",      "VARCHAR(128)"),
            ("enrollee_last_name",       "VARCHAR(128)"),
            ("urgency",                  "VARCHAR(16) NOT NULL DEFAULT 'routine'"),
            ("treating_doctor",          "VARCHAR(255)"),
            ("ref_code",                 "VARCHAR(32)"),
            ("pharmacy_code",            "VARCHAR(64)"),
            ("external_ref",             "VARCHAR(64)"),
            ("external_tracking_code",   "VARCHAR(64)"),
            ("external_pickup_code",     "VARCHAR(32)"),
            ("external_status",          "VARCHAR(32)"),
            ("external_pharmacy_name",   "VARCHAR(255)"),
            ("external_synced_at",       "TIMESTAMP WITH TIME ZONE"),
        ]
        # Build a strict allowlist from the static list above so the helper
        # will refuse to run if a column name or DDL fragment ever comes from
        # a non-static source.
        _allowed_cols = {col for col, _ in to_add}
        _allowed_ddls = {ddl for _, ddl in to_add}

        def _safe_alter_column(conn, table: str, col: str, ddl: str) -> None:
            if col not in _allowed_cols or ddl not in _allowed_ddls:
                raise ValueError(
                    f"Migration rejected: '{col}'/'{ddl}' not in the static allowlist. "
                    "Add the column to the to_add list explicitly."
                )
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))  # noqa: S608

        with engine.begin() as conn:
            for col, ddl in to_add:
                if col not in existing:
                    _safe_alter_column(conn, "medication_requests", col, ddl)
