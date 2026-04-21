"""Routing rules — mirrors the preview in the frontend (provider-new-request.jsx).

Acute · any location · any day              -> WellaHealth (partner pharmacy)
Acute · Lagos · Ibeju-Lekki/Epe              -> WellaHealth (explicit pilot route)
Chronic · Lagos                              -> Leadway PBM Super App · WhatsApp #2
Chronic · outside Lagos                      -> Leadway PBM Super App · WhatsApp #2
Mixed (acute + chronic)                      -> Leadway PBM Super App · WhatsApp #1
Hormonal/cancer/autoimmune/fertility Lagos   -> Leadway PBM Super App · WhatsApp #1
Hormonal/cancer/autoimmune/fertility Out     -> Leadway PBM Super App · WhatsApp #2
"""
import re
from datetime import datetime
from typing import Iterable


SPECIAL_COHORTS = {"hormonal", "cancer", "autoimmune", "fertility"}

# LGAs at the far reaches of Lagos state where Leadway's in-house pharmacy
# can't practically fulfil — these always route pure-acute orders to a
# WellaHealth partner pharmacy regardless of any other rule adjustments.
_ACUTE_PILOT_LGAS = {"ibeju-lekki", "epe"}


def _norm_lga(s: str | None) -> str:
    """Normalize "Ibeju-Lekki" / "Ibeju Lekki" / "IBEJU/LEKKI LGA" → "ibeju-lekki"."""
    if not s:
        return ""
    cleaned = re.sub(r"\blga\b", "", s.strip().lower())
    return re.sub(r"[\s\-_/]+", "-", cleaned).strip("-")


def classify_bucket(
    classifications: Iterable[str],
    state: str | None,
    now: datetime | None = None,
    lga: str | None = None,
) -> dict:
    now = now or datetime.now()
    classes = {c.lower() for c in classifications if c}
    is_lagos = (state or "").strip().lower() == "lagos"
    lga_key = _norm_lga(lga)
    is_pilot_lga = lga_key in _ACUTE_PILOT_LGAS

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
        # Explicit pilot route: Lagos · Ibeju-Lekki or Epe always goes to
        # WellaHealth. Matched on LGA alone so a mis-detected state never
        # diverts these far-reach deliveries elsewhere.
        if is_pilot_lga:
            pilot_name = "Ibeju-Lekki" if lga_key == "ibeju-lekki" else "Epe"
            return {
                "kind": "acute-lagos-pilot",
                "channel": "wellahealth",
                "label": f"WellaHealth partner pharmacy ({pilot_name} pilot)",
            }
        return {
            "kind": "acute-lagos" if is_lagos else "acute-outside",
            "channel": "wellahealth",
            "label": "WellaHealth partner pharmacy",
        }
    return {"kind": "none", "channel": None, "label": "—"}

