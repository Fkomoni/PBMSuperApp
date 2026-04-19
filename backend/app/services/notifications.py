"""Member-facing email templates for prescription submission.

Two flavours, selected by routing channel:
    wellahealth              → "routed to WellaHealth + partner pharmacy" copy
    leadway_pbm_whatsapp_*   → "received, we're working on it" copy

All text is ASCII (no em-dashes, bullet dots, etc.) — Prognosis's
SendEmailAlert mail relay rejects bodies that contain non-ASCII.

Each builder returns (subject, plain_text_body). The sender lives in
services/prognosis.send_email().
"""
from __future__ import annotations

SUPPORT_LINE = "07080627051 / 02012801051 (24/7)"


def _first_name(full: str | None) -> str:
    if not full:
        return "there"
    parts = full.strip().split()
    return parts[0] if parts else "there"


def _drug_list(items: list[dict] | None) -> str:
    if not items:
        return "(no items)"
    lines = []
    for it in items[:10]:
        dose = it.get("dosage") or ""
        qty = it.get("quantity")
        qty_txt = f" - qty {qty}" if qty else ""
        name = it.get("drug_name") or it.get("generic") or "-"
        lines.append(f"  - {name} {dose}{qty_txt}".rstrip())
    if len(items) > 10:
        lines.append(f"  - ... plus {len(items) - 10} more")
    return "\n".join(lines)


def _clean(s: str) -> str:
    """ASCII-only — Prognosis's mail relay returns 'fail: Email sending
    failed' when fed any character outside 0x00..0x7F (em-dashes, fancy
    quotes, bullet dots, etc.)."""
    replacements = {
        "\u2013": "-", "\u2014": "-",    # en dash, em dash
        "\u2018": "'", "\u2019": "'",    # curly single quotes
        "\u201c": '"', "\u201d": '"',    # curly double quotes
        "\u2022": "-",                    # bullet
        "\u00b7": "-",                    # middle dot
        "\u00a0": " ",                    # nbsp
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s.encode("ascii", errors="ignore").decode("ascii")


def wellahealth_body(request: dict) -> tuple[str, str]:
    name = _first_name(request.get("enrollee_name"))
    ref = request.get("id") or "-"
    subject = "Your Leadway RxHub prescription - en route via WellaHealth"
    body = f"""Hi {name},

We have received your prescription and routed it to our fulfilment partner WellaHealth (our third-party pharmacy network).

WellaHealth will forward it to a pharmacy near you. Once the pharmacy confirms availability, you will receive a pickup message and a one-time code (OTP) to collect your medications.

Your prescription reference: {ref}

Medications requested:
{_drug_list(request.get("items"))}

Need help? Call the Leadway Health contact centre on {SUPPORT_LINE}.

- Leadway RxHub
"""
    return _clean(subject), _clean(body)


def leadway_body(request: dict) -> tuple[str, str]:
    name = _first_name(request.get("enrollee_name"))
    ref = request.get("id") or "-"
    subject = "Your Leadway RxHub prescription - received"
    body = f"""Hi {name},

We have received your prescription and our Leadway PBM team is now working on it.

Your prescription reference: {ref}

Medications requested:
{_drug_list(request.get("items"))}

You will hear from us on WhatsApp as soon as your order is ready for dispatch or pickup.

Need help? Call the Leadway Health contact centre on {SUPPORT_LINE}.

- Leadway RxHub
"""
    return _clean(subject), _clean(body)


def build_for(channel: str | None, request: dict) -> tuple[str, str]:
    """Pick the right template for the routing channel. Falls back to the
    Leadway copy when the channel is unknown (safer default for the member).
    """
    if channel == "wellahealth":
        return wellahealth_body(request)
    return leadway_body(request)
