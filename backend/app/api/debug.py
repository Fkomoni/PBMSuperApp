"""Live diagnostics for the Prognosis / WellaHealth / WhatsApp integrations.

All routes are admin-only and only enabled when ENVIRONMENT is not production.
Sensitive data (credentials, bearer tokens, PHI) is never returned — even to
admins — because diagnostic output tends to end up in screenshots and tickets.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import _is_production, settings
from app.core.security import current_admin
from app.services import prognosis


def _debug_enabled_or_403() -> None:
    """Refuse every debug call in production. Debug endpoints fetch raw
    Prognosis payloads and send email/WhatsApp to arbitrary recipients —
    those are never safe on a customer-facing instance, even for admins.
    """
    if _is_production(settings.environment):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )


router = APIRouter(
    prefix="/_debug",
    tags=["debug"],
    dependencies=[Depends(_debug_enabled_or_403), Depends(current_admin)],
)


def _mask(value: str | None) -> str:
    if not value:
        return "(empty)"
    if len(value) <= 4:
        return "****"
    return value[:2] + "***" + value[-2:]


def _file_mtime(path: str) -> str:
    try:
        mt = os.path.getmtime(path)
        return datetime.fromtimestamp(mt, tz=timezone.utc).isoformat()
    except OSError:
        return "unknown"


@router.get("/prognosis")
async def prognosis_config():
    """Admin-only config summary. All sensitive fields are redacted."""
    backend_root = Path(__file__).resolve().parents[2]
    return {
        "prognosis_base_url": settings.prognosis_base_url,
        "prognosis_username": _mask(settings.prognosis_username),
        "prognosis_password": "set" if settings.prognosis_password else "(empty)",
        "prognosis_auth_header_override": "set" if settings.prognosis_auth_header else "(empty)",
        "paths": {
            "api_users_login": prognosis.API_USERS_LOGIN_PATH,
            "provider_login":  prognosis.LOGIN_PATH,
            "enrollee_verify": prognosis.ENROLLEE_VERIFY_PATH,
            "send_email":      prognosis.EMAIL_ALERT_PATH,
        },
        "service_bearer_cached": bool(prognosis.token_cache_info().get("bearer_set")),
        "build_markers": {
            "prognosis_service_mtime": _file_mtime(str(backend_root / "app" / "services" / "prognosis.py")),
            "auth_api_mtime":          _file_mtime(str(backend_root / "app" / "api" / "auth.py")),
            "debug_api_mtime":         _file_mtime(__file__),
            "server_time_utc":         datetime.now(timezone.utc).isoformat(),
        },
    }


@router.get("/wellahealth/config")
async def wellahealth_config():
    """Redacted WellaHealth config summary for troubleshooting."""
    cid = settings.wellahealth_client_id or ""
    cs  = settings.wellahealth_client_secret or ""
    pc  = settings.wellahealth_partner_code or ""
    return {
        "base_url": settings.wellahealth_base_url,
        "client_id": _mask(cid),
        "client_id_length": len(cid),
        "client_id_has_whitespace": cid != cid.strip() or "\n" in cid or "\r" in cid,
        "client_secret_set": bool(cs),
        "client_secret_length": len(cs),
        "client_secret_has_whitespace": cs != cs.strip() or "\n" in cs or "\r" in cs,
        "partner_code": _mask(pc),
    }


@router.get("/whatsapp/preview")
async def whatsapp_preview(channel: str = Query(default="leadway_pbm_whatsapp_1")):
    """Render the formatted WhatsApp message for a fixed synthetic request.
    Does NOT send anything and does NOT echo configured phone numbers.
    """
    from app.services import whatsapp as wa
    sample = {
        "id": "SAMPLE001",
        "ref_code": "RX-SAMPLE",
        "enrollee_id": "0000000/0",
        "enrollee_name": "Sample Member",
        "enrollee_phone": "000",
        "enrollee_state": "Lagos",
        "provider_facility": "Sample Facility",
        "urgency": "routine",
        "diagnoses": [{"code": "I10", "name": "Essential (primary) hypertension"}],
        "delivery": {"formatted": "Sample delivery address, Lagos, Nigeria"},
        "classification": "chronic",
        "channel": channel,
        "items": [
            {"drug_name": "Sample 10mg", "dosage": "1 tablet OD", "duration_days": 30,
             "classification_hint": "chronic"},
        ],
    }
    return {
        "channel": channel,
        "channel_configured": bool(wa.resolve_number(channel)),
        "message": wa.format_medication_request(sample),
    }
