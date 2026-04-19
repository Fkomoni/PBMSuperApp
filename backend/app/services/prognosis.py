"""Prognosis Provider-Login proxy + service-account calls (enrollee verify).

ADAPT: adapter points are clearly marked. Everything else reads config from
pydantic-settings.
"""
from __future__ import annotations

import base64
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import settings

_TIMEOUT = httpx.Timeout(8.0, connect=4.0)


class PrognosisAuthError(Exception):
    """Raised on invalid credentials or transport failure."""


@dataclass
class PrognosisProvider:
    provider_id: str
    name: str
    email: str
    prognosis_id: str | None = None
    facility: str | None = None
    phone: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


# ------------------------------------------------------------
# ADAPT #1 — Leadway ProviderLogIn endpoint
# ------------------------------------------------------------
LOGIN_PATH = "/api/ProviderNetwork/ProviderLogIn"


def _build_payload(email: str, password: str) -> dict:
    return {"Email": email, "Password": password}


# ------------------------------------------------------------
# ADAPT #2 — response → PrognosisProvider mapping
# ------------------------------------------------------------
def _from_response(data: dict, fallback_email: str) -> PrognosisProvider:
    # Common candidates across Leadway's APIs — keep the ones that apply.
    pid = (
        data.get("provider_id")
        or data.get("ProviderId")
        or data.get("ProviderID")
        or data.get("id")
        or data.get("Id")
    )
    name = (
        data.get("name")
        or data.get("Name")
        or data.get("FullName")
        or data.get("ProviderName")
        or fallback_email.split("@")[0]
    )
    email = data.get("email") or data.get("Email") or fallback_email
    prognosis_id = data.get("prognosis_id") or data.get("PrognosisId") or str(pid) if pid else None
    facility = data.get("facility") or data.get("Facility") or data.get("HospitalName") or data.get("ProviderLocation")
    phone = data.get("phone") or data.get("Phone") or data.get("Mobile")

    if not pid:
        # Fall back to email so we always have a stable subject for the JWT.
        pid = email.lower()

    return PrognosisProvider(
        provider_id=str(pid),
        name=str(name),
        email=str(email).lower(),
        prognosis_id=str(prognosis_id) if prognosis_id is not None else None,
        facility=str(facility) if facility else None,
        phone=str(phone) if phone else None,
        extra={k: v for k, v in data.items() if k.lower() not in {"password", "token"}},
    )


# ------------------------------------------------------------
# ADAPT #3 — how "unauthorized" looks
# ------------------------------------------------------------
def _is_auth_failure(resp: httpx.Response, data: Any) -> bool:
    if resp.status_code in (401, 403):
        return True
    if isinstance(data, dict):
        status = data.get("status") or data.get("Status")
        if isinstance(status, str) and status.lower() in {"fail", "failed", "error"}:
            return True
        if data.get("success") is False or data.get("Success") is False:
            return True
    return False


async def provider_login(email: str, password: str) -> PrognosisProvider:
    if not settings.prognosis_base_url:
        raise PrognosisAuthError("Prognosis base URL is not configured")

    url = settings.prognosis_base_url.rstrip("/") + LOGIN_PATH
    headers = {"Accept": "application/json", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=_build_payload(email, password), headers=headers)
    except httpx.HTTPError as e:
        raise PrognosisAuthError(f"Prognosis unreachable: {e}") from e

    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    if _is_auth_failure(resp, data):
        msg = (isinstance(data, dict) and (data.get("message") or data.get("Message"))) or "Invalid email or password"
        raise PrognosisAuthError(str(msg))

    if resp.status_code >= 400:
        raise PrognosisAuthError(f"Prognosis error ({resp.status_code})")

    # Some APIs wrap the provider object — try common envelopes.
    payload: dict = data if isinstance(data, dict) else {}
    for key in ("data", "Data", "provider", "Provider", "result", "Result"):
        if isinstance(payload.get(key), dict):
            payload = payload[key]
            break

    return _from_response(payload, fallback_email=email)


# ==================================================================
# Service-account calls (e.g. enrollee verify)
# Prognosis uses the backend's username + password to authorize these.
# ==================================================================

