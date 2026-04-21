import hmac
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.passwords import hash_password, verify_password
from app.core.security import create_access_token, current_admin
from app.models import Provider
from app.schemas.provider import LoginIn, LoginOut, ProviderOut, ProviderRegisterIn
from app.services import prognosis
from app.services.prognosis import PrognosisAuthError, PrognosisProvider

logger = logging.getLogger("rxhub.auth")

router = APIRouter(tags=["auth"])


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
async def login(body: LoginIn, db: Session = Depends(get_db)):
    """Local-first provider login.

    1. If email+password match a local account (admin, PBM staff, or a
       cached provider), sign the user in. No Prognosis dependency here,
       so admins can always get in — even if Prognosis is down or the
       service-account headers are misconfigured.
    2. Otherwise, proxy to Prognosis Provider-Login (real providers).
       On success, we upsert a local `providers` row so subsequent logins
       can take the fast local path.
    """
    email = body.email.lower()
    logger.info("login attempt: %s", email)

    # 1. Local DB (always cheap; never depends on Prognosis)
    p = db.scalar(select(Provider).where(Provider.email == email))
    if p and p.is_active and verify_password(body.password, p.password_hash):
        logger.info("login OK via local DB: %s (role=%s)", email, p.role)
        return _mint(p)

    # 2. Prognosis (real providers)
    if settings.prognosis_base_url:
        try:
            pp = await prognosis.provider_login(email, body.password)
            p = _upsert_from_prognosis(db, pp)
            logger.info("login OK via Prognosis: %s", email)
            return _mint(p)
        except PrognosisAuthError as e:
            logger.warning("login Prognosis path failed for %s: %s", email, e)
            # Fall through to a uniform 401 so we don't leak whether
            # Prognosis was down vs bad creds to unauthed callers.

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")


@router.post("/providers/register", response_model=ProviderOut, status_code=status.HTTP_201_CREATED)
async def register(body: ProviderRegisterIn, db: Session = Depends(get_db), _admin: dict = Depends(current_admin)):
    """Create a local-only provider account. Admin-only.

    Real providers auto-provision on first Prognosis sign-in. Use this only
    to create PBM staff or break-glass admin accounts. Prefer seed_provider.py
    for the initial admin bootstrap.
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
async def session_exchange(body: ExchangeIn, db: Session = Depends(get_db)):
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
        if not hmac.compare_digest(body.parent_shared_secret, settings.embed_shared_secret):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad handoff secret")
        p = db.scalar(select(Provider).where(Provider.email == body.email.lower()))
        if not p or not p.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider — sign in once via Prognosis first")
        return _mint(p)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide prognosis_token or (email + parent_shared_secret)")
