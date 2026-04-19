from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db

bearer = HTTPBearer(auto_error=False)


def create_access_token(subject: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_ttl_hours)).timestamp()),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        **(extra or {}),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
    except PyJWTError:
        # Don't echo the underlying error message — it can leak decoding
        # details to an attacker probing token validity (expired vs bad sig
        # vs bad aud vs bad iss).
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def _require_token(creds: HTTPAuthorizationCredentials | None) -> dict:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = decode_token(creds.credentials)
    if not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject")
    return payload


def _assert_active(payload: dict, db: Session) -> None:
    """Re-check that the token's subject still resolves to an active provider.
    Prevents tokens from outliving a deactivation or role change for the full
    JWT TTL without a revocation list."""
    from app.models import Provider  # local import to avoid cycle at load time

    pid = payload.get("sub")
    p = db.get(Provider, pid) if pid else None
    if not p or not p.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session no longer valid")
    # Role may have been downgraded after token issuance.
    payload["_db_role"] = p.role or "provider"


def current_provider(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> dict:
    payload = _require_token(creds)
    _assert_active(payload, db)
    # Admins can call every provider endpoint; everyone else must be an actual
    # provider. Trust the DB role over the claim in case role was revoked.
    effective_role = payload.get("_db_role") or payload.get("role")
    if effective_role not in ("provider", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provider role required")
    return payload


def current_admin(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> dict:
    payload = _require_token(creds)
    _assert_active(payload, db)
    effective_role = payload.get("_db_role") or payload.get("role")
    if effective_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return payload


def provider_id_from(payload: dict) -> str:
    return payload["sub"]