def _service_auth_headers() -> dict:
    if not (settings.prognosis_username and settings.prognosis_password):
        raise PrognosisAuthError("PROGNOSIS_USERNAME / PROGNOSIS_PASSWORD not configured")
    raw = f"{settings.prognosis_username}:{settings.prognosis_password}".encode()
    encoded = base64.b64encode(raw).decode()
    return {
        "Authorization": f"Basic {encoded}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


# ADAPT #4 — path + query shape for member verify.
# Leadway Prognosis exposes:
#   GET /api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID?enrolleeid=<id>
ENROLLEE_VERIFY_PATH = "/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID"


# ADAPT #5 — how the Prognosis enrollee response maps to the shape the
# frontend renders (see schemas/provider.py::EnrolleeOut). Edit here.
def _enrollee_from_response(data: dict) -> dict:
    first = data.get("FirstName") or data.get("Firstname") or data.get("firstname") or ""
    last  = data.get("LastName")  or data.get("Lastname")  or data.get("lastname")  or data.get("Surname") or ""
    full = data.get("FullName") or data.get("Name") or data.get("name") or f"{first} {last}".strip()
    return {
        "enrollee_id":  data.get("EnrolleeId")   or data.get("EnrolleeID")  or data.get("enrolleeid")   or data.get("MemberId") or data.get("enrollee_id"),
        "name":         full,
        "first_name":   first or (full.split(" ", 1)[0] if full else ""),
        "last_name":    last or (full.split(" ", 1)[1] if " " in full else ""),
        "scheme":       data.get("Scheme")       or data.get("SchemeName")  or data.get("PlanName")     or data.get("scheme"),
        "company":      data.get("CompanyName")  or data.get("Employer")    or data.get("Company")      or data.get("company"),
        "age":          data.get("Age")          or data.get("age"),
        "dob":          data.get("DateOfBirth")  or data.get("DOB")         or data.get("dob"),
        "gender":       data.get("Gender")       or data.get("gender"),
        "phone":        data.get("PhoneNumber")  or data.get("Mobile")      or data.get("Phone")        or data.get("phone"),
        "email":        data.get("Email")        or data.get("email"),
        "state":        data.get("State")        or data.get("state"),
        "status":       data.get("Status")       or data.get("EnrolleeStatus") or data.get("status"),
        "expiry_date":  data.get("PlanEndDate")  or data.get("ExpiryDate")  or data.get("ValidityEndDate") or data.get("expiry_date"),
        "flag":         (data.get("Flag") or data.get("RiskFlag") or "").lower() or None,
        "flag_reason":  data.get("FlagReason")   or data.get("flag_reason"),
        "vip":          data.get("IsVIP")        or data.get("vip")         or False,
        "medications":  data.get("ChronicMedications") or data.get("medications") or [],
    }


async def verify_enrollee(enrollee_id: str) -> dict | None:
    """Call Prognosis GetEnrolleeBioDataByEnrolleeID.

    Returns a dict matching EnrolleeOut, or None if Prognosis cannot find
    the member. Raises PrognosisAuthError on config / transport failure.
    """
    url = settings.prognosis_base_url.rstrip("/") + ENROLLEE_VERIFY_PATH
    headers = _service_auth_headers()

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, params={"enrolleeid": enrollee_id}, headers=headers)
    except httpx.HTTPError as e:
        raise PrognosisAuthError(f"Prognosis unreachable: {e}") from e

    if resp.status_code == 404:
        return None
    try:
        data = resp.json()
    except Exception:
        raise PrognosisAuthError(f"Prognosis returned non-JSON: {resp.text[:200]}")

    if resp.status_code >= 400:
        raise PrognosisAuthError(f"Prognosis error {resp.status_code}: {data}")

    # Unwrap common envelopes; accept both lists (first row) and objects.
    payload: Any = data
    if isinstance(payload, dict):
        for k in ("data", "Data", "enrollee", "Enrollee", "result", "Result", "Payload"):
            if k in payload:
                payload = payload[k]
                break
    if isinstance(payload, list):
        payload = payload[0] if payload else {}
    if not isinstance(payload, dict):
        return None

    if not (payload.get("EnrolleeId") or payload.get("enrollee_id") or payload.get("MemberId") or payload.get("EnrolleeID")):
        return None
    return _enrollee_from_response(payload)


# ==================================================================
# Email via Prognosis — POST /api/EnrolleeProfile/SendEmailAlert
# ==================================================================

EMAIL_ALERT_PATH = "/api/EnrolleeProfile/SendEmailAlert"


async def send_email(
    *,
    to: str,
    subject: str,
    body: str,
    cc: str = "",
    bcc: str = "",
    category: str = "",
    reference: str = "",
    provider_id: int = 0,
    user_id: int = 0,
    service_id: int = 0,
    transaction_type: str = "",
) -> dict:
    """Send a transactional email via Prognosis. Raises PrognosisAuthError on
    transport / auth failure; the caller decides whether to surface or swallow.
    """
    if not to:
        raise PrognosisAuthError("Recipient email is required")
    url = settings.prognosis_base_url.rstrip("/") + EMAIL_ALERT_PATH
    headers = _service_auth_headers()
    payload = {
        "EmailAddress": to,
        "CC": cc,
        "BCC": bcc,
        "Subject": subject,
        "MessageBody": body,
        "Attachments": None,
        "Category": category,
        "UserId": user_id,
        "ProviderId": provider_id,
        "ServiceId": service_id,
        "Reference": reference,
        "TransactionType": transaction_type,
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as e:
        raise PrognosisAuthError(f"Prognosis email unreachable: {e}") from e

    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    if resp.status_code >= 400:
        msg = (isinstance(data, dict) and (data.get("Message") or data.get("message"))) or f"Prognosis email error {resp.status_code}"
        raise PrognosisAuthError(str(msg))
    return data if isinstance(data, dict) else {"raw": data}
