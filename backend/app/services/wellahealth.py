"""WellaHealth client.

Docs: https://docs.wellahealth.com
Base: https://api.wellahealth.com
Auth: HTTP Basic (client_id:client_secret) + Partner-Code header.

ADAPT: two path/payload touch-points below. Fill in the exact endpoint
names + JSON fields once you've picked the WellaHealth flows you use
(tariff, pharmacy search, and prescription dispatch are the three we care
about). Everything else reads from `app.core.config.settings`.
"""
from __future__ import annotations

import base64
from typing import Any

import httpx

from app.core.config import settings

_TIMEOUT = httpx.Timeout(10.0, connect=4.0)


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
        # Docs reference "Partner-Code" for most partner endpoints; some use
        # "X-Partner-Code". Add both to be safe.
        headers["Partner-Code"] = settings.wellahealth_partner_code
        headers["X-Partner-Code"] = settings.wellahealth_partner_code
    return headers


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


# ============================================================
# ADAPT #1 — drug tariff / search
# ============================================================
async def search_tariff(query: str) -> list[dict]:
    """Drug tariff search. Replace `/v1/pharmacy/drugs/search` with the exact
    path from the WellaHealth docs and adjust the response shape.
    """
    if not _configured():
        return []
    try:
        data = await _get("/v1/pharmacy/drugs/search", params={"q": query})
    except WellaHealthError:
        return []
    items = data.get("data") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []
    return [
        {
            "drug_id": d.get("id") or d.get("code"),
            "name": d.get("name") or d.get("brand_name"),
            "generic": d.get("generic") or d.get("generic_name"),
            "unit_price": d.get("price") or d.get("unit_price"),
            "classification": d.get("classification"),
        }
        for d in items
        if d.get("name") or d.get("brand_name")
    ]


# ============================================================
# ADAPT #2 — dispatch a prescription to WellaHealth for fulfilment
# ============================================================
async def dispatch_fulfilment(request: dict) -> dict:
    """Send an acute prescription to WellaHealth for fulfilment.

    `request` is the serialized MedicationRequest (see api/requests.py::_serialize)
    enriched with member contact + delivery. The default payload here matches
    WellaHealth's partner-intake pattern; adjust field names once you have the
    exact docs open.
    """
    if not _configured():
        raise WellaHealthError("WellaHealth credentials are not configured")

    payload = {
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

    return await _post("/v1/pharmacy/prescriptions", payload)
