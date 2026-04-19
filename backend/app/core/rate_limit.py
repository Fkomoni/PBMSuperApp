"""Tiny in-process rate limiter (fixed-window with a sliding bucket).

Intentional limitations:
  * Per-process only — if you run N worker replicas, the limit is effectively N times
    the configured cap. For a single-instance free-tier Render service this is fine;
    upgrade to Redis for horizontal scale.
  * Best-effort: we drop requests when the bucket is full, but do not queue.

Two helpers:
  * ``check_and_consume(key, limit, window)`` — returns (ok, retry_after_seconds).
  * ``reset(key)`` — zero the bucket on a successful request (e.g. after login OK).
"""
from __future__ import annotations

import threading
import time
from collections import deque
from typing import Deque

_lock = threading.Lock()
_buckets: dict[str, Deque[float]] = {}


def check_and_consume(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    now = time.time()
    with _lock:
        q = _buckets.setdefault(key, deque())
        cutoff = now - window_seconds
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= limit:
            retry_after = max(1, int(q[0] + window_seconds - now))
            return False, retry_after
        q.append(now)
        return True, 0


def reset(key: str) -> None:
    with _lock:
        _buckets.pop(key, None)
