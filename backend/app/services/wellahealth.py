"""WellaHealth client — Fulfilments + Pharmacy lookups.

Docs (Stoplight): https://stoplight.io/mocks/wellahealth/wellahealth-fulfilment-api-docs/108353307
Base: configured via WELLAHEALTH_BASE_URL (staging is https://staging.wellahealth.com,
production is https://api.wellahealth.com). Paths below are relative.
Auth: HTTP Basic (client_id:client_secret) + Partner-Code header.
"""
from __future__ import annotations

import base64
import re
from typing import Any

import httpx

from app.core.config import settings

_TIMEOUT = httpx.Timeout(10.0, connect=4.0)


# ── Endpoints (verbatim from docs) ───────────────────────────────────
FULFILMENTS_PATH        = "/public/v1/Fulfilments"
PHARMACY_STATE_PATH     = "/public/v1/Pharmacy/{stateName}"
PHARMACY_LGA_PATH       = "/public/v1/Pharmacy/{stateName}/{lgaName}"
PHARMACY_LGA_LIST_PATH  = "/public/v1/Pharmacy/{stateName}/lga"


class WellaHealthError(Exception):
    """Raised on transport / auth / validation failures."""


def _configured() -> bool:
    return bool(
        settings.wellahealth_base_url
        and settings.wellahealth_client_id
        and settings.wellahealth_client_secret
    )


def _auth_headers(extra: dict | None = None) -> dict:
    if not _configured():
        raise WellaHealthError("WellaHealth credentials are not configured")
    raw = f"{settings.wellahealth_client_id}:{settings.wellahealth_client_secret}".encode()
    encoded = base64.b64encode(raw).decode()
    headers: dict[str, str] = {
        "Authorization": f"Basic {encoded}",
        "Accept": "application/json, text/plain, text/json",
        "Content-Type": "application/json",
    }
    if settings.wellahealth_partner_code:
        headers["Partner-Code"] = settings.wellahealth_partner_code
        headers["X-Partner-Code"] = settings.wellahealth_partner_code
    if extra:
        headers.update(extra)
    return headers


async def _request(method: str, path: str, *, params: dict | None = None, body: dict | None = None) -> Any:
    url = settings.wellahealth_base_url.rstrip("/") + path
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.request(method, url, params=params, json=body, headers=_auth_headers())
    except httpx.HTTPError as e:
        raise WellaHealthError(f"WellaHealth unreachable: {e}") from e

    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    if resp.status_code >= 400:
        msg = (isinstance(data, dict) and (data.get("message") or data.get("error") or data.get("title"))) or f"WellaHealth error {resp.status_code}"
        raise WellaHealthError(str(msg))
    return data


# ==================================================================
# Fulfilments
# ==================================================================

# Map our internal classification to WellaHealth's fulfilmentService enum
# (allowed values: Telemedicine, Acute, Chronic).
def _map_service(classification: str | None) -> str:
    c = (classification or "").lower()
    if c == "chronic":
        return "Chronic"
    return "Acute"  # acute / mixed / fallback — Leadway only routes acute to Wella


# Normalize a gender string to Wella's enum (Female | Male | Other).
def _map_gender(g: str | None) -> str | None:
    g = (g or "").strip().lower()
    if g in ("f", "female"):
        return "Female"
    if g in ("m", "male"):
        return "Male"
    if g in ("o", "other"):
        return "Other"
    return None


def _split_name(full: str | None, first: str | None = None, last: str | None = None) -> tuple[str, str]:
    if first or last:
        return (first or "").strip() or "Member", (last or "").strip() or "-"
    parts = (full or "").strip().split()
    if len(parts) == 0:
        return "Member", "-"
    if len(parts) == 1:
        return parts[0], "-"
    return parts[0], " ".join(parts[1:])


_STRENGTH_RE = re.compile(r"(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|%|iu)(?:\/\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g))?)", re.I)
_FREQ_RE = re.compile(r"\b(OD|BD|BID|TDS|TID|QID|QD|PRN|Q\d+H|STAT|NOCTE|MANE)\b", re.I)


def _split_dosage(dosage: str | None) -> tuple[str, str]:
    """Split a free-form dosage like '10mg OD' into (strength, frequency)."""
    if not dosage:
        return "", ""
    s_match = _STRENGTH_RE.search(dosage)
    f_match = _FREQ_RE.search(dosage)
    strength = s_match.group(1).strip() if s_match else ""
    frequency = f_match.group(1).upper() if f_match else ""
    if not strength and not frequency:
        # Nothing matched — dump the full dosage into strength so nothing is lost.
        strength = dosage.strip()
    return strength, frequency


