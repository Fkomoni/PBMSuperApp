from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.audit_log import log_event
from app.core.security import require_roles, ALL_STAFF, CLINICAL
from app.seed import DISEASE_COHORTS, ENROLLEE_MEDICATIONS, ENROLLEES


def _flag_medications(meds: list[dict]) -> list[dict]:
    """Detect DUPLICATE_GENERIC and BRAND_CONFLICT within a member's med list."""
    index: dict[str, list[int]] = defaultdict(list)
    for i, m in enumerate(meds):
        key = m.get("generic_name", m["drug"]).lower()
        index[key].append(i)

    result = []
    for i, med in enumerate(meds):
        flags: list[str] = []
        key = med.get("generic_name", med["drug"]).lower()
        dupes = index[key]
        if len(dupes) > 1:
            others = [meds[j] for j in dupes if j != i]
            other_brands = {m.get("brand") for m in others if m.get("brand")}
            if other_brands or med.get("brand"):
                flags.append("BRAND_CONFLICT")
            else:
                flags.append("DUPLICATE_GENERIC")
        result.append({**med, "flags": flags})
    return result

router = APIRouter(tags=["enrollees"])


class CommentBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


@router.get("/enrollees")
def list_enrollees(
    region: Optional[str] = Query(None, description="Filter by region"),
    current_user: dict = Depends(require_roles(*ALL_STAFF)),
):
    data = ENROLLEES
    if region:
        data = [e for e in data if e["region"].lower() == region.lower()]
    return [{k: v for k, v in e.items() if k != "comments"} for e in data]


@router.get("/enrollees/{enrollee_id}")
def get_enrollee(
    enrollee_id: str,
    current_user: dict = Depends(require_roles(*ALL_STAFF)),
):
    enrollee = next((e for e in ENROLLEES if e["id"] == enrollee_id), None)
    if not enrollee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollee not found.")
    return enrollee


@router.get("/enrollees/{enrollee_id}/medications")
def get_enrollee_medications(
    enrollee_id: str,
    current_user: dict = Depends(require_roles(*ALL_STAFF)),
):
    enrollee = next((e for e in ENROLLEES if e["id"] == enrollee_id), None)
    if not enrollee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollee not found.")

    cohort_ids = enrollee["disease_cohorts"]
    cohort_details = [c for c in DISEASE_COHORTS if c["id"] in cohort_ids]
    medications = _flag_medications(ENROLLEE_MEDICATIONS.get(enrollee_id, []))
    flagged = [m for m in medications if m["flags"]]

    log_event("VIEW_MEDICATIONS", current_user, f"enrollee/{enrollee_id}", "Medication list accessed")
    return {
        "enrollee_id": enrollee_id,
        "enrollee_name": enrollee["name"],
        "disease_cohorts": cohort_details,
        "medications": medications,
        "total_medications": len(medications),
        "flagged_count": len(flagged),
    }


@router.post("/enrollees/{enrollee_id}/comment")
def add_comment(
    enrollee_id: str,
    body: CommentBody,
    current_user: dict = Depends(require_roles(*CLINICAL)),
):
    enrollee = next((e for e in ENROLLEES if e["id"] == enrollee_id), None)
    if not enrollee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollee not found.")
    comment = {
        "author": current_user["email"],  # always from token — no author spoofing
        "text": body.text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    enrollee["comments"].append(comment)
    log_event("ADD_COMMENT", current_user, f"enrollee/{enrollee_id}", f"Comment added: {body.text[:80]}")
    return {"message": "Comment added.", "comment": comment}
