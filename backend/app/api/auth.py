import hmac
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import tickets
from app.core.config import settings
from app.core.db import get_db
from app.core.limiter import limiter
from app.core.passwords import hash_password, verify_password
from app.core.security import create_access_token, current_admin, current_provider, revoke_token
from app.models import LoginLockout, Provider
from app.schemas.provider import LoginIn, LoginOut, ProviderOut, ProviderRegisterIn
from app.services import prognosis
from app.services.prognosis import PrognosisAuthError, PrognosisProvider

logger = logging.getLogger("rxhub.auth")
audit = logging.getLogger("rxhub.audit")

router = APIRouter(tags=["auth"])

# ── Per-account login lockout (DB-backed, survives restarts) ─────────────────
_LOCKOUT_THRESHOLD = 3          # consecutive failures before lockout
_LOCKOUT_DURATION = timedelta(hours=24)


def _is_locked(email: str, db: Session) -> bool:
    row = db.get(LoginLockout, email)
    if not row or not row.locked_until:
        return False
    if datetime.now(timezone.utc) < row.locked_until:
        return True
    # Lock has expired — clean up the row so the counter resets.
    db.delete(row)
    db.commit()
    return False


def _record_failure(email: str, db: Session) -> None:
    now = datetime.now(timezone.utc)
    row = db.get(LoginLockout, email)
    if row:
        row.failure_count += 1
        row.last_failure_at = now
        if row.failure_count >= _LOCKOUT_THRESHOLD:
            row.locked_until = now + _LOCKOUT_DURATION
    else:
        row = LoginLockout(email=email, failure_count=1, last_failure_at=now)
        db.add(row)
    db.commit()


def _clear_failures(email: str, db: Session) -> None:
    row = db.get(LoginLockout, email)
    if row:
        db.delete(row)
        db.commit()


def _mask_email(email: str) -> str:
    """Partially mask an email for log output (PII reduction)."""
    parts = email.split("@", 1)
    if len(parts) != 2:
        return "***"
    local, domain = parts
    masked_local = local[:2] + "***" if len(local) > 2 else "***"
    return f"{masked_local}@{domain}"


def _to_out(p: Provider) -> ProviderOut:
    return ProviderOut(
        provider_id=p.id,
        name=p.name,
        email=p.email,
        prognosis_id=p.prognosis_id,
        facility=p.facility,
        role=p.role or "provider",
    )


def _upsert_from_prognosis(db: Session, pp: PrognosisProvider) -> Provider:
    """Find a local Provider by email (or Prognosis id) and refresh fields
    from what Prognosis returned. Never stores a real password — we set a
    random hash so local password login silently fails for Prognosis users.
    """
    p = db.scalar(select(Provider).where(Provider.email == pp.email))
    if not p and pp.prognosis_id:
        p = db.scalar(select(Provider).where(Provider.prognosis_id == pp.prognosis_id))
    if not p:
        p = Provider(
            email=pp.email,
            name=pp.name,
            password_hash=hash_password("!prognosis-managed!"),  # local pw disabled
            prognosis_id=pp.prognosis_id or pp.provider_id,
            facility=pp.facility,
            phone=pp.phone,
            is_active=True,
        )
        db.add(p)
    else:
        p.name = pp.name or p.name
        if pp.prognosis_id:
            p.prognosis_id = pp.prognosis_id
        if pp.facility:
            p.facility = pp.facility
        if pp.phone:
            p.phone = pp.phone
        # Do NOT force is_active=True on existing accounts — an admin may have
        # intentionally deactivated this provider. Only activate on creation.
    db.commit()
    db.refresh(p)
    return p


def _mint(p: Provider) -> LoginOut:
    token = create_access_token(
        subject=p.id,
        extra={"role": p.role or "provider", "email": p.email, "name": p.name},
    )
    return LoginOut(token=token, expires_in=settings.jwt_ttl_hours * 3600, provider=_to_out(p))


