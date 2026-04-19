"""Prognosis client.

Auth flow (two steps):
  1) Exchange service-account creds (PROGNOSIS_USERNAME/PASSWORD) for a
     Bearer token:  POST {base}/api/ApiUsers/Login
  2) Use that Bearer on every other call (ProviderLogIn, enrollee verify,
     SendEmailAlert, …).

The Bearer is cached in-process so we don't re-exchange on every call.
On any 401 from downstream endpoints we invalidate the cache once and
retry — handles token expiry transparently.

Env vars (app.core.config):
  PROGNOSIS_BASE_URL         e.g. https://prognosis-api.leadwayhealth.com
  PROGNOSIS_USERNAME
  PROGNOSIS_PASSWORD
  PROGNOSIS_AUTH_HEADER      (optional escape hatch — if set, used verbatim
                              as the Authorization header; the two-step
                              exchange is skipped)
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("rxhub.prognosis")
_TIMEOUT = httpx.Timeout(12.0, connect=4.0)


# ── Endpoints ────────────────────────────────────────────────────────
API_USERS_LOGIN_PATH = "/api/ApiUsers/Login"
LOGIN_PATH           = "/api/ProviderNetwork/ProviderLogIn"
ENROLLEE_VERIFY_PATH = "/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID"
EMAIL_ALERT_PATH     = "/api/EnrolleeProfile/SendEmailAlert"


class PrognosisAuthError(Exception):
    """Raised on transport / auth / unexpected-shape failures."""


@dataclass
class PrognosisProvider:
    provider_id: str
    name: str
    email: str
    prognosis_id: str | None = None
    facility: str | None = None
    phone: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


# ══════════════════════════════════════════════════════════════════════
# Step 1 — service-account Bearer token
# ══════════════════════════════════════════════════════════════════════

# Cache + lock. Cache stored as (bearer, issued_at_epoch). We refresh every
# 55 minutes or whenever a downstream call returns 401.
_TOKEN_CACHE: dict[str, Any] = {"bearer": None, "issued_at": 0.0}
_TOKEN_TTL_SECONDS = 55 * 60
_token_lock = asyncio.Lock()


def _api_users_login_payload(username: str, password: str) -> dict:
    # Tried both common Prognosis body shapes — PascalCase is the dominant
    # pattern on the other endpoints.
    return {"Username": username, "Password": password}


def _extract_bearer(data: Any) -> str | None:
    """Pull a Bearer token out of whatever /ApiUsers/Login returned."""
    if not isinstance(data, dict):
        return None
    # Unwrap common envelopes
    for key in ("data", "Data", "result", "Result"):
        if isinstance(data.get(key), dict):
            data = data[key]
            break
    # Common key names across .NET / Node shops
    for k in ("access_token", "accessToken", "AccessToken",
             "token", "Token", "bearer", "Bearer", "bearerToken", "BearerToken"):
        v = data.get(k)
        if isinstance(v, str) and v:
            return v
    return None


async def _fetch_api_token() -> str:
    if settings.prognosis_auth_header:
        # Escape hatch — caller wants a verbatim header, no exchange needed.
        raise PrognosisAuthError("Using PROGNOSIS_AUTH_HEADER override — exchange skipped")
    if not (settings.prognosis_username and settings.prognosis_password):
        raise PrognosisAuthError("PROGNOSIS_USERNAME / PROGNOSIS_PASSWORD are not configured")

    url = settings.prognosis_base_url.rstrip("/") + API_USERS_LOGIN_PATH
    body = _api_users_login_payload(settings.prognosis_username, settings.prognosis_password)
    logger.info("ApiUsers/Login POST %s (user=%s)", url, settings.prognosis_username)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=body, headers={"Accept": "application/json", "Content-Type": "application/json"})
    except httpx.HTTPError as e:
        raise PrognosisAuthError(f"ApiUsers/Login transport failure: {e}") from e

    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    snippet = str(data)[:400]
    logger.info("ApiUsers/Login → HTTP %s · body=%s", resp.status_code, snippet)

    if resp.status_code >= 400:
        raise PrognosisAuthError(f"ApiUsers/Login rejected ({resp.status_code}): {snippet[:200]}")
    bearer = _extract_bearer(data)
    if not bearer:
        raise PrognosisAuthError(f"ApiUsers/Login returned no token. Body={snippet[:200]}")
    return bearer


async def _get_bearer(force: bool = False) -> str:
    """Return a cached Bearer, refreshing if stale or if `force` is set."""
    if settings.prognosis_auth_header:
        # Shouldn't be called in this mode, but just in case:
        return settings.prognosis_auth_header.removeprefix("Bearer ").strip()

    now = time.time()
    if not force and _TOKEN_CACHE["bearer"] and (now - _TOKEN_CACHE["issued_at"] < _TOKEN_TTL_SECONDS):
        return _TOKEN_CACHE["bearer"]
    async with _token_lock:
        # Re-check inside the lock so concurrent callers share one exchange.
        if not force and _TOKEN_CACHE["bearer"] and (time.time() - _TOKEN_CACHE["issued_at"] < _TOKEN_TTL_SECONDS):
            return _TOKEN_CACHE["bearer"]
        bearer = await _fetch_api_token()
        _TOKEN_CACHE["bearer"] = bearer
        _TOKEN_CACHE["issued_at"] = time.time()
        return bearer


def _invalidate_token():
    _TOKEN_CACHE["bearer"] = None
    _TOKEN_CACHE["issued_at"] = 0.0


async def _auth_headers(force_refresh: bool = False) -> dict:
    """Authorization headers for every downstream Prognosis call."""
    if settings.prognosis_auth_header:
        value = settings.prognosis_auth_header
        logger.info("Using PROGNOSIS_AUTH_HEADER override (%s)", value.split()[0] if " " in value else "raw")
        return {
            "Authorization": value,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
    bearer = await _get_bearer(force=force_refresh)
    return {
        "Authorization": f"Bearer {bearer}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


async def _bearer_request(method: str, path: str, *, params: dict | None = None, body: dict | None = None) -> tuple[int, Any]:
    """Call a Prognosis endpoint with the service Bearer. On 401 we refresh
    the token once and retry — transparent to callers.
    """
    url = settings.prognosis_base_url.rstrip("/") + path

    for attempt in (0, 1):
        headers = await _auth_headers(force_refresh=(attempt == 1))
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.request(method, url, params=params, json=body, headers=headers)
        except httpx.HTTPError as e:
            raise PrognosisAuthError(f"Transport failure calling {path}: {e}") from e

        if resp.status_code == 401 and attempt == 0:
            logger.info("Prognosis 401 on %s — refreshing service token + retrying", path)
            _invalidate_token()
            continue

        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text}
        return resp.status_code, data

    raise PrognosisAuthError("Prognosis returned 401 twice in a row — check PROGNOSIS_USERNAME/PASSWORD")


# ══════════════════════════════════════════════════════════════════════
# Step 2 — ProviderLogIn
# ══════════════════════════════════════════════════════════════════════

def _build_login_payload(email: str, password: str) -> dict:
    return {"Email": email, "Password": password}


def _is_credential_reject(status_code: int, data: Any) -> bool:
    # Genuine provider-credential rejection (vs a header/token issue).
    if status_code in (401, 403):
        if isinstance(data, dict):
            msg = str(data.get("message") or data.get("Message") or "").lower()
            if "invalid" in msg and ("password" in msg or "credential" in msg or "email" in msg):
                return True
            if "not found" in msg or "does not exist" in msg:
                return True
            # Plain 401 without a helpful message we'll still treat as cred reject
            # — we've already refreshed the token in _bearer_request.
            return True
    return False


def _provider_from_response(data: dict, fallback_email: str) -> PrognosisProvider:
    # Unwrap envelopes
    if isinstance(data, dict):
        for k in ("data", "Data", "provider", "Provider", "result", "Result"):
            if isinstance(data.get(k), dict):
                data = data[k]
                break
    first = data.get("FirstName") or data.get("firstname") or ""
    last  = data.get("LastName")  or data.get("lastname")  or data.get("Surname") or ""
    full = data.get("FullName") or data.get("Name") or data.get("ProviderName") or f"{first} {last}".strip()
    pid = (
        data.get("ProviderId") or data.get("ProviderID") or data.get("provider_id")
        or data.get("Id") or data.get("id")
    )
    email = data.get("Email") or data.get("email") or fallback_email
    return PrognosisProvider(
        provider_id=str(pid or email.lower()),
        name=str(full or fallback_email.split("@")[0]),
        email=str(email).lower(),
        prognosis_id=str(data.get("PrognosisId") or pid) if pid else None,
        facility=data.get("Facility") or data.get("HospitalName") or data.get("ProviderLocation"),
        phone=data.get("Phone") or data.get("Mobile") or data.get("PhoneNumber"),
        extra={k: v for k, v in data.items() if k.lower() not in ("password", "token")},
    )


async def provider_login(email: str, password: str) -> PrognosisProvider:
    if not settings.prognosis_base_url:
        raise PrognosisAuthError("Prognosis base URL is not configured")

    status_code, data = await _bearer_request(
        "POST", LOGIN_PATH, body=_build_login_payload(email, password)
    )
    snippet = str(data)[:400]
    logger.info("ProviderLogIn %s → HTTP %s · body=%s", email, status_code, snippet)

    if _is_credential_reject(status_code, data):
        msg = (isinstance(data, dict) and (data.get("message") or data.get("Message"))) or "Invalid email or password"
        raise PrognosisAuthError(str(msg))
    if status_code >= 400:
        raise PrognosisAuthError(f"Prognosis error ({status_code}): {snippet[:200]}")

    return _provider_from_response(data if isinstance(data, dict) else {}, fallback_email=email)


# ══════════════════════════════════════════════════════════════════════
# Enrollee verify
# ══════════════════════════════════════════════════════════════════════

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
    status_code, data = await _bearer_request(
        "GET", ENROLLEE_VERIFY_PATH, params={"enrolleeid": enrollee_id}
    )
    if status_code == 404:
        return None
    if status_code >= 400:
        raise PrognosisAuthError(f"Prognosis error {status_code}: {str(data)[:200]}")

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


# ══════════════════════════════════════════════════════════════════════
# Email
# ══════════════════════════════════════════════════════════════════════

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
    if not to:
        raise PrognosisAuthError("Recipient email is required")
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
    status_code, data = await _bearer_request("POST", EMAIL_ALERT_PATH, body=payload)
    if status_code >= 400:
        msg = (isinstance(data, dict) and (data.get("Message") or data.get("message"))) or f"Prognosis email error {status_code}"
        raise PrognosisAuthError(str(msg))
    return data if isinstance(data, dict) else {"raw": data}


# ══════════════════════════════════════════════════════════════════════
# Introspection helpers (used by /_debug/prognosis)
# ══════════════════════════════════════════════════════════════════════

def token_cache_info() -> dict:
    """Return the state of the service-Bearer cache for diagnostics."""
    bearer = _TOKEN_CACHE.get("bearer") or ""
    issued = _TOKEN_CACHE.get("issued_at") or 0
    age = int(time.time() - issued) if issued else None
    return {
        "bearer_set": bool(bearer),
        "bearer_preview": (bearer[:10] + "…") if bearer else None,
        "issued_at_epoch": issued,
        "age_seconds": age,
        "ttl_seconds": _TOKEN_TTL_SECONDS,
    }
