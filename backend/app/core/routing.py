"""Routing rules — mirrors the preview in the frontend (provider-new-request.jsx).

Acute · any location · any day            -> WellaHealth (partner pharmacy)
Chronic · Lagos                            -> Leadway PBM Super App · WhatsApp #2
Chronic · outside Lagos                    -> Leadway PBM Super App · WhatsApp #2
Mixed (acute + chronic)                    -> Leadway PBM Super App · WhatsApp #1
Hormonal/cancer/autoimmune/fertility Lagos -> Leadway PBM Super App · WhatsApp #1
Hormonal/cancer/autoimmune/fertility Out   -> Leadway PBM Super App · WhatsApp #2
"""
from datetime import datetime
from typing import Iterable


SPECIAL_COHORTS = {"hormonal", "cancer", "autoimmune", "fertility"}


def classify_bucket(classifications: Iterable[str], state: str | None, now: datetime | None = None) -> dict:
    now = now or datetime.now()
    classes = {c.lower() for c in classifications if c}
    is_lagos = (state or "").strip().lower() == "lagos"

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
        # All pure-acute orders go to WellaHealth, any state, any day.
        return {
            "kind": "acute-lagos" if is_lagos else "acute-outside",
            "channel": "wellahealth",
            "label": "WellaHealth partner pharmacy",
        }
    return {"kind": "none", "channel": None, "label": "—"}

