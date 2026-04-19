"""Admin-only views. Sees every request across all providers + a summary
that splits by routing channel (WellaHealth vs Leadway PBM WhatsApp #1/#2).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.core.security import current_admin
from app.models import MedicationRequest, Provider, TrackingEvent

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_admin)])


def _serialize_request(req: MedicationRequest, provider: Provider | None) -> dict:
    return {
        "id": req.id,
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
    }


@router.get("/requests")
async def list_all_requests(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    channel: str | None = Query(default=None, description="wellahealth | leadway_pbm_whatsapp_1 | leadway_pbm_whatsapp_2"),
    classification: str | None = Query(default=None, description="acute | chronic | mixed"),
    status_: str | None = Query(default=None, alias="status"),
    state: str | None = Query(default=None, description="Enrollee state, e.g. Lagos"),
    provider_id: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Free-text match on request id / enrollee id / name"),
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
async def request_detail(
    request_id: str,
    _: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    req = db.get(MedicationRequest, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    provider = db.get(Provider, req.provider_id) if req.provider_id else None
    data = _serialize_request(req, provider)
    data["events"] = [
        {"label": e.label, "kind": e.kind, "icon": e.icon, "note": e.note, "at": e.at}
        for e in sorted(req.events, key=lambda x: x.at or datetime.min)
    ]
    return data


@router.get("/summary")
async def summary(
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

    return {
        "window_days": days,
        "total": total,
        "by_channel": by_channel,
        "by_classification": by_classification,
        "by_status": by_status,
        "by_state": by_state,
    }


@router.get("/providers")
async def list_providers(
    _: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    rows = db.scalars(select(Provider).order_by(Provider.created_at.desc())).all()
    return [
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
    ]
