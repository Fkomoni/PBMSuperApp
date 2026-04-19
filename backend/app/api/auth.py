import hashlib
import hmac
import logging
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import _is_production, settings
from app.core.db import get_db
from app.core.passwords import hash_password, verify_password
from app.core.rate_limit import check_and_consume, reset as reset_rate_limit
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


def _disabled_local_password_hash() -> str:
    """Produce a bcrypt hash the local /login path can never match.

    Previous implementation hashed the literal string
    ``"!prognosis-managed!"`` — which meant anyone typing that literal as
    the password would authenticate as ANY Prognosis-provisioned provider.
    We now hash a cryptographically random secret per row and throw it
    away, so local password verify always returns False for these rows.
    """
    return hash_password(secrets.token_urlsafe(64))


def _upsert_from_prognosis(db: Session, pp: PrognosisProvider) -> Provider:
    """Find a local Provider by email (or Prognosis id) and refresh fields
    from what Prognosis returned. Never stores a real password — we set a
    per-row random hash so local password login can never match for rows
    that should be authenticated by Prognosis.
    """
    p = db.scalar(select(Provider).where(Provider.email == pp.email))
    if not p and pp.prognosis_id:
        p = db.scalar(select(Provider).where(Provider.prognosis_id == pp.prognosis_id))
    if not p:
        p = Provider(
            email=pp.email,
            name=pp.name,
            password_hash=_disabled_local_password_hash(),
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
        # Re-randomize the disabled-login sentinel so even previously
        # seeded rows (with the old well-known "!prognosis-managed!"
        # hash) stop accepting that literal as a password on next sign-in.
        if p.password_hash and verify_password("!prognosis-managed!", p.password_hash):
            p.password_hash = _disabled_local_password_hash()
    db.commit()
    db.refresh(p)
    return p


def _mint(p: Provider) -> LoginOut:
    token = create_access_token(
        subject=p.id,
        extra={"role": p.role or "provider", "email": p.email, "name": p.name},
    )
    return LoginOut(token=token, expires_in=settings.jwt_ttl_hours * 3600, provider=_to_out(p))


def _client_ip(request: Request) -> str:
    if not request.client:
        return "unknown"
    # Prefer X-Forwarded-For when running behind Render's load balancer, but
    # only trust the first hop; anything else would let attackers spoof keys.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
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
    ip = _client_ip(request)

    # Rate limit per-IP and per-email (email limit also protects against
    # credential spraying that rotates source IPs).
    ok_ip, retry_ip = check_and_consume(f"login:ip:{ip}", limit=20, window_seconds=60)
    ok_email, retry_email = check_and_consume(f"login:email:{email}", limit=10, window_seconds=300)
    if not (ok_ip and ok_email):
        retry = max(retry_ip, retry_email)
        logger.warning(
            "login rate-limited ip=%s email-hash=%s retry=%ds",
            ip, hashlib.sha256(email.encode()).hexdigest()[:10], retry,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in attempts. Please wait and try again.",
            headers={"Retry-After": str(retry)},
        )
    logger.info("login attempt: email-hash=%s", hashlib.sha256(email.encode()).hexdigest()[:10])

    # 1. Local DB (always cheap; never depends on Prognosis)
    p = db.scalar(select(Provider).where(Provider.email == email))
    # Constant-time behavior: always run bcrypt verify, even when the
    # email is unknown, so an attacker can't distinguish "no such user"
    # from "wrong password" by response latency.
    candidate_hash = p.password_hash if p else _DUMMY_BCRYPT_HASH
    pw_ok = verify_password(body.password, candidate_hash)
    if p and p.is_active and pw_ok:
        reset_rate_limit(f"login:email:{email}")
        logger.info("login OK via local DB")
        return _mint(p)

    # 2. Prognosis (real providers)
    if settings.prognosis_base_url:
        try:
            pp = await prognosis.provider_login(email, body.password)
            # Defense in depth: bind the resulting account to the email the
            # user typed. If Prognosis echoes a different email we refuse,
            # so a compromised Prognosis response can't pivot us onto a
            # different provider row.
            if pp.email and pp.email.strip().lower() != email:
                logger.warning("Prognosis email mismatch — refusing")
                raise PrognosisAuthError("email mismatch")
            p = _upsert_from_prognosis(db, pp)
            reset_rate_limit(f"login:email:{email}")
            logger.info("login OK via Prognosis")
            return _mint(p)
        except PrognosisAuthError:
            # Uniform 401 below — never leak Prognosis error text (it can
            # distinguish "no such user" from "wrong password", which aids
            # account enumeration).
            logger.warning("Prognosis auth path failed")

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")


# Fixed dummy bcrypt hash (computed once at import) used to keep the
# wrong-email code path timing-equivalent to the wrong-password path.
# Not used for any real authentication — just passed to verify_password.
_DUMMY_BCRYPT_HASH = hash_password(secrets.token_urlsafe(24))


_optional_bearer = HTTPBearer(auto_error=False)


def _registration_guard(
    creds: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    db: Session = Depends(get_db),
) -> None:
    """Gate `/providers/register`:
      * local dev              — open, to bootstrap the first account
      * any other environment  — admin-only JWT required, and only if at
        least one admin already exists (break-glass for the first admin is
        `seed_provider.py` run on the server's shell)

    This prevents public self-registration from minting working provider
    accounts that can then hit PHI-returning endpoints.
    """
    if not _is_production(settings.environment) and settings.environment.strip().lower() in ("local", "dev", "development", ""):
        return None
    # Production-ish: must be an authenticated admin.
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin bearer token required")
    # Reuse current_admin by hand to avoid a chained-dep import cycle at import time.
    from app.core.security import _require_token, _assert_active  # noqa: SLF001
    payload = _require_token(creds)
    _assert_active(payload, db)
    role = payload.get("_db_role") or payload.get("role")
    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")


@router.post(
    "/providers/register",
    response_model=ProviderOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_registration_guard)],
)
async def register(body: ProviderRegisterIn, db: Session = Depends(get_db)):
    """Create a local provider account. Admin-only in non-local environments.
    Real providers should authenticate via Prognosis, which auto-provisions
    a row on first sign-in; this route exists for PBM admin / break-glass.
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
    that has already authenticated the provider.

    The email-handoff mode requires a short-lived HMAC signature rather
    than a static shared secret: the parent app computes
        sig = hex(HMAC-SHA256(EMBED_SHARED_SECRET, f"{email}|{issued_at}|{nonce}"))
    so leaking a single exchange payload doesn't let an attacker mint
    future tokens, and we can enforce replay protection server-side.
    """
    prognosis_token: str | None = None
    email: str | None = None
    issued_at: int | None = Field(default=None, description="Unix timestamp when the signature was produced")
    nonce: str | None = Field(default=None, min_length=8, max_length=128)
    signature: str | None = Field(default=None, min_length=16, max_length=256)