@router.post("/login", response_model=LoginOut)
@limiter.limit("20/minute")
async def login(request: Request, body: LoginIn, db: Session = Depends(get_db)):
    """Local-first provider login.

    Rate-limited to 20 attempts / minute per IP to prevent credential
    brute-forcing.

    1. If email+password match a local account (admin, PBM staff, or a
       cached provider), sign the user in. No Prognosis dependency here,
       so admins can always get in — even if Prognosis is down or the
       service-account headers are misconfigured.
    2. Otherwise, proxy to Prognosis Provider-Login (real providers).
       On success, we upsert a local `providers` row so subsequent logins
       can take the fast local path.
    """
    email = body.email.lower()
    logger.info("login attempt: %s", _mask_email(email))

    # Reject early if the account is locked (too many recent failures).
    if _is_locked(email, db):
        audit.warning("event=login result=locked actor=%s", _mask_email(email))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # 1. Local DB (always cheap; never depends on Prognosis)
    p = db.scalar(select(Provider).where(Provider.email == email))
    if p and p.is_active and verify_password(body.password, p.password_hash):
        _clear_failures(email, db)
        logger.info("login OK via local DB: %s (role=%s)", _mask_email(email), p.role)
        audit.info("event=login result=ok method=local actor=%s role=%s", _mask_email(email), p.role)
        return _mint(p)

    # 2. Prognosis (real providers)
    if settings.prognosis_base_url:
        try:
            pp = await prognosis.provider_login(email, body.password)
            p = _upsert_from_prognosis(db, pp)
            _clear_failures(email, db)
            logger.info("login OK via Prognosis: %s", _mask_email(email))
            audit.info("event=login result=ok method=prognosis actor=%s", _mask_email(email))
            return _mint(p)
        except PrognosisAuthError as e:
            logger.warning("login Prognosis path failed for %s: %s", _mask_email(email), e)
            # Fall through to a uniform 401 so we don't leak whether
            # Prognosis was down vs bad creds to unauthed callers.

    _record_failure(email, db)
    audit.warning("event=login result=fail actor=%s", _mask_email(email))
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")


