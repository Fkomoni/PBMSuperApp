import uuid
from datetime import datetime, timedelta, timezone
from threading import Lock

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError

from app.core.config import settings

bearer = HTTPBearer(auto_error=False)

# ── Token revocation blocklist ────────────────────────────────────────────────
# In-memory dict keyed by jti → expiry. Suitable for single-instance deploys on
# Render free tier. Entries are pruned lazily on every revocation check so the
# dict stays bounded to at most (active_users × sessions) entries.
# LIMITATION: this blocklist is lost on process restart. Tokens revoked before a
# restart become valid again until their original JWT expiry. Mitigate by keeping
# jwt_ttl_hours short (≤8 h) and, for multi-instance production, replacing this
# with a Redis SET (e.g. redis.setex(jti, ttl_seconds, "1")).
_revoked: dict[str, datetime] = {}
_revoked_lock = Lock()


def _prune_revoked() -> None:
    now = datetime.now(timezone.utc)
    with _revoked_lock:
        expired = [jti for jti, exp in _revoked.items() if exp < now]
        for jti in expired:
            del _revoked[jti]


def revoke_token(jti: str, expires_at: datetime) -> None:
    _prune_revoked()
    with _revoked_lock:
        _revoked[jti] = expires_at


def _is_revoked(jti: str | None) -> bool:
    if not jti:
        return False
    _prune_revoked()
    with _revoked_lock:
        return jti in _revoked


# ── Token creation / decoding ─────────────────────────────────────────────────

def create_access_token(subject: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "jti": str(uuid.uuid4()),   # unique token id — used for revocation
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_ttl_hours)).timestamp()),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if _is_revoked(payload.get("jti")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    return payload


def _require_token(creds: HTTPAuthorizationCredentials | None) -> dict:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = decode_token(creds.credentials)
    if not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject")
    return payload


def current_provider(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    payload = _require_token(creds)
    # Admins can call every provider endpoint (e.g. to look at a member on
    # someone else's behalf); everyone else must be an actual provider.
    if payload.get("role") not in ("provider", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provider role required")
    return payload


def current_admin(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    payload = _require_token(creds)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return payload


def provider_id_from(payload: dict) -> str:
    return payload["sub"]
