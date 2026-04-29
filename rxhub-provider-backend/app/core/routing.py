"""Routing rules — mirrors the preview in the frontend (provider-new-request.jsx).

Acute (pure)
  · Ibeju-Lekki / Epe LGA (any time)         -> WellaHealth (pilot LGA partner pharmacy)
  · Mon-Fri 08:00-17:00 Africa/Lagos         -> Leadway PBM Super App · WhatsApp (Acute hours)
  · Outside business hours / weekends        -> WellaHealth (partner pharmacy)

Chronic / Mixed (acute + chronic) / Special cohorts (hormonal, cancer,
autoimmune, fertility, supplements)
  · Lagos                                     -> Leadway PBM Super App · WhatsApp (Lagos non-acute)
  · Outside Lagos                             -> Leadway PBM Super App · WhatsApp (Outside non-acute)
"""
import re
from datetime import datetime
from typing import Iterable

try:
    from zoneinfo import ZoneInfo
    _LAGOS_TZ = ZoneInfo("Africa/Lagos")
except Exception:  # pragma: no cover — zoneinfo missing on weird runtimes
    _LAGOS_TZ = None


SPECIAL_COHORTS = {"hormonal", "cancer", "autoimmune", "fertility", "supplements", "supplement"}

# Lagos LGAs where Leadway's in-house pharmacy can't practically fulfil —
# pure-acute orders in these LGAs always route to a WellaHealth partner
# pharmacy regardless of time of day.  Key = normalized slug, value =
# the pretty name surfaced in the route label for traceability.
_ACUTE_PILOT_LGAS = {
    "ibeju-lekki":   "Ibeju-Lekki",
    "epe":           "Epe",
    "eti-osa":       "Eti-Osa",
    "ojo":           "Ojo",
    "badagry":       "Badagry",
}

# Neighbourhood / area tokens that fall within the pilot zones but may
# come through Google Places with a different (or missing) LGA — treat
# a boundary-match on the formatted address as authoritative.
_ACUTE_PILOT_AREAS = {
    "ajah":           "Ajah",
    "badore":         "Badore",
    "sangotedo":      "Sangotedo",
    "alaba":          "Alaba",
    "iba":            "Iba",
    "ajangbadi":      "Ajangbadi",
    "shibiri":        "Shibiri",
    "satellite-town": "Satellite Town",
}

# Leadway PBM WhatsApp operating window (Africa/Lagos, no DST).
_BUSINESS_START_HOUR = 8    # 08:00
_BUSINESS_END_HOUR = 17     # strictly before 17:00 so 5pm sharp is out


def _norm_lga(s: str | None) -> str:
    """Normalize "Ibeju-Lekki" / "Ibeju Lekki" / "IBEJU/LEKKI LGA" → "ibeju-lekki"."""
    if not s:
        return ""
    cleaned = re.sub(r"\blga\b", "", s.strip().lower())
    return re.sub(r"[\s\-_/]+", "-", cleaned).strip("-")


def _addr_slug(s: str | None) -> str:
    """Collapse a formatted address into a hyphen-separated lowercase slug.

    "1, Ajah Road, Eti-Osa, Lagos" → "1-ajah-road-eti-osa-lagos"
    Lets us use boundary-anchored token matching without tripping on
    punctuation or inconsistent spacing.
    """
    if not s:
        return ""
    t = re.sub(r"[,/_]+", " ", s.lower())
    return re.sub(r"[\s\-]+", "-", t).strip("-")