def build_fulfilment_payload(request: dict) -> dict:
    """Shape a persisted MedicationRequest (as serialized by api/requests.py::_serialize
    enriched with enrollee fields) into the WellaHealth Fulfilments payload.

    Raises WellaHealthError if required fields (enrollmentCode, names, phone,
    address) are missing so the caller can surface a clean error.
    """
    enrollment_code = request.get("enrollee_id") or request.get("enrollment_code")
    if not enrollment_code:
        raise WellaHealthError("enrollee_id is required")

    first, last = _split_name(
        request.get("enrollee_name"),
        first=request.get("enrollee_first_name"),
        last=request.get("enrollee_last_name"),
    )

    phone = request.get("enrollee_phone") or request.get("alt_phone") or ""
    if not phone:
        raise WellaHealthError("enrollee phone is required for WellaHealth fulfilment")

    delivery = request.get("delivery") or {}
    address = delivery.get("formatted") or request.get("enrollee_address") or ""
    if not address:
        raise WellaHealthError("delivery address is required for WellaHealth fulfilment")

    diagnoses = request.get("diagnoses") or []
    diag_text = ", ".join(
        f"{d.get('name')} ({d.get('code')})" if isinstance(d, dict) and d.get("code") else str(d.get("name") if isinstance(d, dict) else d)
        for d in diagnoses
    )

    drugs = []
    for it in request.get("items") or []:
        strength, frequency = _split_dosage(it.get("dosage"))
        drug_id = it.get("drug_id")
        try:
            drug_id_int = int(drug_id) if drug_id is not None and str(drug_id).isdigit() else 0
        except (TypeError, ValueError):
            drug_id_int = 0
        drugs.append({
            "id": drug_id_int,
            "name": it.get("drug_name") or it.get("generic") or "",
            "form": it.get("form") or "",
            "comment": it.get("notes") or "",
            "quantity": str(it.get("quantity") or ""),
            "strength": strength,
            "frequency": frequency,
            "duration": f"{it.get('duration_days')}" if it.get("duration_days") else "",
        })

    payload: dict = {
        "enrollmentCode": str(enrollment_code),
        "enrolleeFirstName": first,
        "enrolleeLastName": last,
        "enrolleePhone": phone,
        "enrolleeAddress": address,
        "fulfilmentService": _map_service(request.get("classification")),
        "isDelivery": bool(delivery),
        "drugs": drugs,
        "tests": [],
    }

    gender = _map_gender(request.get("enrollee_gender"))
    if gender:
        payload["enrolleeGender"] = gender
    if request.get("enrollee_email"):
        payload["enrolleeEmail"] = request["enrollee_email"]
    if request.get("enrollee_dob"):
        payload["enrolleeDateOfBirth"] = request["enrollee_dob"]
    if diag_text:
        payload["diagnosis"] = diag_text[:250]
    if request.get("notes"):
        payload["notes"] = request["notes"]
    if request.get("pre_auth_code"):
        payload["preAuthorizationCode"] = request["pre_auth_code"]
    if request.get("pharmacy_code"):
        payload["pharmacyCode"] = request["pharmacy_code"]

    return payload


async def create_fulfilment(request: dict) -> dict:
    """POST /public/v1/Fulfilments. Raises WellaHealthError on failure."""
    if not _configured():
        raise WellaHealthError("WellaHealth credentials are not configured")
    return await _request("POST", FULFILMENTS_PATH, body=build_fulfilment_payload(request))


async def list_fulfilments(page_index: int = 1, page_size: int = 50) -> Any:
    """GET /public/v1/Fulfilments?pageIndex=&pageSize="""
    if not _configured():
        raise WellaHealthError("WellaHealth credentials are not configured")
    return await _request("GET", FULFILMENTS_PATH, params={"pageIndex": page_index, "pageSize": page_size})


# Back-compat alias used by api/requests.py's dispatch block.
dispatch_fulfilment = create_fulfilment


# ==================================================================
# Pharmacy lookups
# ==================================================================
async def pharmacies_in_state(state: str, page_index: int = -1, page_size: int = -1) -> Any:
    return await _request("GET", PHARMACY_STATE_PATH.format(stateName=state),
                          params={"pageIndex": page_index, "pageSize": page_size})


async def pharmacies_in_lga(state: str, lga: str, page_index: int = -1, page_size: int = -1) -> Any:
    return await _request("GET", PHARMACY_LGA_PATH.format(stateName=state, lgaName=lga),
                          params={"pageIndex": page_index, "pageSize": page_size})


async def lgas_in_state(state: str) -> Any:
    return await _request("GET", PHARMACY_LGA_LIST_PATH.format(stateName=state))


# ==================================================================
# Legacy helper — kept so existing imports keep working, now returns [].
# WellaHealth doesn't expose a drug tariff search in the partner docs we
# have; use the Leadway drug_master table for autocomplete instead.
# ==================================================================
async def search_tariff(query: str) -> list[dict]:  # pragma: no cover
    return []