_HANDOFF_REPLAY_WINDOW_SECONDS = 120
_recent_handoff_nonces: dict[str, float] = {}


def _prune_nonces(now: float) -> None:
    cutoff = now - _HANDOFF_REPLAY_WINDOW_SECONDS * 2
    stale = [k for k, v in _recent_handoff_nonces.items() if v < cutoff]
    for k in stale:
        _recent_handoff_nonces.pop(k, None)


def _verify_handoff_signature(email: str, issued_at: int, nonce: str, signature: str) -> bool:
    """Constant-time check of the HMAC-SHA256 signature over email|issued_at|nonce.
    Replay protection: reject if issued_at is outside the window or if we've
    already accepted the nonce within the window.
    """
    if not settings.embed_shared_secret:
        return False
    now = time.time()
    if abs(now - int(issued_at)) > _HANDOFF_REPLAY_WINDOW_SECONDS:
        return False
    mac = hmac.new(
        settings.embed_shared_secret.encode(),
        f"{email}|{issued_at}|{nonce}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(mac, signature):
        return False
    # Reject replays
    _prune_nonces(now)
    if nonce in _recent_handoff_nonces:
        return False
    _recent_handoff_nonces[nonce] = now
    return True


@router.post("/auth/session-exchange", response_model=LoginOut)
async def session_exchange(body: ExchangeIn, request: Request, db: Session = Depends(get_db)):
    ok, retry = check_and_consume(
        f"exchange:ip:{_client_ip(request)}", limit=30, window_seconds=60
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many handoff attempts",
            headers={"Retry-After": str(retry)},
        )
    return await _do_session_exchange(body, request, db)


async def _do_session_exchange(body: "ExchangeIn", request: Request, db: Session) -> LoginOut:
    """Mint a portal JWT for a provider authenticated by a parent app.

    1. **Prognosis token passthrough** — parent app hands us the Prognosis
       bearer it already holds. We would verify it against Prognosis and
       upsert the provider. Unwired; returns 501 until Prognosis provides
       a session-verify endpoint.

    2. **Signed email handoff** — parent app posts
           {email, issued_at, nonce, signature}
       with a fresh HMAC-SHA256 signature over `email|issued_at|nonce`
       using `EMBED_SHARED_SECRET`. Replay-protected.
    """
    if body.prognosis_token:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Prognosis token passthrough is not available on this API",
        )

    # Mode 2: signed email handoff
    if body.email and body.issued_at and body.nonce and body.signature:
        if not settings.embed_shared_secret:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Embed handoff is disabled on this API")
        email = body.email.strip().lower()
        if not _verify_handoff_signature(email, int(body.issued_at), body.nonce, body.signature):
            # Uniform 401 — don't leak which field failed.
            logger.warning(
                "Rejected handoff for %s from %s", email, request.client.host if request.client else "?"
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid handoff")
        p = db.scalar(select(Provider).where(Provider.email == email))
        if not p or not p.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider")
        return _mint(p)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Provide prognosis_token or (email + issued_at + nonce + signature)",
    )
