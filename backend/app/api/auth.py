import hmac
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.limiter import limiter
from app.core.passwords import hash_password, verify_password
from app.core.security import create_access_token, current_admin, current_provider, revoke_token
from app.models import Provider
from app.schemas.provider import LoginIn, LoginOut, ProviderOut, ProviderRegisterIn
from app.services import prognosis
from app.services.prognosis import PrognosisAuthError, PrognosisProvider

logger = logging.getLogger("rxhub.auth")
audit = logging.getLogger("rxhub.audit")

router = APIRouter(tags=["auth"])


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
        p.is_active = True
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

    # 1. Local DB (always cheap; never depends on Prognosis)
    p = db.scalar(select(Provider).where(Provider.email == email))
    if p and p.is_active and verify_password(body.password, p.password_hash):
        logger.info("login OK via local DB: %s (role=%s)", _mask_email(email), p.role)
        audit.info("event=login result=ok method=local actor=%s role=%s", _mask_email(email), p.role)
        return _mint(p)

    # 2. Prognosis (real providers)
    if settings.prognosis_base_url:
        try:
            pp = await prognosis.provider_login(email, body.password)
            p = _upsert_from_prognosis(db, pp)
            logger.info("login OK via Prognosis: %s", _mask_email(email))
            audit.info("event=login result=ok method=prognosis actor=%s", _mask_email(email))
            return _mint(p)
        except PrognosisAuthError as e:
            logger.warning("login Prognosis path failed for %s: %s", _mask_email(email), e)
            # Fall through to a uniform 401 so we don't leak whether
            # Prognosis was down vs bad creds to unauthed callers.

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
