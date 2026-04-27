from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.security import require_roles, ADMIN_ONLY
from app.seed import AUDIT

router = APIRouter(tags=["audit"])


@router.get("/audit")
def list_audit(
    role: Optional[str] = Query(None, description="Filter by role"),
    action: Optional[str] = Query(None, description="Filter by action"),
    q: Optional[str] = Query(None, description="Free-text search on user/resource/detail"),
    current_user: dict = Depends(require_roles(*ADMIN_ONLY)),
):
    data = AUDIT
    if role:
        data = [a for a in data if a["role"].lower() == role.lower()]
    if action:
        data = [a for a in data if a["action"].lower() == action.lower()]
    if q:
        q_lower = q.lower()
        data = [
            a for a in data
            if q_lower in a["user"].lower()
            or q_lower in a["resource"].lower()
            or q_lower in a["detail"].lower()
        ]
    return data
