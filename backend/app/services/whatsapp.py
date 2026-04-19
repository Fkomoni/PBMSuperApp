"""Leadway WhatsApp bot client.

Formats a new medication request into the plain-text template the PBM
team uses on WhatsApp and POSTs it to the bot.

ADAPT: SEND_PATH + _build_payload if your bot expects a different path
or field names. Everything else reads from app.core.config.settings.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("rxhub.whatsapp")
_TIMEOUT = httpx.Timeout(10.0, connect=4.0)


# ============================================================
# ⬇️  ADAPT: path + request shape expected by the bot
# Path now comes from WHATSAPP_SEND_PATH env var (default "/send").
# Override per-deploy without a code change.
# ============================================================
def _send_path() -> str:
    return settings.whatsapp_send_path or "/send"


def _build_payload(to: str, message: str) -> dict:
    # Field names come from settings so you can swap them per bot:
    #   Leadway bot default:  {"phone": ..., "message": ...}
    #   Meta cloud style:     {"phone": ..., "text": ...}
    #   Twilio-alike:         {"to": ..., "message": ...}
    # Override via WHATSAPP_FIELD_PHONE / WHATSAPP_FIELD_MESSAGE env vars.
    return {
        (settings.whatsapp_field_phone or "phone"): to,
        (settings.whatsapp_field_message or "message"): message,
    }
# ============================================================


class WhatsAppError(Exception):
    pass


def _configured() -> bool:
    return bool(settings.whatsapp_bot_url)


def resolve_number(channel: str | None) -> str | None:
    """Map an internal routing channel to a WhatsApp phone number env var."""
    if channel == "leadway_pbm_whatsapp_1":
        return settings.whatsapp_number_acute_lagos or None
    if channel == "leadway_pbm_whatsapp_2":
        return settings.whatsapp_number_chronic or None
    return None


def _clean(s: str | None) -> str:
    return (s or "").strip() or "Not specified"


def _item_line(i: int, it: dict, default_class: str) -> str:
    name = it.get("drug_name") or it.get("generic") or "-"
    dose = it.get("dosage") or ""
    days = it.get("duration_days")
    dur = f"{days} days" if days else "ongoing"
    cls = (it.get("classification_hint") or default_class or "").upper() or "-"
    # "2 tablets bd" — our dosage already includes strength + dose + freq
    return f"{i}. {name} - {dose} x {dur} [{cls}]"


def _diag_line(diagnoses: list[dict] | None) -> str:
    if not diagnoses:
        return "Not specified"
    parts = []
    for d in diagnoses:
        code = d.get("code") if isinstance(d, dict) else None
        name = d.get("name") if isinstance(d, dict) else None
        if code and name:
            parts.append(f"{code} - {name}")
        elif name:
            parts.append(str(name))
        elif code:
            parts.append(str(code))
    return ", ".join(parts) or "Not specified"


def format_medication_request(req: dict) -> str:
    """Build the plain-text template matching the PBM team's preferred format."""
    ref = req.get("ref_code") or req.get("id") or "-"
    first = (req.get("enrollee_first_name") or "").strip()
    last = (req.get("enrollee_last_name") or "").strip()
    # Prognosis uses "Surname Othernames" form in Member_CustomerName; mimic.
    name = req.get("enrollee_name") or f"{last} {first}".strip() or "Unknown"
    lines = [
        "NEW MEDICATION REQUEST",
        "==============================",
        f"Ref: {ref}",
        f"Enrollee: {name} ({_clean(req.get('enrollee_id'))})",
        f"Phone: {_clean(req.get('enrollee_phone') or req.get('alt_phone'))}",
        f"Facility: {_clean(req.get('provider_facility'))}",
        f"Doctor: {_clean(req.get('treating_doctor'))}",
        f"Diagnosis: {_diag_line(req.get('diagnoses'))}",
        f"Urgency: {(req.get('urgency') or 'routine').upper()}",
        f"Location: {_clean(req.get('enrollee_state'))}",
        f"Address: {_clean((req.get('delivery') or {}).get('formatted'))}",
        "",
        "Medications:",
    ]
    default_class = req.get("classification") or ""
    items = req.get("items") or []
    for i, it in enumerate(items, start=1):
        lines.append(_item_line(i, it, default_class))

    if req.get("notes"):
        lines += ["", f"Notes: {req['notes']}"]

    return "\n".join(lines)


async def send_message(to: str, message: str) -> dict:
    if not _configured():
        raise WhatsAppError("WHATSAPP_BOT_URL is not configured")
    if not to:
        raise WhatsAppError("WhatsApp recipient is required")

    url = settings.whatsapp_bot_url.rstrip("/") + _send_path()
    payload = _build_payload(to, message)
    logger.info("WhatsApp POST %s · to=%s · chars=%d", url, to, len(message))
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                url, json=payload,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
    except httpx.HTTPError as e:
        raise WhatsAppError(f"Bot unreachable: {e}") from e

    try:
        data: Any = resp.json()
    except Exception:
        data = {"raw": resp.text}
    logger.info("WhatsApp ← HTTP %s · body=%s", resp.status_code, str(data)[:500])
    if resp.status_code >= 400:
        raise WhatsAppError(f"Bot error {resp.status_code}: {str(data)[:200]}")
    return data if isinstance(data, dict) else {"raw": data}


async def dispatch_medication_request(request: dict, *, channel: str | None = None) -> dict:
    """Top-level: pick the right WhatsApp number from the channel and send
    the formatted medication-request message. Raises WhatsAppError on any
    failure so the caller can log without blocking the submission.
    """
    chan = channel or request.get("channel")
    to = resolve_number(chan)
    if not to:
        raise WhatsAppError(
            f"No WhatsApp number configured for channel '{chan}'. "
            "Set WHATSAPP_NUMBER_ACUTE_LAGOS and WHATSAPP_NUMBER_CHRONIC."
        )
    message = format_medication_request(request)
    return await send_message(to, message)
