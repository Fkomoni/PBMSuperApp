from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.security import verify_password, create_access_token
from app.seed import STAFF

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(body: LoginRequest):
    email = body.email.strip().lower()

    # Domain check
    if not email.endswith("@leadway.com"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only @leadway.com accounts are permitted.",
        )

    # Find user
    user = next((u for u in STAFF if u["email"] == email), None)
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    token = create_access_token({"sub": user["email"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    }