def _match_acute_pilot(lga: str | None, formatted: str | None) -> str | None:
    """Return the pretty pilot name if this delivery falls into a Lagos
    far-reach acute-pilot zone, else None.

    Priority: exact LGA match first (authoritative when Google Places
    parsed admin_area_level_2 correctly), then a boundary-match on the
    formatted-address slug against both LGA names and neighbourhood
    tokens so a missing/mis-parsed LGA never blocks routing.
    """
    lga_key = _norm_lga(lga)
    if lga_key in _ACUTE_PILOT_LGAS:
        return _ACUTE_PILOT_LGAS[lga_key]

    slug = _addr_slug(formatted)
    if slug:
        for key, name in _ACUTE_PILOT_LGAS.items():
            if re.search(rf"(^|-){re.escape(key)}(-|$)", slug):
                return name
        for key, name in _ACUTE_PILOT_AREAS.items():
            if re.search(rf"(^|-){re.escape(key)}(-|$)", slug):
                return name
    return None


def _in_business_hours(now: datetime) -> bool:
    """True if `now` falls within Mon-Fri 08:00-16:59 Africa/Lagos."""
    if _LAGOS_TZ is not None:
        local = now.astimezone(_LAGOS_TZ) if now.tzinfo else now.replace(tzinfo=_LAGOS_TZ)
    else:  # fallback: assume UTC+1
        from datetime import timedelta, timezone as _tz
        local = (now.astimezone(_tz.utc) if now.tzinfo else now) + timedelta(hours=1)
    # Monday=0 .. Sunday=6
    if local.weekday() >= 5:
        return False
    return _BUSINESS_START_HOUR <= local.hour < _BUSINESS_END_HOUR


def classify_bucket(
    classifications: Iterable[str],
    state: str | None,
    now: datetime | None = None,
    lga: str | None = None,
    formatted: str | None = None,
) -> dict:
    now = now or datetime.now()
    classes = {c.lower() for c in classifications if c}
    is_lagos = (state or "").strip().lower() == "lagos"
    pilot_name = _match_acute_pilot(lga, formatted)

    has_special = bool(classes & SPECIAL_COHORTS)
    has_chronic = "chronic" in classes
    has_acute = "acute" in classes

    # ─── Non-acute family (special cohorts / mixed / chronic) ───────────
    if has_special or (has_chronic and has_acute):
        if is_lagos:
            kind = "special-lagos" if has_special else "mixed-lagos"
            label = "Leadway PBM Super App · WhatsApp (Lagos non-acute)"
            return {"kind": kind, "channel": "leadway_pbm_whatsapp_1", "label": label}
        kind = "special-outside" if has_special else "mixed-outside"
        label = "Leadway PBM Super App · WhatsApp (Outside Lagos non-acute)"
        return {"kind": kind, "channel": "leadway_pbm_whatsapp_2", "label": label}
    if has_chronic:
        if is_lagos:
            return {
                "kind": "chronic-lagos",
                "channel": "leadway_pbm_whatsapp_1",
                "label": "Leadway PBM Super App · WhatsApp (Lagos non-acute)",
            }
        return {
            "kind": "chronic-outside",
            "channel": "leadway_pbm_whatsapp_2",
            "label": "Leadway PBM Super App · WhatsApp (Outside Lagos non-acute)",
        }

    # ─── Pure acute ──────────────────────────────────────────────────────
    if has_acute:
        # 1) Far-reach Lagos pilot zones → Wella regardless of time.
        if pilot_name:
            return {
                "kind": "acute-lagos-pilot",
                "channel": "wellahealth",
                "label": f"WellaHealth partner pharmacy ({pilot_name} pilot)",
            }
        # 2) Business-hours (Mon-Fri 08:00-17:00 Lagos) → Leadway acute WhatsApp.
        if _in_business_hours(now):
            return {
                "kind": "acute-business-hours",
                "channel": "leadway_pbm_whatsapp_acute_hours",
                "label": "Leadway PBM Super App · WhatsApp (Acute hours)",
            }
        # 3) After hours / weekends → WellaHealth partner pharmacy.
        return {
            "kind": "acute-lagos-after-hours" if is_lagos else "acute-outside-after-hours",
            "channel": "wellahealth",
            "label": "WellaHealth partner pharmacy (after-hours acute)",
        }
    return {"kind": "none", "channel": None, "label": "—"}

