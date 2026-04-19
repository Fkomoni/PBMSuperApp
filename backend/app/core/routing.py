"""Routing rules — mirrors the preview in the frontend (provider-new-request.jsx).

Acute · Lagos · Mon–Fri (any time)  -> Leadway PBM Super App · WhatsApp #1
Acute · Lagos · Sat/Sun             -> WellaHealth partner pharmacy
Acute · outside Lagos               -> WellaHealth / onboarded partner pharmacy
Chronic · Lagos                     -> Leadway PBM Super App · WhatsApp #2
Chronic · outside Lagos             -> Leadway PBM Super App · WhatsApp #2
Mixed (acute + chronic)             -> Leadway PBM Super App · WhatsApp #1
Hormonal/cancer/autoimmune/fertility Lagos   -> Leadway PBM Super App · WhatsApp #1
Hormonal/cancer/autoimmune/fertility Outside -> Leadway PBM Super App · WhatsApp #2
"""
from datetime import datetime, timezone, timedelta
from typing import Iterable


SPECIAL_COHORTS = {"hormonal", "cancer", "autoimmune", "fertility"}

# Nigeria is UTC+1 year-round (no DST). Anchor the weekday/weekend decision
# to local Lagos time even if the server clock is in UTC — otherwise
# requests submitted on Friday night (Lagos) would route as "Saturday"
# (weekend) when the server is UTC, letting a caller nudge routing across
# channels by submitting at boundary times.
_LAGOS = timezone(timedelta(hours=1))


def classify_bucket(classifications: Iterable[str], state: str | None, now: datetime | None = None) -> dict:
    now = now or datetime.now(_LAGOS)
    # If caller passed a naive datetime, interpret it as Lagos local time;
    # if tz-aware, convert explicitly.
    if now.tzinfo is None:
        now = now.replace(tzinfo=_LAGOS)
    else:
        now = now.astimezone(_LAGOS)
    classes = {c.lower() for c in classifications if c}
    is_lagos = (state or "").strip().lower() == "lagos"
    weekday = now.weekday()  # 0 Mon .. 6 Sun
    is_weekday = weekday <= 4

    has_special = bool(classes & SPECIAL_COHORTS)
    has_chronic = "chronic" in classes
    has_acute = "acute" in classes

    if has_special:
        return {
            "kind": "special-lagos" if is_lagos else "special-outside",
            "channel": "leadway_pbm_whatsapp_1" if is_lagos else "leadway_pbm_whatsapp_2",
            "label": "Leadway PBM Super App · WhatsApp #1" if is_lagos else "Leadway PBM Super App · WhatsApp #2",
        }
    if has_chronic and has_acute:
        return {
            "kind": "mixed",
            "channel": "leadway_pbm_whatsapp_1",
            "label": "Leadway PBM Super App · WhatsApp #1 (mixed)",
        }
    if has_chronic:
        return {
            "kind": "chronic-lagos" if is_lagos else "chronic-outside",
            "channel": "leadway_pbm_whatsapp_2",
            "label": "Leadway PBM Super App · WhatsApp #2 (chronic)",
        }
    if has_acute:
        if is_lagos and is_weekday:
            return {
                "kind": "acute-lagos-weekday",
                "channel": "leadway_pbm_whatsapp_1",
                "label": "Leadway PBM Super App · WhatsApp #1 (acute, Lagos, weekday)",
            }
        if is_lagos:
            return {
                "kind": "acute-lagos-weekend",
                "channel": "wellahealth",
                "label": "WellaHealth partner pharmacy (Lagos, weekend/after-hours)",
            }
        return {
            "kind": "acute-outside",
            "channel": "wellahealth",
            "label": "WellaHealth / onboarded partner pharmacy (outside Lagos)",
        }
    return {"kind": "none", "channel": None, "label": "—"}
