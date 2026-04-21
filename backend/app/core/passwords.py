"""Thin wrapper over passlib so the rest of the app doesn't import it directly."""
from passlib.context import CryptContext

_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _ctx.verify(plain, hashed)
    except Exception:
        return False
