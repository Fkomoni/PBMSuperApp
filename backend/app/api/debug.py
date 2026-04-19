"""Live diagnostics for the Prognosis integration."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Query

from app.core.config import settings
from app.core.security import current_admin
from app.services import prognosis

router = APIRouter(prefix="/_debug", tags=["debug"])


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
    """Live Prognosis config, file mtimes, and service-Bearer cache state.
    Public — all sensitive fields are redacted.
    """
    # Don't try to fetch a fresh token here (network hop). Just show cache.
    token_info = prognosis.token_cache_info()

    backend_root = Path(__file__).resolve().parents[2]
    return {
        "prognosis_base_url": settings.prognosis_base_url,
        "prognosis_username": _mask(settings.prognosis_username),
        "prognosis_password": "set" if settings.prognosis_password else "(empty)",
        "prognosis_auth_header_override": _mask(settings.prognosis_auth_header),
        "paths": {
            "api_users_login": prognosis.API_USERS_LOGIN_PATH,
            "provider_login":  prognosis.LOGIN_PATH,
            "enrollee_verify": prognosis.ENROLLEE_VERIFY_PATH,
            "send_email":      prognosis.EMAIL_ALERT_PATH,
        },
        "service_bearer_cache": token_info,
        "build_markers": {
            "prognosis_service_mtime": _file_mtime(str(backend_root / "app" / "services" / "prognosis.py")),
            "auth_api_mtime":          _file_mtime(str(backend_root / "app" / "api" / "auth.py")),
            "debug_api_mtime":         _file_mtime(__file__),
            "server_time_utc":         datetime.now(timezone.utc).isoformat(),
        },
    }


@router.get("/prognosis/enrollee/{enrollee_id:path}")
async def prognosis_enrollee_raw(enrollee_id: str):
    """Fetch the RAW Prognosis GetEnrolleeBioDataByEnrolleeID response for a
    given enrollee ID. Strips the giant base64 picture payload so you can
    actually read the fields that matter. Returns {status_code, keys, raw, mapped}.
    Public — read-only, member biographical data.
    """
    status_code, body = await prognosis._bearer_request(  # noqa: SLF001
        "GET", prognosis.ENROLLEE_VERIFY_PATH, params={"enrolleeid": enrollee_id}
    )
    raw = body
    if isinstance(raw, dict):
        raw = {
            k: (f"<base64 ({len(v)} chars)>" if isinstance(v, str) and len(v) > 500 else v)
            for k, v in raw.items()
        }
    keys = sorted(list(body.keys())) if isinstance(body, dict) else None
    return {
        "enrollee_id": enrollee_id,
        "status_code": status_code,
        "keys": keys,
        "raw": raw,
        "mapped": prognosis._enrollee_from_response(body) if isinstance(body, dict) else None,  # noqa: SLF001
    }


@router.get("/prognosis/send-test-email")
async def prognosis_send_test_email(
    to: str = Query(..., description="Recipient email address"),
):
    """Fire the exact same SendEmailAlert payload you shared as a
    known-working call, just with the recipient swapped. If this
    still returns 'fail: Email sending failed', the issue is upstream
    (Prognosis mail relay, whitelist, etc.) — not our wire format.
    """
    try:
        resp = await prognosis.send_email(
            to=to,
            subject="Testint api for Email",
            body="welcome and This is a test email",
        )
        return {"ok": True, "prognosis_response": resp}
    except prognosis.PrognosisAuthError as e:
        return {"ok": False, "error": str(e), "cache": prognosis.token_cache_info()}


@router.get("/prognosis/send-test-email-verbose")
async def prognosis_send_test_email_verbose(
    to: str = Query(..., description="Recipient email address"),
    auth: str = Query(default="bearer", description="bearer | basic | none"),
):
    """Show exactly what we send to Prognosis SendEmailAlert + what we get
    back. Tries different auth schemes so we can see which one the endpoint
    actually expects.
    """
    import base64
    import httpx

    url = settings.prognosis_base_url.rstrip("/") + prognosis.EMAIL_ALERT_PATH
    payload = {
        "EmailAddress": to,
        "CC": "",
        "BCC": "",
        "Subject": "Testint api for Email",
        "MessageBody": "welcome and This is a test email",
        "Attachments": None,
        "Category": "",
        "UserId": 0,
        "ProviderId": 0,
        "ServiceId": 0,
        "Reference": "",
        "TransactionType": "",
    }

    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    auth_repr = "(none)"
    if auth == "bearer":
        bearer = await prognosis._get_bearer()  # noqa: SLF001
        headers["Authorization"] = f"Bearer {bearer}"
        auth_repr = f"Bearer {bearer[:10]}…"
    elif auth == "basic":
        if not (settings.prognosis_username and settings.prognosis_password):
            return {"ok": False, "error": "PROGNOSIS_USERNAME/PASSWORD not set"}
        raw = f"{settings.prognosis_username}:{settings.prognosis_password}".encode()
        headers["Authorization"] = "Basic " + base64.b64encode(raw).decode()
        auth_repr = "Basic <user>:<pw>"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.post(url, json=payload, headers=headers)
        body_text = resp.text
        try:
            body_parsed = resp.json()
        except Exception:
            body_parsed = None
    except httpx.HTTPError as e:
        return {"ok": False, "error": str(e), "url": url, "auth": auth_repr}

    # Equivalent cURL so you can copy/run it yourself to compare
    import json as _json
    curl_parts = [f"curl -X POST '{url}'"]
    for k, v in headers.items():
        if k.lower() == "authorization":
            curl_parts.append(f"-H '{k}: <redacted>'")
        else:
            curl_parts.append(f"-H '{k}: {v}'")
    curl_parts.append(f"--data '{_json.dumps(payload)}'")

    return {
        "auth_mode":     auth,
        "auth_sent":     auth_repr,
        "request_url":   url,
        "request_headers": {k: ("<redacted>" if k.lower() == "authorization" else v) for k, v in headers.items()},
        "request_body":  payload,
        "curl_equivalent": " \\\n  ".join(curl_parts),
        "response_status": resp.status_code,
        "response_headers": dict(resp.headers),
        "response_body_text":   body_text[:2000],
        "response_body_parsed": body_parsed,
    }


@router.get("/whatsapp/config")
async def whatsapp_config():
    """Show the WhatsApp bot URL/path this instance will POST to, plus
    which env vars are populated. Redacted numbers. Use this after
    changing WHATSAPP_SEND_PATH to confirm the new value is live.
    """
    from app.services import whatsapp as wa
    full_url = settings.whatsapp_bot_url.rstrip("/") + (settings.whatsapp_send_path or "/send")
    return {
        "bot_url": settings.whatsapp_bot_url,
        "send_path": settings.whatsapp_send_path or "/send",
        "full_post_url": full_url,
        "number_whatsapp_1_set": bool(settings.whatsapp_number_acute_lagos),
        "number_whatsapp_2_set": bool(settings.whatsapp_number_chronic),
        "sample_payload": wa._build_payload("+234XXXXXXXXXX", "NEW MEDICATION REQUEST ..."),  # noqa: SLF001
    }


@router.get("/whatsapp/probe")
async def whatsapp_probe(
    path: str = Query(default=None, description="Path to POST to; defaults to WHATSAPP_SEND_PATH"),
    to: str = Query(default="+2348188626141"),
    message: str = Query(default="RxHub probe - ignore"),
):
    """POST a one-line test message to a path on the bot and return what
    comes back. Uses the configured field names (WHATSAPP_FIELD_PHONE /
    WHATSAPP_FIELD_MESSAGE). Example:

        /api/v1/_debug/whatsapp/probe                       (uses configured path)
        /api/v1/_debug/whatsapp/probe?path=/send-message
        /api/v1/_debug/whatsapp/probe?path=/messages&to=+234...
    """
    import httpx
    from app.services import whatsapp as wa

    if not settings.whatsapp_bot_url:
        return {"ok": False, "error": "WHATSAPP_BOT_URL not set"}

    effective_path = path or settings.whatsapp_send_path or "/send-message"
    if not effective_path.startswith("/"):
        effective_path = "/" + effective_path
    url = settings.whatsapp_bot_url.rstrip("/") + effective_path
    payload = wa._build_payload(to, message)  # noqa: SLF001

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
            resp = await client.post(url, json=payload, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body_text = resp.text
        try:
            body_parsed = resp.json()
        except Exception:
            body_parsed = None
    except httpx.HTTPError as e:
        return {"ok": False, "error": str(e), "url": url}

    return {
        "request_url": url,
        "request_body": payload,
        "response_status": resp.status_code,
        "response_headers": dict(resp.headers),
        "response_body_text": body_text[:1500],
        "response_body_parsed": body_parsed,
    }


@router.get("/whatsapp/preview")
async def whatsapp_preview(channel: str = Query(default="leadway_pbm_whatsapp_1")):
    """Render the exact WhatsApp message the bot would receive for a
    sample chronic request. Use to sanity-check formatting before
    submitting real prescriptions.
    """
    from app.services import whatsapp as wa
    sample = {
        "id": "SAMPLE001",
        "ref_code": "RX-20260412-48E012",
        "enrollee_id": "21000645/0",
        "enrollee_name": "Mbaekwe Nkiru",
        "enrollee_phone": "08188626141",
        "enrollee_state": "Lagos",
        "provider_facility": "PHARMACY BENEFIT PROGRAMME",
        "treating_doctor": None,
        "urgency": "routine",
        "diagnoses": [{"code": "I10", "name": "Essential (primary) hypertension"}],
        "delivery": {"formatted": "17 Ajanaku St, Opebi, Lagos 101233, Lagos, Nigeria"},
        "classification": "chronic",
        "channel": channel,
        "items": [
            {"drug_name": "Amlodipine 10mg", "dosage": "2 tablets bd", "duration_days": 5,
             "classification_hint": "chronic"},
            {"drug_name": "Lisinopril 5mg", "dosage": "2 tablets bd", "duration_days": None,
             "classification_hint": "chronic"},
        ],
    }
    return {
        "channel": channel,
        "would_send_to": wa.resolve_number(channel) or "(not configured)",
        "bot_url": settings.whatsapp_bot_url,
        "message": wa.format_medication_request(sample),
    }


@router.post("/whatsapp/send-test")
async def whatsapp_send_test(
    channel: str = Query(default="leadway_pbm_whatsapp_1"),
    to_override: str | None = Query(default=None, description="Override recipient for testing"),
):
    """Fire a sample medication request through the bot for real."""
    from app.services import whatsapp as wa
    sample = {
        "id": "SAMPLE001",
        "ref_code": "RX-TEST-000001",
        "enrollee_id": "21000645/0",
        "enrollee_name": "Mbaekwe Nkiru",
        "enrollee_phone": "08188626141",
        "enrollee_state": "Lagos",
        "provider_facility": "PHARMACY BENEFIT PROGRAMME",
        "urgency": "routine",
        "diagnoses": [{"code": "I10", "name": "Essential (primary) hypertension"}],
        "delivery": {"formatted": "17 Ajanaku St, Opebi, Lagos, Nigeria"},
        "classification": "chronic",
        "channel": channel,
        "items": [
            {"drug_name": "Amlodipine 10mg", "dosage": "2 tablets bd", "duration_days": 5,
             "classification_hint": "chronic"},
        ],
    }
    try:
        msg = wa.format_medication_request(sample)
        to = to_override or wa.resolve_number(channel)
        if not to:
            return {"ok": False, "error": f"No number configured for {channel}"}
        resp = await wa.send_message(to, msg)
        return {"ok": True, "to": to, "message": msg, "bot_response": resp}
    except wa.WhatsAppError as e:
        return {"ok": False, "error": str(e)}


@router.get("/request/{request_id}")
async def request_state(request_id: str):
    """Diagnostic: show the full routing decision + tracking timeline for
    a request. Public so you can hit it from a browser.
    """
    from sqlalchemy.orm import Session as _Session
    from app.core.db import SessionLocal
    from app.models import MedicationRequest, TrackingEvent
    from app.services import whatsapp as wa

    db: _Session = SessionLocal()
    try:
        req = db.get(MedicationRequest, request_id)
        if not req:
            return {"ok": False, "error": f"Request {request_id} not found"}
        events = [
            {"at": str(e.at), "label": e.label, "kind": e.kind, "icon": e.icon, "note": e.note}
            for e in sorted(req.events, key=lambda x: x.at or __import__("datetime").datetime.min)
        ]
        items = [
            {"drug_name": it.drug_name, "dosage": it.dosage, "duration_days": it.duration_days,
             "classification_hint": it.classification_hint}
            for it in req.items
        ]
        return {
            "id": req.id,
            "ref_code": req.ref_code,
            "classification": req.classification,
            "channel": req.channel,
            "route": req.route,
            "status": req.status,
            "enrollee_state": req.enrollee_state,
            "enrollee_name": req.enrollee_name,
            "enrollee_phone": req.enrollee_phone,
            "enrollee_email": req.enrollee_email,
            "items": items,
            "events": events,
            "whatsapp_configured_for_channel":
                bool(wa.resolve_number(req.channel)) if req.channel else None,
            "whatsapp_channel_would_go_to": wa.resolve_number(req.channel) if req.channel else None,
        }
    finally:
        db.close()


@router.get("/wellahealth/config")
async def wellahealth_config():
    """Show what WellaHealth credentials this instance thinks it has.
    All values redacted — safe to open from a browser.
    """
    import base64
    cid = settings.wellahealth_client_id or ""
    cs  = settings.wellahealth_client_secret or ""
    pc  = settings.wellahealth_partner_code or ""
    combined = f"{cid}:{cs}"
    basic_preview = base64.b64encode(combined.encode()).decode()[:12] + "…" if cid and cs else None
    return {
        "base_url": settings.wellahealth_base_url,
        "client_id": _mask(cid),
        "client_id_length": len(cid),
        "client_id_has_whitespace": cid != cid.strip() or "\n" in cid or "\r" in cid,
        "client_secret_set": bool(cs),
        "client_secret_length": len(cs),
        "client_secret_has_whitespace": cs != cs.strip() or "\n" in cs or "\r" in cs,
        "partner_code": _mask(pc),
        "partner_code_has_whitespace": pc != pc.strip() or "\n" in pc or "\r" in pc,
        "basic_auth_preview": basic_preview,
    }


@router.get("/wellahealth/ping")
async def wellahealth_ping():
    """Fire the lightest Wella endpoint (GET /public/v1/Fulfilments with
    pageSize=1) and return exactly what we send + what they say back. If
    auth's broken this is where we'll see the failure clearly.
    """
    import base64
    import httpx

    cid = (settings.wellahealth_client_id or "").strip()
    cs  = (settings.wellahealth_client_secret or "").strip()
    pc  = (settings.wellahealth_partner_code or "").strip()
    if not (cid and cs):
        return {"ok": False, "error": "WELLAHEALTH_CLIENT_ID or _SECRET not configured"}

    url = settings.wellahealth_base_url.rstrip("/") + "/public/v1/Fulfilments"
    raw = f"{cid}:{cs}".encode()
    encoded = base64.b64encode(raw).decode()
    headers = {
        "Authorization": f"Basic {encoded}",
        "Accept": "application/json, text/plain, text/json",
        "Content-Type": "application/json",
    }
    if pc:
        headers["Partner-Code"] = pc
        headers["X-Partner-Code"] = pc

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
            resp = await client.get(url, params={"pageIndex": 1, "pageSize": 1}, headers=headers)
        body_text = resp.text
        try:
            body_parsed = resp.json()
        except Exception:
            body_parsed = None
    except httpx.HTTPError as e:
        return {"ok": False, "error": str(e), "url": url}

    return {
        "request_url": url,
        "request_headers": {k: ("<redacted>" if k.lower() == "authorization" else v) for k, v in headers.items()},
        "basic_token_length": len(encoded),
        "basic_token_preview": encoded[:12] + "…",
        "response_status": resp.status_code,
        "response_headers": dict(resp.headers),
        "response_body_text": body_text[:2000],
        "response_body_parsed": body_parsed,
    }


@router.post("/prognosis/refresh-token")
async def prognosis_refresh_token():
    """Force-exchange the service creds for a new Bearer. Returns the
    resulting cache state (token preview only). Public so you can prove
    Prognosis accepts your service account before wiring in providers.
    """
    try:
        bearer = await prognosis._get_bearer(force=True)  # noqa: SLF001
        return {
            "ok": True,
            "bearer_preview": bearer[:12] + "…",
            "cache": prognosis.token_cache_info(),
        }
    except prognosis.PrognosisAuthError as e:
        return {"ok": False, "error": str(e)}


@router.post("/prognosis/test-login", dependencies=[Depends(current_admin)])
async def prognosis_test_login(
    email: str = Query(...),
    password: str = Query(...),
):
    """Live ProviderLogIn test — admin-only since it takes a real password.

    Returns the Prognosis response status + body verbatim so you can see
    exactly what happens for any given provider.
    """
    try:
        pp = await prognosis.provider_login(email, password)
        return {"ok": True, "provider": pp.__dict__}
    except prognosis.PrognosisAuthError as e:
        return {"ok": False, "error": str(e), "cache": prognosis.token_cache_info()}
