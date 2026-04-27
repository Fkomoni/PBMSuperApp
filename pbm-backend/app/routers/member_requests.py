from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.audit_log import log_event
from app.core.security import require_roles, ALL_STAFF, CLINICAL
from app.seed import MEMBER_REQUESTS, NOTIFICATIONS

router = APIRouter(tags=["member-requests"])

VALID_TYPES = {"new_enrollment", "plan_upgrade", "address_change", "medication_change"}
VALID_SUBTYPES = {"drug_stoppage", "new_medication", "dosage_change", "frequency_change", "brand_change"}
VALID_STATUSES = {"Pending", "Approved", "Rejected"}
VALID_URGENCIES = {"Low", "Medium", "High"}


class DecisionBody(BaseModel):
    decision: Literal["Approved", "Rejected"]
    note: str = Field(..., min_length=5, max_length=1000)


@router.get("/member-requests")
def list_member_requests(
    request_type: Optional[str] = Query(None, description="Filter by type"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    region: Optional[str] = Query(None, description="Filter by region"),
    urgency: Optional[str] = Query(None, description="Filter by urgency"),
    current_user: dict = Depends(require_roles(*ALL_STAFF)),
):
    data = MEMBER_REQUESTS
    if request_type:
        data = [r for r in data if r["request_type"] == request_type]
    if status_filter:
        data = [r for r in data if r["status"].lower() == status_filter.lower()]
    if region:
        data = [r for r in data if r["region"].lower() == region.lower()]
    if urgency:
        data = [r for r in data if r["urgency"].lower() == urgency.lower()]
    return data


@router.get("/member-requests/summary")
def member_request_summary(
    current_user: dict = Depends(require_roles(*ALL_STAFF)),
):
    """Counts by status and type — useful for sidebar badges."""
    return {
        "total": len(MEMBER_REQUESTS),
        "by_status": {
            s: sum(1 for r in MEMBER_REQUESTS if r["status"] == s)
            for s in ("Pending", "Approved", "Rejected")
        },
        "by_type": {
            t: sum(1 for r in MEMBER_REQUESTS if r["request_type"] == t)
            for t in ("new_enrollment", "plan_upgrade", "address_change", "medication_change")
        },
        "by_urgency": {
            u: sum(1 for r in MEMBER_REQUESTS if r["urgency"] == u)
            for u in ("High", "Medium", "Low")
        },
    }


@router.get("/member-requests/{request_id}")
def get_member_request(
    request_id: str,
    current_user: dict = Depends(require_roles(*ALL_STAFF)),
):
    req = next((r for r in MEMBER_REQUESTS if r["id"] == request_id), None)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    log_event("VIEW_MEMBER_REQUEST", current_user, f"member-request/{request_id}", "Request viewed")
    return req


@router.post("/member-requests/{request_id}/decide")
def decide_member_request(
    request_id: str,
    body: DecisionBody,
    current_user: dict = Depends(require_roles(*CLINICAL)),
):
    req = next((r for r in MEMBER_REQUESTS if r["id"] == request_id), None)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if req["status"] != "Pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Request already {req['status'].lower()}.",
        )

    now = datetime.now(timezone.utc).isoformat()
    req["status"] = body.decision
    req["decided_at"] = now
    req["decided_by"] = current_user["email"]
    req["decision_note"] = body.note

    # Build member-facing notification
    subtype_label = f" ({req['medication_subtype'].replace('_', ' ')} — {req['current_drug'] or req['requested_drug']})" \
        if req["medication_subtype"] else ""
    type_label = req["request_type"].replace("_", " ").title()
    notification = {
        "id": f"n{len(NOTIFICATIONS) + 1:02d}",
        "policy_no": req["policy_no"],
        "request_id": request_id,
        "message": (
            f"Your {type_label} request{subtype_label} has been {body.decision}. "
            f"PBM note: {body.note}"
        ),
        "channel": "email",
        "sent_at": now,
        "read": False,
    }
    NOTIFICATIONS.append(notification)

    log_event(
        f"REQUEST_{body.decision.upper()}",
        current_user,
        f"member-request/{request_id}",
        f"{type_label} for {req['enrollee_name']} ({req['policy_no']}) — {body.decision}",
    )
    return {
        "message": f"Request {body.decision.lower()}.",
        "request": req,
        "notification_sent": notification,
    }


@router.get("/notifications")
def list_notifications(
    policy_no: Optional[str] = Query(None, description="Filter by member policy number"),
    current_user: dict = Depends(require_roles(*ALL_STAFF)),
):
    data = NOTIFICATIONS
    if policy_no:
        data = [n for n in data if n["policy_no"] == policy_no]
    return data
