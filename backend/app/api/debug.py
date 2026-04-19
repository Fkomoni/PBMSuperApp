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
    given enrollee ID. Use this to confirm which fields Prognosis actually
    returns (phone, email, state, etc.) so we can map them correctly.

    Public — read-only, member biographical data.
    """
    status_code, body = await prognosis._bearer_request(  # noqa: SLF001
        "GET", prognosis.ENROLLEE_VERIFY_PATH, params={"enrolleeid": enrollee_id}
    )
    return {
        "enrollee_id": enrollee_id,
        "status_code": status_code,
        "raw": body,
        "mapped": prognosis._enrollee_from_response(body) if isinstance(body, dict) else None,  # noqa: SLF001
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
