"""Prognosis Provider-Login proxy.

ADAPT: three touch-points below if your Prognosis API differs from the
defaults. Everything else reads its config from pydantic-settings.

The wrapper always returns a normalized `PrognosisProvider` dataclass:
    provider_id, name, email, prognosis_id, facility, phone, extra

The API layer upserts a local Provider row against that, then mints a JWT.
"""
from __future__ import annotations

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
# ADAPT #1 — path + request shape
# ------------------------------------------------------------
# If Prognosis expects e.g. /Provider/Login with a PascalCase body,
# change PATH / _build_payload() to match.
LOGIN_PATH = "/api/Provider/ProviderLogIn"


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
    if settings.prognosis_api_key:
        headers["Authorization"] = f"Bearer {settings.prognosis_api_key}"

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
