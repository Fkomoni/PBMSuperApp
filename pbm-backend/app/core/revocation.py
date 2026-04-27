"""
Redis-backed JWT revocation store.
Gracefully degrades to a no-op if Redis is unavailable (dev without Redis).
"""
import logging
from app.core.config import settings

_redis_client = None
_redis_ok = False

def _init():
    global _redis_client, _redis_ok
    try:
        import redis
        client = redis.from_url(settings.REDIS_URL, socket_timeout=2, socket_connect_timeout=2)
        client.ping()
        _redis_client = client
        _redis_ok = True
    except Exception as e:
        logging.warning(f"Redis unavailable — token revocation disabled. Reason: {e}")

_init()


def revoke_token(jti: str, ttl_seconds: int) -> None:
    if _redis_ok and _redis_client:
        try:
            _redis_client.setex(f"rev:{jti}", max(ttl_seconds, 1), "1")
        except Exception:
            pass


def is_revoked(jti: str) -> bool:
    if not _redis_ok or not _redis_client:
        return False
    try:
        return bool(_redis_client.exists(f"rev:{jti}"))
    except Exception:
        return False
