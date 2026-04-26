"""
In-memory seed data for the PBM Super App backend.
All collections are plain Python dicts/lists — no database required.
"""
from app.core.security import hash_password
from app.core.config import settings

# ---------------------------------------------------------------------------
# STAFF (seed accounts)
# Passwords loaded from STAFF_DEFAULT_PASSWORD env var — never committed.
# In production replace with Azure AD / Entra ID SSO (no local passwords).
# ---------------------------------------------------------------------------
_pw = hash_password(settings.STAFF_DEFAULT_PASSWORD)

STAFF = [
    {"id": "s1", "email": "pharm@leadway.com",     "hashed_password": _pw, "role": "pharmacist",  "name": "Pharmacy User"},
    {"id": "s2", "email": "ops@leadway.com",        "hashed_password": _pw, "role": "pharm_ops",   "name": "Pharm Ops User"},
    {"id": "s3", "email": "logistics@leadway.com",  "hashed_password": _pw, "role": "logistics",   "name": "Logistics User"},
    {"id": "s4", "email": "contact@leadway.com",    "hashed_password": _pw, "role": "contact",     "name": "Contact Centre User"},
    {"id": "s5", "email": "admin@leadway.com",      "hashed_password": _pw, "role": "admin",       "name": "Admin User"},
    {"id": "s6", "email": "rider@leadway.com",      "hashed_password": _pw, "role": "rider",       "name": "Rider User"},
]

# ---------------------------------------------------------------------------
# ENROLLEES (30)
# ---------------------------------------------------------------------------
_regions  = ["Lagos", "Abuja", "Port Harcourt", "Kano", "Ibadan", "Enugu"]
_companies = ["Leadway Assurance", "Crusader Sterling", "AXA Mansard", "AIICO", "Sovereign Trust", "Stanbic IBTC"]
_schemes  = ["Standard", "Executive", "Premium", "Basic", "VIP"]
_statuses = ["Active", "Suspended", "Pending", "Lapsed"]

ENROLLEES = [
    {
        "id": f"e{i:02d}",
        "name": f"Enrollee {i}",
        "email": f"enrollee{i}@example.com",
        "phone": f"080{i:08d}",
        "region": _regions[i % len(_regions)],
        "company": _companies[i % len(_companies)],
        "scheme": _schemes[i % len(_schemes)],
        "status": _statuses[i % len(_statuses)],
        "policy_no": f"LW-2026-{i:04d}",
        "comments": [],
    }
    for i in range(1, 31)
]

# ---------------------------------------------------------------------------
# ACUTE ORDERS (7)
# ---------------------------------------------------------------------------
_buckets = ["Pending", "Processing", "Dispatched", "Delivered", "Cancelled"]

ACUTE_ORDERS = [
    {
        "id": f"ao{i}",
        "enrollee_id": f"e{i:02d}",
        "enrollee_name": f"Enrollee {i}",
        "drug": f"Drug {chr(64 + i)}",
        "quantity": i * 2,
        "bucket": _buckets[i % len(_buckets)],
        "region": _regions[i % len(_regions)],
        "created_at": f"2026-04-{i:02d}T08:00:00",
        "notes": "",
    }
    for i in range(1, 8)
]

# ---------------------------------------------------------------------------
# RIDERS (6)
# ---------------------------------------------------------------------------
_rider_statuses = ["Available", "On Delivery", "Off Duty"]

RIDERS = [
    {
        "id": f"r{i}",
        "name": f"Rider {i}",
        "phone": f"070{i:08d}",
        "region": _regions[i % len(_regions)],
        "status": _rider_statuses[i % len(_rider_statuses)],
        "deliveries_today": i * 3,
        "vehicle": "Motorcycle" if i % 2 == 0 else "Bicycle",
    }
    for i in range(1, 7)
]

# ---------------------------------------------------------------------------
# DRUGS / STOCK (18)
# ---------------------------------------------------------------------------
_drug_categories = ["Analgesic", "Antibiotic", "Antihypertensive", "Antidiabetic", "Antihistamine", "Vitamin"]

DRUGS = [
    {
        "id": f"d{i:02d}",
        "name": f"Drug-{chr(64 + i)}",
        "category": _drug_categories[i % len(_drug_categories)],
        "stock_level": (i * 37) % 500 + 10,
        "unit": "tablets",
        "reorder_level": 50,
        "partner_id": f"p{(i % 8) + 1}",
        "price_ngn": round(i * 125.50, 2),
    }
    for i in range(1, 19)
]

# ---------------------------------------------------------------------------
# PARTNERS (8)
# ---------------------------------------------------------------------------
_partner_types = ["Pharmacy", "Hospital", "Diagnostic Centre", "Clinic"]

PARTNERS = [
    {
        "id": f"p{i}",
        "name": f"Partner {i} Health",
        "type": _partner_types[i % len(_partner_types)],
        "region": _regions[i % len(_regions)],
        "contact": f"partner{i}@health.ng",
        "active": i % 5 != 0,
        "claims_this_month": i * 14,
    }
    for i in range(1, 9)
]

# ---------------------------------------------------------------------------
# CLAIMS
# ---------------------------------------------------------------------------
_claim_statuses = ["Approved", "Pending", "Rejected", "Under Review"]

CLAIMS = [
    {
        "id": f"c{i:02d}",
        "enrollee_id": f"e{i:02d}",
        "enrollee_name": f"Enrollee {i}",
        "partner_id": f"p{(i % 8) + 1}",
        "amount_ngn": round(i * 3750.00, 2),
        "status": _claim_statuses[i % len(_claim_statuses)],
        "drug": f"Drug-{chr(64 + (i % 18) + 1)}",
        "date": f"2026-04-{(i % 28) + 1:02d}",
        "scheme": _schemes[i % len(_schemes)],
    }
    for i in range(1, 31)
]

# ---------------------------------------------------------------------------
# AUDIT LOGS (12)
# ---------------------------------------------------------------------------
_audit_actions = ["LOGIN", "VIEW_ENROLLEE", "UPDATE_ORDER", "APPROVE_CLAIM", "ADD_COMMENT", "EXPORT_REPORT"]
_audit_roles   = ["pharmacist", "pharm_ops", "logistics", "contact", "admin", "rider"]

AUDIT = [
    {
        "id": f"a{i:02d}",
        "user": f"{_audit_roles[i % len(_audit_roles)]}@leadway.com",
        "role": _audit_roles[i % len(_audit_roles)],
        "action": _audit_actions[i % len(_audit_actions)],
        "resource": f"enrollee/e{i:02d}" if i % 2 == 0 else f"order/ao{i % 7 + 1}",
        "timestamp": f"2026-04-{(i % 25) + 1:02d}T{(i % 12) + 6:02d}:00:00",
        "ip": f"10.0.0.{i}",
        "detail": f"Audit event {i} details",
    }
    for i in range(1, 13)
]

# ---------------------------------------------------------------------------
# SCHEME RULES (6)
# ---------------------------------------------------------------------------
SCHEME_RULES = [
    {
        "id": f"sr{i}",
        "scheme": _schemes[(i - 1) % len(_schemes)],
        "max_annual_benefit_ngn": [500_000, 1_000_000, 2_000_000, 250_000, 5_000_000, 750_000][i - 1],
        "copay_percent": [20, 10, 5, 30, 0, 15][i - 1] if i <= 6 else 10,
        "drug_coverage": "Formulary A" if i % 2 == 0 else "Formulary B",
        "preauth_required": i > 3,
        "active": True,
    }
    for i in range(1, 7)
]