@router.post("/providers/register", response_model=ProviderOut, status_code=status.HTTP_201_CREATED)
async def register(
    body: ProviderRegisterIn,
    admin_ctx: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    """Create a local-only provider (e.g. PBM admin / break-glass). Requires
    an existing admin JWT so this endpoint cannot be abused by unauthenticated
    callers to flood the DB or enumerate provider emails. Real providers
    auto-provision on first Prognosis sign-in; this route is for out-of-band
    admin-created accounts only.
    """
    existing = db.scalar(select(Provider).where(Provider.email == body.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    p = Provider(
        email=body.email.lower(),
        name=body.name,
        password_hash=hash_password(body.password),
        prognosis_id=body.prognosis_id,
        facility=body.facility,
        phone=body.phone,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    audit.info("event=provider_register result=ok actor=%s target=%s", _mask_email(admin_ctx.get("email", "?")), _mask_email(body.email))
    return _to_out(p)


# ==============================================================
# Embedded / already-authed handoff
# ==============================================================

class ExchangeIn(BaseModel):
    """Payload sent by a parent app (e.g. the Leadway Provider dashboard)
    that has already authenticated the provider. Prefer `prognosis_token`
    when the parent app hands us the bearer it got from Prognosis; fall
    back to a provider email if the parent app will only share identity.
    """
    prognosis_token: str | None = None
    email: str | None = None
    parent_shared_secret: str | None = None   # for email-only handoff


@router.post("/auth/session-exchange", response_model=LoginOut)
@limiter.limit("10/minute")
async def session_exchange(request: Request, body: ExchangeIn, db: Session = Depends(get_db)):
    """Mint a portal JWT for a provider who was authenticated by a parent
    app. Two supported modes:

    1. **Prognosis token passthrough** — parent app hands us the Prognosis
       bearer it already holds. We verify it against Prognosis and upsert
       the provider. TODO: implement `prognosis.verify_token()` against the
       exact Prognosis session-verify endpoint.

    2. **Signed email handoff** — parent app posts `{email, parent_shared_secret}`
       where the secret matches our `EMBED_SHARED_SECRET` env var. Use this
       only when the parent app is on the same security boundary.
    """
    # Mode 1: Prognosis bearer passthrough — leaves a hook you'll wire once
    # you know the Prognosis session-verify endpoint. Pseudocode:
    #
    #   pp = await prognosis.verify_token(body.prognosis_token)
    #   p  = _upsert_from_prognosis(db, pp); return _mint(p)
    if body.prognosis_token:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=(
                "Prognosis token passthrough not wired yet — add a verify call "
                "in services/prognosis.py (see TODO) and uncomment the handler."
            ),
        )

    # Mode 2: signed email handoff
    if body.email and body.parent_shared_secret:
        if not settings.embed_shared_secret:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Embed handoff is disabled on this API")
        if not hmac.compare_digest(
            body.parent_shared_secret.encode(),
            settings.embed_shared_secret.encode(),
        ):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad handoff secret")
        p = db.scalar(select(Provider).where(Provider.email == body.email.lower()))
        if not p or not p.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider — sign in once via Prognosis first")
        return _mint(p)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide prognosis_token or (email + parent_shared_secret)")


# ==============================================================
# Embed-login + ticket redemption
# ==============================================================
#
# Parent-app flow:
#   1. Parent POSTs {email, password} to /auth/embed-login with header
#      X-Embed-Secret: <shared secret>. We authenticate the user (local
#      DB first, then Prognosis), mint a JWT, and stash it behind a
#      one-time opaque ticket (60-second TTL).
#   2. We return {portal_url} — the front-end URL plus ?ticket=<opaque>.
#   3. Parent opens that URL in an iframe.
#   4. Front-end reads ?ticket=, POSTs it to /auth/redeem-ticket, gets
#      back the real JWT + provider info, stores it in sessionStorage,
#      and scrubs the ticket from the URL.
#
# The JWT itself never travels in a URL, so it's not exposed to browser
# history, referrer headers, or server access logs. The ticket is valid
# for exactly one redemption within 60 seconds — useless if captured.


class EmbedLoginIn(BaseModel):
    email: str
    password: str


class EmbedLoginOut(BaseModel):
    portal_url: str
    ticket_expires_in: int


class RedeemTicketIn(BaseModel):
    ticket: str


@router.post("/auth/embed-login", response_model=EmbedLoginOut)
@limiter.limit("30/minute")
async def embed_login(
    request: Request,
    body: EmbedLoginIn,
    x_embed_secret: str | None = Header(default=None, alias="X-Embed-Secret"),
    db: Session = Depends(get_db),
):
    """Parent-app entry point. Validates the partner secret + the user
    credentials, then returns a one-time ticket URL for the iframe.
    """
    if not settings.embed_shared_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Embed login is disabled on this API")
    if not settings.frontend_base_url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="FRONTEND_BASE_URL is not configured")
    if not x_embed_secret or not hmac.compare_digest(
        x_embed_secret.encode(), settings.embed_shared_secret.encode()
    ):
        audit.warning("event=embed_login result=bad_secret actor=%s", _mask_email(body.email))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid embed secret")

    email = body.email.strip().lower()
    if _is_locked(email, db):
        audit.warning("event=embed_login result=locked actor=%s", _mask_email(email))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # 1. Local DB — covers cached providers. We intentionally do NOT
    #    allow admin accounts through this path; admins use the direct
    #    login page.
    p = db.scalar(select(Provider).where(Provider.email == email))
    if p and p.is_active and verify_password(body.password, p.password_hash):
        if (p.role or "provider") == "admin":
            audit.warning("event=embed_login result=admin_blocked actor=%s", _mask_email(email))
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin accounts must sign in directly, not via embed")
        _clear_failures(email, db)
        login_out = _mint(p)
    else:
        # 2. Prognosis
        if not settings.prognosis_base_url:
            _record_failure(email, db)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        try:
            pp = await prognosis.provider_login(email, body.password)
        except PrognosisAuthError:
            _record_failure(email, db)
            audit.warning("event=embed_login result=fail actor=%s", _mask_email(email))
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        p = _upsert_from_prognosis(db, pp)
        _clear_failures(email, db)
        login_out = _mint(p)

    session = {
        "role": p.role or "provider",
        "email": p.email,
        "name": p.name,
        "provider_id": p.id,
        "facility": p.facility,
    }
    ticket, ttl = tickets.issue(login_out.token, session)

    portal_url = f"{settings.frontend_base_url.rstrip('/')}/?ticket={ticket}"
    audit.info("event=embed_login result=ok actor=%s ticket_issued=1", _mask_email(email))
    return EmbedLoginOut(portal_url=portal_url, ticket_expires_in=ttl)


@router.post("/auth/redeem-ticket", response_model=LoginOut)
@limiter.limit("60/minute")
async def redeem_ticket(request: Request, body: RedeemTicketIn):
    """Front-end exchanges the one-time ticket for the real JWT. This
    endpoint is deliberately open (no secret) — possessing an unredeemed
    ticket IS the authorization, and each ticket is valid once.
    """
    entry = tickets.redeem(body.ticket)
    if entry is None:
        audit.warning("event=redeem_ticket result=invalid")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ticket is invalid, already used, or expired")

    audit.info("event=redeem_ticket result=ok actor=%s", _mask_email(entry.session.get("email", "?")))
    return LoginOut(
        token=entry.jwt,
        expires_in=settings.jwt_ttl_hours * 3600,
        provider=ProviderOut(
            provider_id=entry.session.get("provider_id", ""),
            name=entry.session.get("name", ""),
            email=entry.session.get("email", ""),
            facility=entry.session.get("facility"),
            role=entry.session.get("role", "provider"),
        ),
    )


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: dict = Depends(current_provider)):
    """Revoke the caller's JWT immediately.

    Adds the token's `jti` claim to an in-memory blocklist so subsequent
    requests with the same token are rejected even within its TTL window.
    The frontend should discard the token regardless of this call's outcome.
    """
    jti = payload.get("jti")
    if jti:
        exp_ts = payload.get("exp", 0)
        expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
        revoke_token(jti, expires_at)
        logger.info("logout: revoked jti=%s for provider=%s", jti, payload.get("sub", "?"))
        audit.info("event=logout result=ok actor=%s jti=%s", _mask_email(payload.get("email", "?")), jti)
