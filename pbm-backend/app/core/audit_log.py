"""
Append security and operational events to the in-memory AUDIT log.
Replace the list write with a DB insert when PostgreSQL is wired up.
"""
from datetime import datetime, timezone


def log_event(action: str, user: dict, resource: str, detail: str = "") -> None:
    from app.seed import AUDIT  # late import to avoid circular dependency
    AUDIT.append({
        "id": f"AE-{len(AUDIT) + 1:05d}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user.get("email", "unknown"),
        "role": user.get("role", "unknown"),
        "action": action,
        "resource": resource,
        "detail": detail,
    })
