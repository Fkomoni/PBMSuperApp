import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.routing import classify_bucket
from app.core.security import current_provider
from app.models import MedicationRequest, MedicationRequestItem, TrackingEvent
from app.schemas.provider import (
    MedicationRequestIn,
    MedicationRequestOut,
    TrackingEvent as TrackingEventSchema,
    TrackingOut,
)
from app.services import wellahealth
from app.services.wellahealth import WellaHealthError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/medication-requests", tags=["requests"])


SPECIAL = {"hormonal", "cancer", "autoimmune", "fertility"}


def _classify_request(items: list[dict]) -> str:
    hints = {(i.get("classification_hint") or "").lower() for i in items}
    hints.discard("")
    hints.discard("auto")
    has_acute = "acute" in hints
    has_chronic = "chronic" in hints
    has_special = bool(SPECIAL & hints)
    if has_special:
        return "chronic"
    if has_chronic and has_acute:
        return "mixed"
    if has_chronic:
        return "chronic"
    return "acute"


def _serialize(req: MedicationRequest) -> dict:
    return {
        "id": req.id,
        "enrollee_id": req.enrollee_id,
        "enrollee_name": req.enrollee_name,
        "status": req.status,
        "classification": req.classification,
        "route": req.route,
        "channel": req.channel,
        "created_at": req.created_at,
        "items": [
            {
                "drug_id": it.drug_id,
                "drug_name": it.drug_name,
                "generic": it.generic,
                "dosage": it.dosage,
                "quantity": it.quantity,
                "duration_days": it.duration_days,
                "classification_hint": it.classification_hint,
                "unit_price": it.unit_price,
            }
            for it in req.items
        ],
    }


@router.post("", response_model=MedicationRequestOut)
async def submit(
    payload: MedicationRequestIn,
    provider: dict = Depends(current_provider),
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one medication is required")

    item_dicts = [i.model_dump() for i in payload.items]
    classification = _classify_request(item_dicts)
    route_kinds = [classification, *{(i.get("classification_hint") or "") for i in item_dicts}]
    route = classify_bucket(route_kinds, state=None)

    req = MedicationRequest(
        provider_id=provider["sub"],
        enrollee_id=payload.enrollee_id,
        diagnoses=[d.model_dump() for d in payload.diagnoses],
        delivery=payload.delivery.model_dump() if payload.delivery else None,
        alt_phone=payload.alt_phone,
        notes=payload.notes,
        classification=classification,
        status="submitted",
        channel=route.get("channel"),
        route=route.get("label"),
    )
    req.items = [
        MedicationRequestItem(
            drug_id=i.get("drug_id"),
            drug_name=i["drug_name"],
            generic=i.get("generic"),
            dosage=i["dosage"],
            quantity=i["quantity"],
            duration_days=i.get("duration_days"),
            classification_hint=i.get("classification_hint"),
            unit_price=i.get("unit_price"),
        )
        for i in item_dicts
    ]
    now = datetime.now(timezone.utc)
    req.events = [
        TrackingEvent(label="Prescription submitted", kind="done", icon="send", at=now),
        TrackingEvent(
            label=f"Auto-routed to {route.get('label') or 'fulfilment channel'}",
            kind="info",
            icon="route",
            at=now,
        ),
    ]
    db.add(req)
    db.commit()
    db.refresh(req)

    # Fire-and-safe-fail dispatch to WellaHealth when the routing matrix
    # points outside Leadway PBM. Failure here logs + appends a warn event
    # but must NOT fail the submission — the provider already has a receipt.
    if route.get("channel") == "wellahealth":
        serialized = _serialize(req)
        try:
            wella_resp = await wellahealth.dispatch_fulfilment(serialized)
            db.add(TrackingEvent(
                request_id=req.id,
                label=f"Sent to WellaHealth (ref {wella_resp.get('reference') or wella_resp.get('id') or '—'})",
                kind="done",
                icon="send",
                at=datetime.now(timezone.utc),
            ))
            req.status = "routed"
        except WellaHealthError as e:
            logger.warning("WellaHealth dispatch failed for %s: %s", req.id, e)
            db.add(TrackingEvent(
                request_id=req.id,
                label="Awaiting retry of WellaHealth dispatch",
                kind="warn",
                icon="alert-triangle",
                note=str(e),
                at=datetime.now(timezone.utc),
            ))
        db.commit()
        db.refresh(req)

    return MedicationRequestOut(**_serialize(req))


@router.get("", response_model=list[MedicationRequestOut])
async def list_mine(
    limit: int = Query(default=25, ge=1, le=200),
    provider: dict = Depends(current_provider),
    db: Session = Depends(get_db),
):
    stmt = (
        select(MedicationRequest)
        .where(MedicationRequest.provider_id == provider["sub"])
        .order_by(MedicationRequest.created_at.desc())
        .limit(limit)
    )
    rows = db.scalars(stmt).all()
    return [MedicationRequestOut(**_serialize(r)) for r in rows]


@router.get("/{request_id}/tracking", response_model=TrackingOut)
async def tracking(
    request_id: str,
    provider: dict = Depends(current_provider),
    db: Session = Depends(get_db),
):
    req = db.get(MedicationRequest, request_id)
    if not req or req.provider_id != provider["sub"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    events = [
        TrackingEventSchema(label=e.label, at=e.at, kind=e.kind, icon=e.icon, note=e.note)
        for e in req.events
    ]
    return TrackingOut(request_id=request_id, events=events)
