"""Member-facing email templates for prescription submission.

Two flavours, selected by routing channel:
    wellahealth              → "routed to WellaHealth + partner pharmacy" copy
                               (acute: pharmacy pickup with OTP)
    leadway_pbm_whatsapp_*   → "received, we're reviewing" copy
                               (chronic / mixed / special cohorts)

Both render as HTML (with an ASCII-only plain-text fallback surfaced in
the Subject) so Prognosis's mail relay doesn't gag on non-ASCII codepoints.

Each builder returns (subject, html_body). The sender lives in
services/prognosis.send_email().
"""
from __future__ import annotations

SUPPORT_LINE = "07080627051 / 02012801051"
BRAND_RED = "#C8102E"
BRAND_RED_DARK = "#9c0c23"
BRAND_GREEN = "#1b5e20"
BRAND_INK = "#1a1a22"
INK_MUTED = "#6b7280"
LINE = "#e5e7eb"


def _first_name(full: str | None) -> str:
    if not full:
        return "there"
    parts = full.strip().split()
    return parts[0] if parts else "there"


def _clean(s: str) -> str:
    """ASCII-only — Prognosis's mail relay rejects non-ASCII bodies."""
    replacements = {
        "\u2013": "-", "\u2014": "-",
        "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"',
        "\u2022": "-",
        "\u00b7": "-",
        "\u00a0": " ",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s.encode("ascii", errors="ignore").decode("ascii")


def _rows(items: list[dict] | None) -> str:
    if not items:
        return (
            '<tr><td colspan="6" style="padding:12px;text-align:center;color:#6b7280;'
            'font-size:13px;">(no items listed)</td></tr>'
        )
    out = []
    for i, it in enumerate(items, start=1):
        name = it.get("drug_name") or it.get("generic") or "-"
        strength = it.get("strength") or ""
        # If no dedicated strength captured, try to pull from the dosage text
        dose = it.get("dose") or ""
        freq = it.get("frequency") or it.get("freq") or ""
        dur_days = it.get("duration_days")
        dur = f"{dur_days} days" if dur_days else "ongoing"
        dosage_text = it.get("dosage") or ""
        # If the submitter didn't capture strength/dose/freq separately,
        # the full dosage string goes into the Strength column as a single
        # blob so nothing is lost.
        if not (strength or dose or freq) and dosage_text:
            strength = dosage_text
        out.append(
            f'<tr>'
            f'<td style="padding:10px;border-bottom:1px solid {LINE};">{i}</td>'
            f'<td style="padding:10px;border-bottom:1px solid {LINE};">{_e(name)}</td>'
            f'<td style="padding:10px;border-bottom:1px solid {LINE};">{_e(strength)}</td>'
            f'<td style="padding:10px;border-bottom:1px solid {LINE};">{_e(dose)}</td>'
            f'<td style="padding:10px;border-bottom:1px solid {LINE};">{_e(freq)}</td>'
            f'<td style="padding:10px;border-bottom:1px solid {LINE};">{_e(dur)}</td>'
            f'</tr>'
        )
    return "\n".join(out)


def _e(s) -> str:
    """HTML-escape + ASCII."""
    import html
    return html.escape(_clean(str(s or "")))


def _diag_text(diagnoses: list[dict] | None) -> str:
    if not diagnoses:
        return "Not specified"
    parts = []
    for d in diagnoses:
        code = d.get("code") if isinstance(d, dict) else None
        name = d.get("name") if isinstance(d, dict) else str(d)
        if code and name:
            parts.append(f"{code} - {name}")
        elif name:
            parts.append(str(name))
        elif code:
            parts.append(str(code))
    return ", ".join(parts) or "Not specified"


def _shell(title_subtitle: tuple[str, str], inner_html: str) -> str:
    """Wrap the body in the Leadway red header + green footer shell."""
    title, subtitle = title_subtitle
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f7;font-family:Arial,Helvetica,sans-serif;color:{BRAND_INK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:6px;overflow:hidden;max-width:600px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr>
          <td style="background:{BRAND_RED};padding:22px 28px;text-align:center;">
            <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:.3px;">LEADWAY Health</div>
            <div style="color:rgba(255,255,255,.88);font-size:12.5px;margin-top:4px;">{_e(subtitle)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 28px;">
            {inner_html}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;border-top:1px solid {LINE};font-size:11.5px;color:{INK_MUTED};line-height:1.55;">
            This is an automated notification from Leadway Health Services. If you have questions, contact your healthcare provider or call Leadway Health support on {SUPPORT_LINE}.
          </td>
        </tr>
        <tr>
          <td style="background:{BRAND_GREEN};padding:14px;text-align:center;color:#fff;font-size:12px;letter-spacing:.3px;">
            Leadway Health Services - For health, wealth &amp; more...
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _info_block(rows: list[tuple[str, str]]) -> str:
    cells = []
    for k, v in rows:
        cells.append(
            f'<tr>'
            f'<td style="padding:7px 0;color:{INK_MUTED};font-size:13px;width:130px;vertical-align:top;">{_e(k)}:</td>'
            f'<td style="padding:7px 0;color:{BRAND_INK};font-size:13px;font-weight:600;">{_e(v)}</td>'
            f'</tr>'
        )
    return (
        f'<table cellpadding="0" cellspacing="0" width="100%" '
        f'style="background:#f8f9fa;border-left:3px solid {BRAND_RED};border-radius:4px;padding:14px 18px;margin:0 0 20px;">'
        + "".join(cells) +
        "</table>"
    )


def _med_table(items: list[dict] | None) -> str:
    return f"""
<div style="font-size:15px;font-weight:700;color:{BRAND_RED};margin:0 0 10px;">Medications Prescribed</div>
<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:24px;">
  <thead>
    <tr style="background:{BRAND_INK};color:#fff;">
      <th align="left" style="padding:10px;font-weight:700;width:34px;">#</th>
      <th align="left" style="padding:10px;font-weight:700;">Medication</th>
      <th align="left" style="padding:10px;font-weight:700;">Strength</th>
      <th align="left" style="padding:10px;font-weight:700;">Dose</th>
      <th align="left" style="padding:10px;font-weight:700;">Frequency</th>
      <th align="left" style="padding:10px;font-weight:700;">Duration</th>
    </tr>
  </thead>
  <tbody>
    {_rows(items)}
  </tbody>
</table>
"""


# ============================================================
# WellaHealth-routed (acute) template
# ============================================================
def wellahealth_body(request: dict) -> tuple[str, str]:
    name = _first_name(request.get("enrollee_name"))
    full = request.get("enrollee_name") or name
    ref = request.get("ref_code") or request.get("id") or "-"
    facility = request.get("provider_facility") or "Your provider"
    phone = request.get("enrollee_phone") or "Not provided"
    delivery = (request.get("delivery") or {}).get("formatted") or "Not provided"
    pharmacy_code = request.get("wella_pharmacy_code") or "To be assigned"
    pharmacy_name = request.get("wella_pharmacy_name") or ""
    tracking_code = request.get("wella_tracking_code") or ""

    subject = f"Leadway Health - Medication fulfilment notification ({ref})"

    inner = f"""
<p style="margin:0 0 14px;font-size:14px;line-height:1.55;">Dear {_e(full)},</p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.6;">
  <strong>{_e(facility)}</strong> has submitted a medication request on your behalf through the Leadway Health portal.
  All prescribed medications are <strong>acute</strong> and have been logged for fulfilment by our partner pharmacy.
</p>
{_info_block([
    ("Reference", ref),
    ("Diagnosis", _diag_text(request.get("diagnoses"))),
    ("Phone", phone),
    ("Delivery Address", delivery),
])}
{_med_table(request.get("items"))}

<div style="font-size:15px;font-weight:700;color:{BRAND_RED};margin:0 0 10px;">Pharmacy Assigned</div>
<div style="background:#f8f9fa;border-radius:4px;padding:14px 18px;margin-bottom:22px;">
  <div style="font-size:13.5px;color:{BRAND_INK};margin-bottom:6px;">{_e(pharmacy_name or pharmacy_code)}</div>
  {f'<div style="font-size:13px;color:{BRAND_GREEN};font-weight:700;">Tracking Code: {_e(tracking_code)}</div>' if tracking_code else ''}
</div>

<div style="font-size:15px;font-weight:700;color:{BRAND_RED};margin:0 0 10px;">What Happens Next?</div>
<ol style="padding-left:20px;margin:0 0 24px;font-size:13.5px;line-height:1.65;color:{BRAND_INK};">
  <li>The pharmacy will confirm availability of your medications.</li>
  <li>Once confirmed, you will receive a <strong>Pickup Code</strong> via SMS.</li>
  <li>Present the Pickup Code at the pharmacy to collect your medications.</li>
</ol>
"""
    return _clean(subject), _clean(inner)


# ============================================================
# Leadway PBM-routed (chronic / mixed / special) template
# ============================================================
def leadway_body(request: dict) -> tuple[str, str]:
    name = _first_name(request.get("enrollee_name"))
    full = request.get("enrollee_name") or name
    ref = request.get("ref_code") or request.get("id") or "-"
    facility = request.get("provider_facility") or "Your provider"
    phone = request.get("enrollee_phone") or "Not provided"
    delivery = (request.get("delivery") or {}).get("formatted") or "Not provided"

    subject = f"Leadway Health - Medication request received ({ref})"

    inner = f"""
<p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Dear <strong>{_e(full)}</strong>,</p>
<p style="margin:0 0 14px;font-size:14px;line-height:1.55;">We hope this message finds you well.</p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.6;">
  <strong>{_e(facility)}</strong> has submitted a medication request on your behalf through the Leadway Health portal.
</p>
{_info_block([
    ("Reference", ref),
    ("Diagnosis", _diag_text(request.get("diagnoses"))),
    ("Member Phone", phone),
    ("Delivery Address", delivery),
])}
{_med_table(request.get("items"))}

<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
  We have received your prescription and our pharmacy team is currently reviewing your order.
  We will be in touch with you shortly to confirm availability and arrange delivery or pickup.
</p>
<p style="margin:0 0 22px;font-size:14px;line-height:1.6;">
  If you have any questions in the meantime, please don't hesitate to contact us.
</p>
<p style="margin:0 0 4px;font-size:14px;">Warm regards,</p>
<p style="margin:0 0 2px;font-size:14px;font-weight:700;color:{BRAND_INK};">Leadway Health Pharmacy Team</p>
<p style="margin:0 0 4px;font-size:13px;color:{INK_MUTED};font-style:italic;">For health, wealth &amp; more...</p>
"""
    return _clean(subject), _shell(("LEADWAY Health", "Medication Request Notification"), inner)


# Re-use the shell-wrapping for the Wella variant — the shell needs the
# inner HTML, so this is computed properly here.
def _wrap_wellahealth(request: dict) -> tuple[str, str]:
    subject, inner = wellahealth_body(request)
    return subject, _shell(("LEADWAY Health", "Medication Fulfilment Notification"), inner)


def build_for(channel: str | None, request: dict) -> tuple[str, str]:
    """Pick the right template for the routing channel. Falls back to the
    Leadway copy when the channel is unknown (safer default for the member).
    """
    if channel == "wellahealth":
        return _wrap_wellahealth(request)
    return leadway_body(request)
