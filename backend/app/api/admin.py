"""Admin-only views. Sees every request across all providers + a summary
that splits by routing channel (WellaHealth vs Leadway PBM WhatsApp #1/#2).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.core.limiter import limiter
from app.core.security import current_admin
from app.models import MedicationRequest, Provider, TrackingEvent
from app.services import wellahealth
from app.services.wellahealth import WellaHealthError

audit = logging.getLogger("rxhub.audit")

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_admin)])


def _serialize_request(req: MedicationRequest, provider: Provider | None) -> dict:
    return {
        "id": req.id,
        "ref_code": req.ref_code,
        "enrollee_id": req.enrollee_id,
        "enrollee_name": req.enrollee_name,
        "enrollee_state": req.enrollee_state,
        "enrollee_phone": req.enrollee_phone,
        "enrollee_email": req.enrollee_email,
        "provider_id": req.provider_id,
        "provider_name": provider.name if provider else None,
        "provider_email": provider.email if provider else None,
        "provider_facility": provider.facility if provider else None,
        "classification": req.classification,
        "status": req.status,
        "channel": req.channel,
        "route": req.route,
        "delivery": req.delivery,
        "diagnoses": req.diagnoses,
        "notes": req.notes,
        "pharmacy_code": req.pharmacy_code,
        "external_ref": req.external_ref,
        "external_tracking_code": req.external_tracking_code,
        "external_pickup_code": req.external_pickup_code,
        "external_status": req.external_status,
        "external_pharmacy_name": req.external_pharmacy_name,
        "external_synced_at": req.external_synced_at,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
        "items": [
            {
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
        "attachments": [
            {
                "id": a.id,
                "filename": a.filename,
                "content_type": a.content_type,
                "size_bytes": a.size_bytes,
                "created_at": a.created_at,
            }
            for a in (req.attachments or [])
        ],
    }


@router.get("/requests")
@limiter.limit("120/minute")
async def list_all_requests(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    channel: str | None = Query(default=None, description="wellahealth | leadway_pbm_whatsapp_1 | leadway_pbm_whatsapp_2"),
    classification: str | None = Query(default=None, description="acute | chronic | mixed"),
    status_: str | None = Query(default=None, alias="status"),
    external_status: str | None = Query(default=None, description="WellaHealth-reported status, e.g. Pending | Assigned | Dispensed | Cancelled"),
    state: str | None = Query(default=None, description="Enrollee state, e.g. Lagos"),
    provider_id: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200, description="Free-text match on request id / enrollee id / name"),
    _: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    stmt = select(MedicationRequest).options(selectinload(MedicationRequest.items))
    if channel:
        stmt = stmt.where(MedicationRequest.channel == channel)
    if classification:
        stmt = stmt.where(MedicationRequest.classification == classification)
    if status_:
        stmt = stmt.where(MedicationRequest.status == status_)
    if external_status:
        # Case-insensitive match — Wella's casing varies (Dispensed vs dispensed)
        stmt = stmt.where(func.lower(MedicationRequest.external_status) == external_status.lower())
    if state:
        stmt = stmt.where(MedicationRequest.enrollee_state == state)
    if provider_id:
        stmt = stmt.where(MedicationRequest.provider_id == provider_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (MedicationRequest.id.ilike(like))
            | (MedicationRequest.enrollee_id.ilike(like))
            | (MedicationRequest.enrollee_name.ilike(like))
        )
    audit.info("event=admin_list_requests actor=%s q=%s channel=%s status=%s", _.get("sub", "?"), q, channel, status_)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(MedicationRequest.created_at.desc()).offset(offset).limit(limit)
    rows = db.scalars(stmt).all()

    provider_ids = {r.provider_id for r in rows if r.provider_id}
    providers = {
        p.id: p
        for p in db.scalars(select(Provider).where(Provider.id.in_(provider_ids))).all()
    } if provider_ids else {}

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [_serialize_request(r, providers.get(r.provider_id)) for r in rows],
    }


@router.get("/requests/{request_id}")
@limiter.limit("120/minute")
async def request_detail(
    request: Request,
    request_id: str,
    _: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    req = db.get(MedicationRequest, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    audit.info("event=admin_view_request actor=%s target=%s", _.get("sub", "?"), request_id)
    provider = db.get(Provider, req.provider_id) if req.provider_id else None
    data = _serialize_request(req, provider)
    data["events"] = [
        {"label": e.label, "kind": e.kind, "icon": e.icon, "note": e.note, "at": e.at}
        for e in sorted(req.events, key=lambda x: x.at or datetime.min)
    ]
    return data


@router.get("/summary")
@limiter.limit("60/minute")
async def summary(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    _: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    def _count(stmt) -> list[dict]:
        rows = db.execute(stmt).all()
        return [{"key": (r[0] or "—"), "count": int(r[1] or 0)} for r in rows]

    total = db.scalar(
        select(func.count(MedicationRequest.id)).where(MedicationRequest.created_at >= since)
    ) or 0

    by_channel = _count(
        select(MedicationRequest.channel, func.count(MedicationRequest.id))
        .where(MedicationRequest.created_at >= since)
        .group_by(MedicationRequest.channel)
        .order_by(func.count(MedicationRequest.id).desc())
    )
    by_classification = _count(
        select(MedicationRequest.classification, func.count(MedicationRequest.id))
        .where(MedicationRequest.created_at >= since)
        .group_by(MedicationRequest.classification)
    )
    by_status = _count(
        select(MedicationRequest.status, func.count(MedicationRequest.id))
        .where(MedicationRequest.created_at >= since)
        .group_by(MedicationRequest.status)
    )
    by_state = _count(
        select(MedicationRequest.enrollee_state, func.count(MedicationRequest.id))
        .where(MedicationRequest.created_at >= since)
        .group_by(MedicationRequest.enrollee_state)
        .order_by(func.count(MedicationRequest.id).desc())
    )

    # WellaHealth-reported status — independent of our internal `status`
    # (submitted, dispatched, etc.). Powers the "pending / dispensed /
    # cancelled" report the admin runs on fulfilment progress.
    by_external_status = _count(
        select(MedicationRequest.external_status, func.count(MedicationRequest.id))
        .where(MedicationRequest.created_at >= since)
        .where(MedicationRequest.channel == "wellahealth")
        .group_by(MedicationRequest.external_status)
        .order_by(func.count(MedicationRequest.id).desc())
    )

    return {
        "window_days": days,
        "total": total,
        "by_channel": by_channel,
        "by_classification": by_classification,
        "by_status": by_status,
        "by_external_status": by_external_status,
        "by_state": by_state,
    }


@router.post("/requests/{request_id}/refresh-status")
@limiter.limit("30/minute")
async def refresh_external_status(
    request: Request,
    request_id: str,
    admin_ctx: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    """Pull the latest fulfilment status from WellaHealth and attach a
    tracking event. Uses the stored external_tracking_code / external_ref
    captured at dispatch time. Safe to call repeatedly.
    """
    req = db.get(MedicationRequest, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.channel != "wellahealth":
        return {"ok": False, "error": "Request was not routed to WellaHealth", "channel": req.channel}
    if not (req.external_tracking_code or req.external_ref):
        return {"ok": False, "error": "No WellaHealth reference on this request yet — dispatch may have failed."}

    try:
        row = await wellahealth.find_fulfilment(
            tracking_code=req.external_tracking_code,
            enrollment_code=req.external_ref or req.enrollee_id,
        )
    except WellaHealthError as e:
        return {"ok": False, "error": str(e)}

    if not row:
        return {"ok": False, "error": "Fulfilment not found in WellaHealth feed (it may be older than the lookback window)."}

    new_status = str(row.get("status") or row.get("fulfilmentStatus") or row.get("Status") or "").strip() or None
    pharmacy_name = row.get("pharmacyName") or row.get("PharmacyName") or req.external_pharmacy_name
    tracking_code = row.get("trackingCode") or row.get("TrackingCode") or req.external_tracking_code
    # WellaHealth's pickup/OTP field name varies across partner responses —
    # accept the common spellings and only keep digits (it's always an 8-digit
    # numeric OTP, e.g. "70212673").
    pickup_raw = (
        row.get("pickupCode") or row.get("PickupCode")
        or row.get("pickUpCode") or row.get("PickUpCode")
        or row.get("otp") or row.get("Otp") or row.get("OTP")
        or row.get("otpCode") or row.get("OtpCode") or row.get("OTPCode")
        or row.get("collectionCode") or row.get("CollectionCode")
    )
    pickup_code = None
    if pickup_raw is not None:
        digits = "".join(ch for ch in str(pickup_raw) if ch.isdigit())
        pickup_code = digits or str(pickup_raw).strip() or None

    changed = new_status and new_status != req.external_status
    req.external_status = new_status or req.external_status
    req.external_pharmacy_name = pharmacy_name
    req.external_tracking_code = tracking_code
    if pickup_code:
        req.external_pickup_code = pickup_code
    req.external_synced_at = datetime.now(timezone.utc)

    if changed:
        db.add(TrackingEvent(
            request_id=req.id,
            label=f"WellaHealth status: {new_status}",
            kind="info",
            icon="refresh-cw",
            at=datetime.now(timezone.utc),
        ))
    db.commit()
    db.refresh(req)
    audit.info("event=admin_refresh_status actor=%s target=%s result=%s", admin_ctx.get("sub", "?"), request_id, req.external_status)

    return {
        "ok": True,
        "request_id": req.id,
        "external_status": req.external_status,
        "external_tracking_code": req.external_tracking_code,
        "external_pickup_code": req.external_pickup_code,
        "external_pharmacy_name": req.external_pharmacy_name,
        "external_synced_at": req.external_synced_at,
    }


@router.get("/providers")
@limiter.limit("60/minute")
async def list_providers(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    audit.info("event=admin_list_providers actor=%s", _.get("sub", "?"))
    total = db.scalar(select(func.count(Provider.id))) or 0
    rows = db.scalars(
        select(Provider).order_by(Provider.created_at.desc()).offset(offset).limit(limit)
    ).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "id": p.id,
                "name": p.name,
                "email": p.email,
                "role": p.role,
                "facility": p.facility,
                "phone": p.phone,
                "is_active": p.is_active,
                "created_at": p.created_at,
            }
            for p in rows
        ],
    }
