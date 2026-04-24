"""Generate the parent-app integration handover as a branded PDF."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Brand palette ─────────────────────────────────────────────────────
RED = colors.HexColor("#E31B23")
INK = colors.HexColor("#0E1218")
INK2 = colors.HexColor("#3A4149")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")
PANEL = colors.HexColor("#F7F7F8")
GREEN_BG = colors.HexColor("#E6F4EA")
AMBER_BG = colors.HexColor("#FFF6E6")

LOGO = Path("/home/user/PBMSuperApp/frontend/assets/leadway-logo.jpg")
OUT = Path("/home/user/PBMSuperApp/releases/RxHub-Parent-App-Handover.pdf")


def _styles():
    ss = getSampleStyleSheet()
    s = {}
    s["h1"] = ParagraphStyle(
        "H1", parent=ss["Heading1"], fontName="Helvetica-Bold",
        fontSize=22, leading=28, textColor=INK, spaceBefore=0, spaceAfter=6,
    )
    s["h2"] = ParagraphStyle(
        "H2", parent=ss["Heading2"], fontName="Helvetica-Bold",
        fontSize=15, leading=20, textColor=RED, spaceBefore=18, spaceAfter=6,
        keepWithNext=True,
    )
    s["h3"] = ParagraphStyle(
        "H3", parent=ss["Heading3"], fontName="Helvetica-Bold",
        fontSize=12, leading=16, textColor=INK, spaceBefore=10, spaceAfter=3,
        keepWithNext=True,
    )
    s["body"] = ParagraphStyle(
        "Body", parent=ss["BodyText"], fontName="Helvetica",
        fontSize=10, leading=14.5, textColor=INK2, spaceAfter=6, alignment=TA_LEFT,
    )
    s["lead"] = ParagraphStyle(
        "Lead", parent=s["body"], fontSize=10.5, leading=15, spaceAfter=10,
    )
    s["callout"] = ParagraphStyle(
        "Callout", parent=s["body"], fontSize=10, leading=14.5,
        backColor=AMBER_BG, borderColor=colors.HexColor("#F0B046"),
        borderWidth=0.6, borderPadding=8, borderRadius=4, spaceAfter=8,
    )
    s["mono"] = ParagraphStyle(
        "Mono", parent=s["body"], fontName="Courier",
        fontSize=8.5, leading=12, textColor=INK,
    )
    s["small"] = ParagraphStyle(
        "Small", parent=s["body"], fontSize=8.5, leading=12, textColor=MUTED,
    )
    s["footer"] = ParagraphStyle(
        "Footer", parent=s["body"], fontSize=8, leading=10,
        textColor=MUTED, alignment=TA_LEFT,
    )
    s["pre"] = ParagraphStyle(
        "Pre", parent=s["body"], fontName="Courier", fontSize=8.5, leading=11.5,
        textColor=INK, backColor=PANEL, borderColor=LINE, borderWidth=0.4,
        borderPadding=8, spaceAfter=10,
    )
    return s


def _header_footer(canv, doc):
    canv.saveState()
    # Top red rule
    canv.setFillColor(RED)
    canv.rect(0, A4[1] - 8 * mm, A4[0], 8 * mm, fill=1, stroke=0)
    # Footer
    canv.setFont("Helvetica", 8)
    canv.setFillColor(MUTED)
    canv.drawString(
        20 * mm, 12 * mm,
        "Leadway Health · RxHub Provider Portal · Parent-App Integration Guide",
    )
    canv.drawRightString(A4[0] - 20 * mm, 12 * mm, f"Page {doc.page}")
    canv.restoreState()


def _pre(text):
    return Preformatted(text, _styles()["pre"])


def _table(rows, col_widths, header_row=True):
    t = Table(rows, colWidths=col_widths, hAlign="LEFT")
    st = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK2),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, LINE),
        ("LINEABOVE", (0, 0), (-1, 0), 0.25, LINE),
    ]
    if header_row:
        st += [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 0), (-1, 0), INK),
            ("BACKGROUND", (0, 0), (-1, 0), PANEL),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, INK),
        ]
    t.setStyle(TableStyle(st))
    return t


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT), pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
        title="RxHub Parent-App Integration Guide",
        author="Leadway Health · RxHub",
    )
    s = _styles()
    story = []

    # ── Cover / title block ─────────────────────────────────────────
    if LOGO.exists():
        logo = Image(str(LOGO), width=36 * mm, height=18 * mm, kind="proportional")
        logo.hAlign = "LEFT"
        story.append(logo)
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<font color='#E31B23'>RxHub</font> · Parent-App Integration Guide", s["h1"]
    ))
    story.append(Paragraph(
        "Final handover for the team building the Leadway Provider dashboard's "
        "RxHub tile. Covers the single API call your backend makes, how the "
        "iframe is embedded, and the security properties you get by default.",
        s["lead"],
    ))

    # ── What you're integrating ─────────────────────────────────────
    story.append(Paragraph("What you're integrating", s["h2"]))
    story.append(Paragraph(
        "RxHub is a prescription submission and fulfilment-tracking portal. "
        "Leadway providers open it inside an iframe on your provider dashboard. "
        "They should arrive already signed in — no second login screen.",
        s["body"],
    ))

    # ── Architecture summary ────────────────────────────────────────
    story.append(Paragraph("Architecture summary", s["h2"]))
    story.append(_pre(
        "Your dashboard              RxHub backend                RxHub frontend (iframe)\n"
        "──────────────              ─────────────                ───────────────────────\n"
        "Provider clicks \"Open RxHub\"\n"
        "        │\n"
        "        │  POST /api/v1/auth/embed-login          (server-side, NOT browser)\n"
        "        │    Header:  X-Embed-Secret: <shared>\n"
        "        │    Body:    { email, password }\n"
        "        │─────────────────────────►  validates secret + credentials\n"
        "        │                            mints JWT\n"
        "        │                            stashes behind a one-time ticket (60s TTL)\n"
        "        │  { portal_url, ticket_expires_in }\n"
        "        │◄─────────────────────────┤\n"
        "        │\n"
        "        │  <iframe src=\"{portal_url}\">\n"
        "        │                                          reads ?ticket=\n"
        "        │                                          POST /auth/redeem-ticket\n"
        "        │                                          stores JWT in sessionStorage\n"
        "        │                                          scrubs URL, renders portal"
    ))

    # ── Step 1 ──────────────────────────────────────────────────────
    story.append(Paragraph("Step 1 — Server-side call from your backend", s["h2"]))
    story.append(Paragraph(
        "Call this the moment the provider clicks the \"Open RxHub\" tile. "
        "<b>Do NOT call it from the browser</b> — the <font face='Courier'>"
        "X-Embed-Secret</font> must never reach the client.",
        s["body"],
    ))

    story.append(Paragraph("Endpoint", s["h3"]))
    story.append(_pre("POST https://<rxhub-api-url>/api/v1/auth/embed-login"))
    story.append(Paragraph("Headers", s["h3"]))
    story.append(_pre(
        "Content-Type:    application/json\n"
        "X-Embed-Secret:  <value of EMBED_SHARED_SECRET — we will share this>"
    ))
    story.append(Paragraph("Request body", s["h3"]))
    story.append(_pre(
        '{\n'
        '  "email":    "dr.john@clinic.com",\n'
        '  "password": "<provider\'s password — same one used on your dashboard>"\n'
        '}'
    ))
    story.append(Paragraph("Successful response (HTTP 200)", s["h3"]))
    story.append(_pre(
        '{\n'
        '  "portal_url":        "https://<rxhub-frontend-url>/?ticket=8wZ-yR2Qn0…XQk",\n'
        '  "ticket_expires_in": 60\n'
        '}'
    ))

    story.append(Paragraph("Error responses", s["h3"]))
    story.append(_table([
        ["HTTP", "Reason", "What to do"],
        ["401", "Bad credentials or bad embed secret",
         "Show \"could not sign in\" to the provider"],
        ["403", "Admin account attempted embed-login",
         "Admins sign in directly — tell them to use the direct URL"],
        ["503", "Embed login disabled on backend (env var not set)",
         "Contact the RxHub team"],
        ["429", "Rate limited (30 requests / minute / IP)", "Retry after 60 seconds"],
    ], col_widths=[14 * mm, 72 * mm, 84 * mm]))

    # ── Step 2 ──────────────────────────────────────────────────────
    story.append(Spacer(1, 8))
    story.append(Paragraph("Step 2 — Embed the returned URL in an iframe", s["h2"]))
    story.append(Paragraph(
        "As soon as you receive the <font face='Courier'>portal_url</font>, "
        "embed it directly. Redirect the user to the page that holds the iframe "
        "immediately — the ticket is only valid for <b>60 seconds</b> from issue.",
        s["body"],
    ))
    story.append(_pre(
        '<iframe\n'
        '  src="{portal_url}"\n'
        '  width="100%"\n'
        '  height="800"\n'
        '  style="border: 0;"\n'
        '  allow="clipboard-write; web-share"\n'
        '  title="Leadway RxHub">\n'
        '</iframe>'
    ))

    story.append(Paragraph("Step 3 — That's it", s["h2"]))
    story.append(Paragraph(
        "Once the iframe loads, RxHub reads the ticket, exchanges it (one-time), "
        "stores the JWT in sessionStorage, scrubs the URL, and renders the "
        "prescription form. The provider's session lasts <b>8 hours</b> from "
        "redemption. They can navigate freely inside the iframe — no further "
        "calls from your side are needed.",
        s["body"],
    ))

    story.append(PageBreak())

    # ── Security ────────────────────────────────────────────────────
    story.append(Paragraph("Security properties you get for free", s["h2"]))
    story.append(_table([
        ["Threat", "Mitigation"],
        ["JWT leaked via browser history / referrer / logs",
         "JWT never appears in a URL — only the opaque ticket does"],
        ["Ticket replay",
         "Single-use, atomic pop on redeem, 60-second TTL"],
        ["Ticket brute-force",
         "256-bit entropy (43 URL-safe characters)"],
        ["Your dashboard impersonated",
         "X-Embed-Secret validated via constant-time HMAC comparison"],
        ["Admin account hijack via embed path",
         "Admin accounts explicitly rejected (HTTP 403)"],
        ["Direct provider sign-in at the portal URL",
         "Portal blocks all non-ticket entry in embed-only mode"],
    ], col_widths=[60 * mm, 110 * mm]))

    # ── What we share with you ──────────────────────────────────────
    story.append(Paragraph("What we send you separately (secure channel)", s["h2"]))
    story.append(_table([
        ["Value", "Example / purpose"],
        ["<rxhub-api-url>",       "e.g. https://rxhub-api.leadwayhealth.com"],
        ["<rxhub-frontend-url>",  "e.g. https://rxhub.leadwayhealth.com"],
        ["EMBED_SHARED_SECRET",   "64-character random string. Keep in your backend "
                                   "vault. Never commit, never send to browser."],
    ], col_widths=[55 * mm, 115 * mm]))
    story.append(Paragraph(
        "If the shared secret ever leaks, contact the RxHub team — we will rotate "
        "it and send you the new value.",
        s["callout"],
    ))

    # ── Testing checklist ───────────────────────────────────────────
    story.append(Paragraph("Testing / local dev checklist", s["h2"]))
    story.append(Paragraph("1. Make a curl call first (no iframe yet):", s["body"]))
    story.append(_pre(
        'curl -X POST https://<rxhub-api-url>/api/v1/auth/embed-login \\\n'
        '  -H "X-Embed-Secret: <secret>" \\\n'
        '  -H "Content-Type: application/json" \\\n'
        '  -d \'{"email":"<valid-email>","password":"<valid-password>"}\''
    ))
    story.append(Paragraph(
        "You should get back a <font face='Courier'>portal_url</font> with a "
        "ticket appended.", s["body"],
    ))
    story.append(Paragraph(
        "2. Open that URL directly in a browser <b>within 60 seconds</b>. The "
        "portal should load straight to the prescription form — no login "
        "screen.", s["body"],
    ))
    story.append(Paragraph(
        "3. Now wrap it in your iframe and confirm the provider sees the form.",
        s["body"],
    ))
    story.append(Paragraph(
        "4. Sign out. Confirm the portal blocks direct access (\"open from your "
        "provider dashboard\" screen appears).", s["body"],
    ))

    # ── Admin access (kept separate) ────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph(
        "Admin access (stays with the project owner, not the parent app)", s["h2"]
    ))
    story.append(Paragraph(
        "<b>Admin access is unchanged and does NOT go through the parent app.</b> "
        "The project owner signs in directly:",
        s["body"],
    ))
    story.append(_pre("https://<rxhub-frontend-url>/?admin=1"))
    story.append(Paragraph(
        "The <font face='Courier'>?admin=1</font> query parameter reveals the "
        "standard email/password form. Log in with the "
        "<font face='Courier'>ADMIN_BOOTSTRAP_EMAIL</font> / "
        "<font face='Courier'>ADMIN_BOOTSTRAP_PASSWORD</font> set in the backend "
        "configuration. Once signed in, the admin sees:",
        s["body"],
    ))
    for bullet in [
        "Every prescription across all providers, filterable by WellaHealth "
        "fulfilment status (Pending / Dispensed / Cancelled / etc.).",
        "Both the WellaHealth tracking code (e.g. WTR-5864CE2DA0) AND the "
        "8-digit pickup OTP (e.g. 70212673) for every request, with one-click "
        "copy buttons.",
        "Instant CSV export of any filtered view — opens directly in Excel.",
        "Per-request detail drawer with full timeline, medications, attachments, "
        "and a live \"refresh from WellaHealth\" button.",
        "Summary dashboard broken down by channel, classification, fulfilment "
        "status, and enrollee state.",
    ]:
        story.append(Paragraph(f"•&nbsp;&nbsp;{bullet}", s["body"]))
    story.append(Paragraph(
        "Nobody else has access to this URL unless they hold the admin "
        "credentials. Keep them safe.",
        s["callout"],
    ))

    # ── FAQ ────────────────────────────────────────────────────────
    story.append(Paragraph("Frequently asked questions", s["h2"]))
    faq = [
        ("Can I test from a plain browser without your embed?",
         "Yes — use <font face='Courier'>?admin=1</font> and sign in with the "
         "admin credentials supplied separately."),
        ("Does the iframe need CORS headers from my side?",
         "No. CORS is on the API, not the iframe. Just embed the URL."),
        ("What if my provider dashboard uses SSO (SAML/OAuth)?",
         "Same integration. Your backend collects or issues the provider's "
         "email + password and forwards them to "
         "<font face='Courier'>/auth/embed-login</font>."),
        ("What if a provider has the RxHub URL directly?",
         "They see the \"open from your provider dashboard\" block screen. No "
         "login form is shown."),
        ("Can I link out instead of iframe?",
         "Yes — the same <font face='Courier'>portal_url</font> works as an "
         "anchor target. Iframe is just a UX choice."),
        ("How often do ticket requests hit the rate limit?",
         "The limit is 30 per minute per IP. A normal dashboard never gets "
         "close. If you do, investigate whether the server is calling "
         "embed-login in a loop."),
    ]
    for q, a in faq:
        story.append(Paragraph(f"<b>{q}</b>", s["h3"]))
        story.append(Paragraph(a, s["body"]))

    # ── Contact ────────────────────────────────────────────────────
    story.append(Paragraph("Contact", s["h2"]))
    story.append(Paragraph(
        "If anything returns a 401 that shouldn't, or you need the shared "
        "secret rotated, reach out to the project owner. Include the HTTP "
        "status code and the response body — that's enough to diagnose most "
        "issues.",
        s["body"],
    ))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    print(f"✓ Wrote {OUT}")


if __name__ == "__main__":
    build()
