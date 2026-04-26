import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext

from app.core.config import settings
from app.core.revocation import is_revoked

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer(auto_error=False)


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── Token creation ────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": secrets.token_hex(16),   # unique ID for revocation
    })
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ── Token extraction — cookie first, Bearer header fallback (Swagger UI) ─────

def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    token = request.cookies.get("pbm_auth")
    if not token and credentials:
        token = credentials.credentials
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


# ── Validate and decode token ─────────────────────────────────────────────────

def get_current_user(token: str = Depends(_extract_token)) -> dict:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired.")
    except jwt.InvalidTokenError:
        raise exc

    email: str = payload.get("sub", "")
    role: str  = payload.get("role", "")
    jti: str   = payload.get("jti", "")

    if not email or not role:
        raise exc

    if is_revoked(jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked.")

    return {"email": email, "role": role, "name": payload.get("name", ""), "jti": jti, "exp": payload.get("exp")}


# ── RBAC dependency factory ───────────────────────────────────────────────────

def require_roles(*allowed: str):
    """
    Usage:  current_user: dict = Depends(require_roles("admin", "pharm_ops"))
    Raises 403 if the authenticated user's role is not in *allowed.
    """
    def _guard(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user['role']}' is not permitted to perform this action.",
            )
        return user
    return _guard


# ── Role constants (import these in routers for readability) ──────────────────

ALL_STAFF    = ("admin", "pharm_ops", "pharmacist", "logistics", "contact")
CLINICAL     = ("admin", "pharm_ops", "pharmacist")
LOGISTICS    = ("admin", "pharm_ops", "logistics")
FINANCE      = ("admin", "pharm_ops")
ADMIN_ONLY   = ("admin",)
