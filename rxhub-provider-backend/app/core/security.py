import logging
import uuid
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import TYPE_CHECKING

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError

from app.core.config import settings

bearer = HTTPBearer(auto_error=False)
_log = logging.getLogger("rxhub.security")

# ── Redis client (lazy, optional) ─────────────────────────────────────────────
# Initialised once on first use. If REDIS_URL is unset or Redis is unreachable,
# _redis() returns None and every operation falls back to the in-memory dict.
_redis_client = None
_redis_lock = Lock()


def _redis():
    global _redis_client
    if not settings.redis_url:
        return None
    with _redis_lock:
        if _redis_client is not None:
            return _redis_client
        try:
            import redis as _r
            client = _r.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_timeout=1.0,
                socket_connect_timeout=1.0,
            )
            client.ping()
            _redis_client = client
            _log.info("Redis revocation store connected: %s", settings.redis_url.split("@")[-1])
        except Exception as e:
            _log.warning("Redis unavailable — falling back to in-memory revocation: %s", e)
            _redis_client = None
    return _redis_client


# ── In-memory fallback ────────────────────────────────────────────────────────
# Used when Redis is not configured or temporarily unreachable. Lost on restart
# (8h TTL mitigates the window). Thread-safe via _mem_lock.
_mem_revoked: dict[str, datetime] = {}
_mem_lock = Lock()


def _mem_prune() -> None:
    now = datetime.now(timezone.utc)
    with _mem_lock:
        expired = [j for j, exp in _mem_revoked.items() if exp < now]
        for j in expired:
            del _mem_revoked[j]


# ── Public revocation API ─────────────────────────────────────────────────────

def revoke_token(jti: str, expires_at: datetime) -> None:
    """Mark a token as revoked. Persists to Redis when available."""
    ttl = max(1, int((expires_at - datetime.now(timezone.utc)).total_seconds()))
    r = _redis()
    if r is not None:
        try:
            r.setex(f"revoked:{jti}", ttl, "1")
            return
        except Exception as e:
            _log.warning("Redis setex failed, using in-memory fallback: %s", e)
    # In-memory fallback
    _mem_prune()
    with _mem_lock:
        _mem_revoked[jti] = expires_at


def _is_revoked(jti: str | None) -> bool:
    if not jti:
        return False
    r = _redis()
    if r is not None:
        try:
            return bool(r.exists(f"revoked:{jti}"))
        except Exception as e:
            _log.warning("Redis exists failed, using in-memory fallback: %s", e)
    # In-memory fallback
    _mem_prune()
    with _mem_lock:
        return jti in _mem_revoked


# ── Token creation / decoding ─────────────────────────────────────────────────

def create_access_token(subject: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "jti": str(uuid.uuid4()),
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
