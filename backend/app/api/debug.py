"""Live diagnostics for the Prognosis integration.

ALL endpoints here are read-only and redact secrets. They exist so you can
answer "is the latest code live?" and "what exactly are we sending to
Prognosis?" without decoding production logs.

Admin-only — not exposed to providers.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Query

from app.core.config import settings
from app.core.security import current_admin
from app.services import prognosis

router = APIRouter(prefix="/_debug", tags=["debug"], dependencies=[Depends(current_admin)])


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
async def prognosis_config(_: dict = Depends(current_admin)):
    """Return what this running instance thinks its Prognosis config is.
    Includes timestamps on key files so you can confirm which commit Render
    is serving.
    """
    try:
        headers = prognosis._service_auth_headers()  # noqa: SLF001
        auth_hdr = headers.get("Authorization", "")
        scheme = auth_hdr.split(" ", 1)[0] if " " in auth_hdr else "(raw)"
        token_preview = (auth_hdr.split(" ", 1)[1] if " " in auth_hdr else auth_hdr)[:10]
        auth_ok = True
        auth_err = None
    except Exception as e:  # PrognosisAuthError or config issues
        scheme = None
        token_preview = None
        auth_ok = False
        auth_err = str(e)

    backend_root = Path(__file__).resolve().parents[2]
    return {
        "prognosis_base_url": settings.prognosis_base_url,
        "prognosis_username": _mask(settings.prognosis_username),
        "prognosis_password": "set" if settings.prognosis_password else "(empty)",
        "prognosis_auth_header_override": _mask(settings.prognosis_auth_header),
        "login_path": prognosis.LOGIN_PATH,
        "enrollee_verify_path": prognosis.ENROLLEE_VERIFY_PATH,
        "auth_resolution": {
            "ok": auth_ok,
            "scheme": scheme,
            "token_preview": token_preview,
            "error": auth_err,
        },
        "build_markers": {
            "prognosis_service_mtime": _file_mtime(str(backend_root / "app" / "services" / "prognosis.py")),
            "auth_api_mtime":          _file_mtime(str(backend_root / "app" / "api" / "auth.py")),
            "debug_api_mtime":         _file_mtime(__file__),
            "server_time_utc":         datetime.now(timezone.utc).isoformat(),
        },
    }


@router.post("/prognosis/test-login")
async def prognosis_test_login(
    email: str = Query(...),
    password: str = Query(...),
    _: dict = Depends(current_admin),
):
    """Fire a real Prognosis ProviderLogIn call with the creds you pass in
    and return the HTTP status + response body verbatim. Use this to see
    exactly what Prognosis says, without reading logs.

    Admins only. Don't ship real passwords across this endpoint on a shared
    network — use it from the Render shell or curl over HTTPS to your own
    deployment.
    """
    url = settings.prognosis_base_url.rstrip("/") + prognosis.LOGIN_PATH
    try:
        headers = prognosis._service_auth_headers()  # noqa: SLF001
    except Exception as e:
        return {
            "ok": False,
            "error": f"Service auth not configured: {e}",
            "url": url,
        }

    auth_hdr = headers.get("Authorization", "")
    scheme = auth_hdr.split(" ", 1)[0] if " " in auth_hdr else "(raw)"
    token_preview = (auth_hdr.split(" ", 1)[1] if " " in auth_hdr else auth_hdr)[:10]

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
            resp = await client.post(
                url,
                json=prognosis._build_payload(email, password),  # noqa: SLF001
                headers=headers,
            )
        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text}
        return {
            "url": url,
            "request_headers_sent": {
                "Authorization": f"{scheme} {token_preview}…",
                "Accept": headers.get("Accept"),
                "Content-Type": headers.get("Content-Type"),
            },
            "request_body_sent": {"Email": email, "Password": "***"},
            "status_code": resp.status_code,
            "response_body": body,
        }
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"Transport failure: {e}", "url": url}
