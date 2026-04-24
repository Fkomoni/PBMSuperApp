"""Short-lived, one-time ticket store for the embed-login handoff.

Parent apps call /auth/embed-login with valid credentials + the shared
secret and receive a URL containing an opaque ticket. The portal front-end
redeems that ticket exactly once via /auth/redeem-ticket to obtain the
real JWT — so the JWT itself never appears in a URL (browser history,
referrers, server logs) and the ticket is useless after first use.

In-memory only. For multi-instance deployments, promote this to a Redis-
backed store keyed off `settings.redis_url` — each ticket is already
self-expiring and opaque, so the cross-instance story is trivial.
"""
from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass
from typing import Any


TICKET_TTL_SECONDS = 60  # parent iframes the URL immediately — 60s is plenty


@dataclass
class _Entry:
    jwt: str
    session: dict[str, Any]
    expires_at: float


# CPython dict ops are atomic, but we still take a lock around issue/
# redeem so expiry cleanup can't race with a concurrent pop.
_store: dict[str, _Entry] = {}
_lock = threading.Lock()


def _purge_expired_locked(now: float) -> None:
    # Caller holds the lock. Drop any entry whose TTL elapsed.
    stale = [k for k, v in _store.items() if v.expires_at <= now]
    for k in stale:
        _store.pop(k, None)


def issue(jwt: str, session: dict[str, Any]) -> tuple[str, int]:
    """Mint a fresh opaque ticket for `jwt` + `session`.

    Returns (ticket, ttl_seconds). `secrets.token_urlsafe(32)` yields
    ~43 URL-safe characters with 256 bits of entropy — brute-forcing in
    the 60-second window is not feasible.
    """
    now = time.time()
    ticket = secrets.token_urlsafe(32)
    entry = _Entry(jwt=jwt, session=session, expires_at=now + TICKET_TTL_SECONDS)
    with _lock:
        _purge_expired_locked(now)
        _store[ticket] = entry
    return ticket, TICKET_TTL_SECONDS


def redeem(ticket: str) -> _Entry | None:
    """Atomically consume a ticket. Returns the entry if still valid, else
    None. After redemption the ticket is gone — a second attempt fails.
    """
    if not ticket:
        return None
    now = time.time()
    with _lock:
        entry = _store.pop(ticket, None)
        _purge_expired_locked(now)
    if entry is None:
        return None
    if entry.expires_at <= now:
        return None
    return entry


def size() -> int:
    """Diagnostic — number of unredeemed, unexpired tickets."""
    now = time.time()
    with _lock:
        _purge_expired_locked(now)
        return len(_store)
