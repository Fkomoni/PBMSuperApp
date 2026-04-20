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
from app.core.config import settings
from app.models import Provider
from app.services import notifications, prognosis, wellahealth, whatsapp
from app.services.prognosis import PrognosisAuthError
from app.services.wellahealth import WellaHealthError
from app.services.whatsapp import WhatsAppError

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
        "ref_code": req.ref_code,
        "enrollee_id": req.enrollee_id,
        "enrollee_name": req.enrollee_name,
        "enrollee_first_name": req.enrollee_first_name,
        "enrollee_last_name": req.enrollee_last_name,
        "enrollee_phone": req.enrollee_phone,
        "enrollee_email": req.enrollee_email,
        "enrollee_state": req.enrollee_state,
        "enrollee_dob": req.enrollee_dob,
        "enrollee_gender": req.enrollee_gender,
        "delivery": req.delivery,
        "alt_phone": req.alt_phone,
        "urgency": req.urgency,
        "treating_doctor": req.treating_doctor,
        "notes": req.notes,
        "diagnoses": req.diagnoses,
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


async def _enrich_from_prognosis(enrollee_id: str) -> dict:
    """Best-effort Prognosis lookup for enrollee contact/address fields.
    Returns {} if Prognosis is unconfigured or the call fails — submission
    proceeds either way with whatever the provider typed into the form.
    """
    if not (settings.prognosis_username and settings.prognosis_password):
        return {}
    try:
        data = await prognosis.verify_enrollee(enrollee_id)
    except PrognosisAuthError as e:
        logger.warning("Prognosis enrich failed for %s: %s", enrollee_id, e)
        return {}
    return data or {}


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

    enrollee = await _enrich_from_prognosis(payload.enrollee_id)
    # Routing uses the provider-typed delivery state (payload.member_state) —
    # that's where the meds are going. Fall back to Prognosis's registered
    # state if the provider left it blank.
    state = payload.member_state or enrollee.get("state")
    route = classify_bucket(route_kinds, state=state)

    # Provider-supplied values win when Prognosis returned nothing; otherwise
    # Prognosis is authoritative. Keeps legacy member records up to date
    # without letting providers overwrite canonical Prognosis data silently.
    import uuid as _uuid
    ref_code = f"RX-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{_uuid.uuid4().hex[:6].upper()}"

    req = MedicationRequest(
        provider_id=provider["sub"],
        enrollee_id=payload.enrollee_id,
        enrollee_name=enrollee.get("name"),
        enrollee_first_name=enrollee.get("first_name"),
        enrollee_last_name=enrollee.get("last_name"),
        enrollee_phone=enrollee.get("phone") or payload.member_phone,
        enrollee_email=enrollee.get("email") or payload.member_email,
        enrollee_dob=enrollee.get("dob"),
        enrollee_gender=enrollee.get("gender"),
        enrollee_state=payload.member_state or state,
        diagnoses=[d.model_dump() for d in payload.diagnoses],
        delivery=payload.delivery.model_dump() if payload.delivery else None,
        alt_phone=payload.alt_phone,
        urgency=payload.urgency or "routine",
        treating_doctor=payload.treating_doctor,
        notes=payload.notes,
        classification=classification,
        status="submitted",
        channel=route.get("channel"),
        route=route.get("label"),
        ref_code=ref_code,
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
    # Stash any fulfilment metadata (pharmacy code/name, tracking code) so
    # the member email template can reference them without an extra lookup.
    wella_meta: dict = {}

    if route.get("channel") == "wellahealth":
        serialized = _serialize(req)
        try:
            wella_resp = await wellahealth.create_fulfilment(serialized)
            # Docs return a flat object (sometimes wrapped in {"value": ...}).
            wella_obj = wella_resp.get("value") if isinstance(wella_resp, dict) and "value" in wella_resp else wella_resp
            wella_obj = wella_obj or {}
            ref = wella_obj.get("enrollmentId") or wella_obj.get("id") or wella_obj.get("fulfilmentId")
            wella_meta = {
                "wella_pharmacy_code": wella_obj.get("pharmacyCode"),
                "wella_pharmacy_name": wella_obj.get("pharmacyName"),
                "wella_tracking_code": wella_obj.get("trackingCode") or f"WTR-{(req.id or '')[:10]}",
            }
            db.add(TrackingEvent(
                request_id=req.id,
                label=f"Sent to WellaHealth (ref {ref or '—'})",
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

    # ── Leadway PBM WhatsApp bot (chronic, mixed, acute Lagos weekday,
    #    special cohorts). Routes to WhatsApp #1 or #2 per the matrix. ──
    if route.get("channel") in ("leadway_pbm_whatsapp_1", "leadway_pbm_whatsapp_2"):
        # Enrich with the provider's facility so the message can show it
        provider_row = db.get(Provider, provider["sub"])
        serialized = _serialize(req)
        serialized["provider_facility"] = (provider_row.facility if provider_row else None) or (provider.get("name") if isinstance(provider, dict) else None)
        try:
            wa_resp = await whatsapp.dispatch_medication_request(serialized, channel=route.get("channel"))
            # Provider-facing label only — stash the raw wamid in the debug
            # logs, not on the tracking event. Members don't need to see
            # Meta message IDs or bot JSON.
            wamid = None
            if isinstance(wa_resp, dict):
                msgs = (wa_resp.get("wa_response") or {}).get("messages") or []
                if msgs and isinstance(msgs[0], dict):
                    wamid = msgs[0].get("id")
            if wamid:
                logger.info("WhatsApp delivered for %s → wamid=%s", req.id, wamid)
            db.add(TrackingEvent(
                request_id=req.id,
                label=f"Sent to Leadway PBM WhatsApp ({'#1' if route.get('channel') == 'leadway_pbm_whatsapp_1' else '#2'})",
                kind="done",
                icon="message-circle",
                at=datetime.now(timezone.utc),
            ))
            if req.status == "submitted":
                req.status = "routed"
        except WhatsAppError as e:
            logger.warning("WhatsApp dispatch failed for %s: %s", req.id, e)
            db.add(TrackingEvent(
                request_id=req.id,
                label="Awaiting retry of WhatsApp dispatch",
                kind="warn",
                icon="alert-triangle",
                note=str(e),
                at=datetime.now(timezone.utc),
            ))
        db.commit()
        db.refresh(req)

    # ── Member confirmation email (Prognosis SendEmailAlert) ──────────
    # Copy depends on the routing channel:
    #   wellahealth → "sent to our third-party partner, pharmacy confirms with OTP"
    #   anything else → "received, PBM team working on it"
    # Safe-fail: log + warn event, never block the submission.
    if settings.prognosis_username and settings.prognosis_password and req.enrollee_email:
        try:
            # Enrich the email context with provider facility + any
            # pharmacy metadata Wella returned in its create response.
            provider_row = db.get(Provider, provider["sub"])
            email_ctx = _serialize(req)
            email_ctx["provider_facility"] = (provider_row.facility if provider_row else None) or (provider.get("name") if isinstance(provider, dict) else None)
            email_ctx.update(wella_meta)
            subject, body = notifications.build_for(route.get("channel"), email_ctx)
            # Match the known-working Prognosis call exactly — category /
            # reference / transaction_type come back as "validation
            # failed" when populated with arbitrary strings. Leave empty.
            await prognosis.send_email(
                to=req.enrollee_email,
                subject=subject,
                body=body,
            )
            db.add(TrackingEvent(
                request_id=req.id,
                label=f"Member notified by email ({req.enrollee_email})",
                kind="done",
                icon="mail",
                at=datetime.now(timezone.utc),
            ))
        except PrognosisAuthError as e:
            logger.warning("Member email failed for %s: %s", req.id, e)
            db.add(TrackingEvent(
                request_id=req.id,
                label="Member email not sent (Prognosis)",
                kind="warn",
                icon="mail",
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


# Labels / label-prefixes that are ops-internal — PBM team cares, providers
# don't. Surfaced to admin via /admin/requests/{id}, hidden from provider
# tracking drawer. Keeps the provider view focused on "is my order in good
# hands" instead of leaking retry-pending / upstream-email failures.
_OPS_ONLY_LABEL_PREFIXES = (
    "Awaiting retry",
    "Member email not sent",
    "Member email failed",
)


def _provider_visible(e) -> bool:
    label = (e.label or "").strip()
    if any(label.startswith(p) for p in _OPS_ONLY_LABEL_PREFIXES):
        return False
    return True


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
        for e in req.events if _provider_visible(e)
    ]
    return TrackingOut(request_id=request_id, events=events)
