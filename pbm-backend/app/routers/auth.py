from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr

from app.core.audit_log import log_event
from app.core.config import settings
from app.core.limiter import limiter
from app.core.revocation import revoke_token
from app.core.security import create_access_token, get_current_user, verify_password
from app.seed import STAFF

router = APIRouter(tags=["auth"])

_IS_PROD = settings.ENVIRONMENT == "production"


class LoginRequest(BaseModel):
    email: str
    password: str


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="pbm_auth",
        value=token,
        httponly=True,
        secure=_IS_PROD,
        samesite="none" if _IS_PROD else "lax",
        max_age=60 * settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key="pbm_auth", path="/")


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/auth/login")
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, response: Response):
    email = body.email.strip().lower()

    if not email.endswith("@leadway.com"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only @leadway.com accounts are permitted.",
        )

    user = next((u for u in STAFF if u["email"] == email), None)
    if not user or not verify_password(body.password, user["hashed_password"]):
        # Generic message — do not reveal whether email exists
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    token = create_access_token({"sub": user["email"], "role": user["role"], "name": user["name"]})
    _set_auth_cookie(response, token)

    log_event("LOGIN", user, "auth", f"Successful login from {request.client.host if request.client else 'unknown'}")

    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        }
    }


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/auth/logout")
def logout(response: Response, current_user: dict = Depends(get_current_user)):
    jti = current_user.get("jti", "")
    exp = current_user.get("exp", 0)
    ttl = max(0, exp - int(datetime.now(timezone.utc).timestamp()))
    revoke_token(jti, ttl)
    _clear_auth_cookie(response)
    log_event("LOGOUT", current_user, "auth", "User logged out and token revoked")
    return {"message": "Logged out successfully."}


# ── Refresh session info ──────────────────────────────────────────────────────

@router.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    """Lightweight endpoint to verify the cookie/token is still valid."""
    return {
        "email": current_user["email"],
        "role": current_user["role"],
        "name": current_user["name"],
    }
