import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.routing import classify_bucket
from app.core.security import current_provider
from app.schemas.provider import (
    MedicationRequestIn,
    MedicationRequestOut,
    TrackingEvent,
    TrackingOut,
)

router = APIRouter(prefix="/medication-requests", tags=["requests"])

# In-memory fallback store so the UI works without Postgres. Real deployment
# swaps this for SQLAlchemy persistence against the medication_requests /
# medication_request_items / routing_decisions tables described in the spec.
_STORE: dict[str, dict[str, Any]] = {}


def _classify_request(items: list[dict]) -> str:
    hints = {
        (i.get("classification_hint") or i.get("classification") or "").lower()
        for i in items
    }
    hints.discard("")
    hints.discard("auto")
    has_acute = "acute" in hints
    has_chronic = "chronic" in hints
    has_special = bool({"hormonal", "cancer", "autoimmune", "fertility"} & hints)
    if has_special:
        return "chronic"
    if has_chronic and has_acute:
        return "mixed"
    if has_chronic:
        return "chronic"
    return "acute"


def _persist(payload: MedicationRequestIn, provider: dict) -> dict:
    items = [i.model_dump() for i in payload.items]
    classification = _classify_request(items)
    route = classify_bucket([classification, *{(i.get("classification_hint") or "") for i in items}], state=None)
    rid = uuid.uuid4().hex[:10].upper()
    rec = {
        "id": rid,
        "enrollee_id": payload.enrollee_id,
        "enrollee_name": None,
        "items": items,
        "diagnoses": [d.model_dump() for d in payload.diagnoses],
        "delivery": payload.delivery.model_dump() if payload.delivery else None,
        "alt_phone": payload.alt_phone,
        "notes": payload.notes,
        "status": "submitted",
        "classification": classification,
        "channel": route.get("channel"),
        "route": route.get("label"),
        "created_at": datetime.now(timezone.utc),
        "provider_id": provider.get("sub"),
        "provider_email": provider.get("email"),
        "tracking": [
            {"label": "Prescription submitted", "at": datetime.now(timezone.utc), "kind": "done", "icon": "send"},
            {"label": f"Auto-routed to {route.get('label') or 'fulfilment channel'}", "at": datetime.now(timezone.utc), "kind": "info", "icon": "route"},
        ],
    }
    _STORE[rid] = rec
    return rec


@router.post("", response_model=MedicationRequestOut)
async def submit(payload: MedicationRequestIn, provider: dict = Depends(current_provider)):
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one medication is required")
    rec = _persist(payload, provider)
    return MedicationRequestOut(**{k: rec.get(k) for k in MedicationRequestOut.model_fields.keys() if k in rec} | {"items": rec["items"]})


@router.get("", response_model=list[MedicationRequestOut])
async def list_mine(limit: int = Query(default=25, ge=1, le=200), provider: dict = Depends(current_provider)):
    mine = [r for r in _STORE.values() if r.get("provider_id") == provider.get("sub")]
    mine.sort(key=lambda r: r.get("created_at") or datetime.min, reverse=True)
    mine = mine[:limit]
    return [
        MedicationRequestOut(**{k: r.get(k) for k in MedicationRequestOut.model_fields.keys() if k in r} | {"items": r.get("items", [])})
        for r in mine
    ]


@router.get("/{request_id}/tracking", response_model=TrackingOut)
async def tracking(request_id: str, provider: dict = Depends(current_provider)):
    rec = _STORE.get(request_id)
    if not rec or rec.get("provider_id") != provider.get("sub"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    events = [TrackingEvent(**e) for e in rec.get("tracking", [])]
    return TrackingOut(request_id=request_id, events=events)
