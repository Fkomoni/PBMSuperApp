"""WellaHealth client.

Docs: https://docs.wellahealth.com
Base: https://api.wellahealth.com
Auth: HTTP Basic (client_id:client_secret) + Partner-Code header.

NOTE: The three path constants + two payload builders below are the only
things to swap when you have the exact docs open. Everything else is
plumbing (auth headers, error wrapping, JSON normalisation).
"""
from __future__ import annotations

import base64
from typing import Any

import httpx

from app.core.config import settings

_TIMEOUT = httpx.Timeout(10.0, connect=4.0)


# ============================================================
# ⬇️  ADAPT: paste the exact paths from https://docs.wellahealth.com
# ============================================================
DRUG_SEARCH_PATH = "/v1/pharmacy/drugs/search"       # GET  — ?q=<drug>
DISPATCH_PATH    = "/v1/pharmacy/prescriptions"      # POST — body below
TRACKING_PATH    = "/v1/pharmacy/prescriptions/{id}"  # GET — prescription status
# ============================================================


class WellaHealthError(Exception):
    """Raised on transport / auth / validation failures."""


def _configured() -> bool:
    return bool(
        settings.wellahealth_base_url
        and settings.wellahealth_client_id
        and settings.wellahealth_client_secret
    )


def _auth_headers() -> dict:
    if not _configured():
        raise WellaHealthError("WellaHealth credentials are not configured")
    raw = f"{settings.wellahealth_client_id}:{settings.wellahealth_client_secret}".encode()
    encoded = base64.b64encode(raw).decode()
    headers = {
        "Authorization": f"Basic {encoded}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if settings.wellahealth_partner_code:
        # Two header names shipped so whichever WellaHealth expects wins.
        headers["Partner-Code"] = settings.wellahealth_partner_code
        headers["X-Partner-Code"] = settings.wellahealth_partner_code
    return headers


async def _get(path: str, params: dict | None = None) -> Any:
    url = settings.wellahealth_base_url.rstrip("/") + path
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, params=params or {}, headers=_auth_headers())
    except httpx.HTTPError as e:
        raise WellaHealthError(f"WellaHealth unreachable: {e}") from e

    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    if resp.status_code >= 400:
        msg = (isinstance(data, dict) and (data.get("message") or data.get("error"))) or f"WellaHealth error {resp.status_code}"
        raise WellaHealthError(str(msg))
    return data


async def _post(path: str, payload: dict) -> dict:
    url = settings.wellahealth_base_url.rstrip("/") + path
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=_auth_headers())
    except httpx.HTTPError as e:
        raise WellaHealthError(f"WellaHealth unreachable: {e}") from e

    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    if resp.status_code >= 400:
        msg = (isinstance(data, dict) and (data.get("message") or data.get("error"))) or f"WellaHealth error {resp.status_code}"
        raise WellaHealthError(str(msg))
    return data if isinstance(data, dict) else {"raw": data}


# ============================================================
# Drug tariff search
# ============================================================
async def search_tariff(query: str) -> list[dict]:
    """Returns a list of {drug_id, name, generic, unit_price, classification}.

    Returns [] if WellaHealth credentials aren't set, or on transient errors,
    so the frontend autocomplete never hangs.
    """
    if not _configured():
        return []
    try:
        data = await _get(DRUG_SEARCH_PATH, params={"q": query})
    except WellaHealthError:
        return []
    items = data.get("data") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []
    return [
        {
            "drug_id": d.get("id") or d.get("code") or d.get("drug_id"),
            "name": d.get("name") or d.get("brand_name") or d.get("drug_name"),
            "generic": d.get("generic") or d.get("generic_name"),
            "unit_price": d.get("price") or d.get("unit_price") or d.get("unitPrice"),
            "classification": d.get("classification"),
        }
        for d in items
        if d.get("name") or d.get("brand_name") or d.get("drug_name")
    ]


# ============================================================
# Dispatch a prescription
# ============================================================
def _dispatch_payload(request: dict) -> dict:
    """Shape for POST DISPATCH_PATH. Tweak the field names if the docs use
    different casing or additional required fields.
    """
    return {
        "partnerCode": settings.wellahealth_partner_code,
        "externalReference": request.get("id"),
        "member": {
            "enrolleeId": request.get("enrollee_id"),
            "name": request.get("enrollee_name"),
            "phone": request.get("member_phone") or request.get("alt_phone"),
            "email": request.get("member_email"),
            "state": request.get("enrollee_state"),
        },
        "delivery": request.get("delivery") or {},
        "diagnoses": request.get("diagnoses") or [],
        "prescription": [
            {
                "drugId": it.get("drug_id"),
                "drugName": it.get("drug_name"),
                "generic": it.get("generic"),
                "dosage": it.get("dosage"),
                "quantity": it.get("quantity"),
                "durationDays": it.get("duration_days"),
                "unitPrice": it.get("unit_price"),
                "classification": it.get("classification_hint") or request.get("classification"),
            }
            for it in (request.get("items") or [])
        ],
        "notes": request.get("notes"),
    }


async def dispatch_fulfilment(request: dict) -> dict:
    """Send an acute prescription to WellaHealth. See _dispatch_payload for shape."""
    if not _configured():
        raise WellaHealthError("WellaHealth credentials are not configured")
    return await _post(DISPATCH_PATH, _dispatch_payload(request))


# ============================================================
# Tracking
# ============================================================
async def tracking(wella_reference: str) -> dict:
    """Fetch current status of a prescription previously dispatched via
    dispatch_fulfilment. Returns the raw WellaHealth JSON; the caller is
    responsible for mapping its events onto TrackingEvent rows.
    """
    if not _configured():
        raise WellaHealthError("WellaHealth credentials are not configured")
    path = TRACKING_PATH.format(id=wella_reference)
    return await _get(path)
