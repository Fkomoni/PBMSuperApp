"""
In-memory seed data for the PBM Super App backend.
All collections are plain Python dicts/lists — no database required.
"""
from app.core.security import hash_password
from app.core.config import settings

# ---------------------------------------------------------------------------
# DISEASE COHORTS — 10 most common Nigerian chronic conditions
# ---------------------------------------------------------------------------
DISEASE_COHORTS = [
    {"id": "dc01", "name": "Diabetes Mellitus",               "icd10": "E11",  "description": "Type 2 Diabetes Mellitus"},
    {"id": "dc02", "name": "Hypertension",                    "icd10": "I10",  "description": "Essential (Primary) Hypertension"},
    {"id": "dc03", "name": "Sickle Cell Disease",             "icd10": "D57",  "description": "Sickle-cell Disorders"},
    {"id": "dc04", "name": "Hepatitis B",                     "icd10": "B18.1","description": "Chronic Viral Hepatitis B"},
    {"id": "dc05", "name": "Seizure Disorder",                "icd10": "G40",  "description": "Epilepsy and Recurrent Seizures"},
    {"id": "dc06", "name": "Eye Disorders",                   "icd10": "H26",  "description": "Glaucoma, Diabetic Retinopathy, Cataracts"},
    {"id": "dc07", "name": "Spondylosis & Musculoskeletal",   "icd10": "M47",  "description": "Spondylosis, Arthritis, and Musculoskeletal Disorders"},
    {"id": "dc08", "name": "Autoimmune Disorders",            "icd10": "M35.9","description": "Systemic Autoimmune Diseases (SLE, Rheumatoid Arthritis)"},
    {"id": "dc09", "name": "Chronic Kidney Disease",          "icd10": "N18",  "description": "Chronic Kidney Disease (CKD)"},
    {"id": "dc10", "name": "Asthma & COPD",                   "icd10": "J45",  "description": "Asthma and Chronic Obstructive Pulmonary Disease"},
]

# Canonical 30-day medication list per cohort
_COHORT_DRUGS: dict[str, list[dict]] = {
    "dc01": [
        {"drug": "Metformin 500mg",       "cohort_id": "dc01", "qty_30day": 60},
        {"drug": "Glibenclamide 5mg",     "cohort_id": "dc01", "qty_30day": 30},
        {"drug": "Insulin NPH 100IU/mL",  "cohort_id": "dc01", "qty_30day":  1},
    ],
    "dc02": [
        {"drug": "Amlodipine 5mg",             "cohort_id": "dc02", "qty_30day": 30},
        {"drug": "Lisinopril 10mg",            "cohort_id": "dc02", "qty_30day": 30},
        {"drug": "Hydrochlorothiazide 25mg",   "cohort_id": "dc02", "qty_30day": 30},
    ],
    "dc03": [
        {"drug": "Hydroxyurea 500mg",  "cohort_id": "dc03", "qty_30day": 30},
        {"drug": "Folic Acid 5mg",     "cohort_id": "dc03", "qty_30day": 30},
        {"drug": "Proguanil 100mg",    "cohort_id": "dc03", "qty_30day": 30},
    ],
    "dc04": [
        {"drug": "Tenofovir 300mg",   "cohort_id": "dc04", "qty_30day": 30},
        {"drug": "Entecavir 0.5mg",   "cohort_id": "dc04", "qty_30day": 30},
    ],
    "dc05": [
        {"drug": "Phenobarbitone 30mg",      "cohort_id": "dc05", "qty_30day": 60},
        {"drug": "Carbamazepine 200mg",      "cohort_id": "dc05", "qty_30day": 60},
        {"drug": "Sodium Valproate 200mg",   "cohort_id": "dc05", "qty_30day": 60},
    ],
    "dc06": [
        {"drug": "Timolol Eye Drops 0.5%",      "cohort_id": "dc06", "qty_30day": 2},
        {"drug": "Latanoprost Eye Drops 0.005%","cohort_id": "dc06", "qty_30day": 1},
        {"drug": "Dexamethasone Eye Drops 0.1%","cohort_id": "dc06", "qty_30day": 1},
    ],
    "dc07": [
        {"drug": "Diclofenac 50mg",      "cohort_id": "dc07", "qty_30day": 60},
        {"drug": "Methocarbamol 500mg",  "cohort_id": "dc07", "qty_30day": 60},
        {"drug": "Prednisolone 5mg",     "cohort_id": "dc07", "qty_30day": 30},
    ],
    "dc08": [
        {"drug": "Hydroxychloroquine 200mg", "cohort_id": "dc08", "qty_30day": 60},
        {"drug": "Methotrexate 2.5mg",      "cohort_id": "dc08", "qty_30day": 12},
        {"drug": "Prednisolone 10mg",       "cohort_id": "dc08", "qty_30day": 30},
    ],
    "dc09": [
        {"drug": "Erythropoietin 4000IU inj", "cohort_id": "dc09", "qty_30day":  4},
        {"drug": "Calcium Carbonate 500mg",   "cohort_id": "dc09", "qty_30day": 90},
        {"drug": "Ferrous Sulphate 200mg",    "cohort_id": "dc09", "qty_30day": 30},
    ],
    "dc10": [
        {"drug": "Salbutamol Inhaler 100mcg",      "cohort_id": "dc10", "qty_30day": 1},
        {"drug": "Beclomethasone Inhaler 100mcg",  "cohort_id": "dc10", "qty_30day": 1},
        {"drug": "Aminophylline 100mg",            "cohort_id": "dc10", "qty_30day": 60},
    ],
}

_cohort_ids = [c["id"] for c in DISEASE_COHORTS]


def _pick_cohorts(i: int) -> list[str]:
    """Assign 0-2 disease cohorts to enrollee i for representative seed data."""
    if i % 7 == 0:
        return []
    if i % 3 == 0:
        return [_cohort_ids[i % 10], _cohort_ids[(i + 4) % 10]]
    return [_cohort_ids[i % 10]]

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
        "disease_cohorts": _pick_cohorts(i),
        "comments": [],
    }
    for i in range(1, 31)
]

# ---------------------------------------------------------------------------
# ENROLLEE MEDICATIONS — {drug, cohort_id, qty_30day} per enrollee
# Built from each enrollee's assigned disease cohorts.
# ---------------------------------------------------------------------------
ENROLLEE_MEDICATIONS: dict[str, list[dict]] = {
    e["id"]: [
        med
        for cohort_id in e["disease_cohorts"]
        for med in _COHORT_DRUGS.get(cohort_id, [])
    ]
    for e in ENROLLEES
}

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
# MEMBER REQUESTS
# Types: new_enrollment, plan_upgrade, address_change, medication_change
# Medication subtypes: drug_stoppage, new_medication, dosage_change,
#                      frequency_change, brand_change
# ---------------------------------------------------------------------------
MEMBER_REQUESTS = [
    {
        "id": "mr01",
        "enrollee_name": "Chiamaka Uzor",
        "policy_no": "LH-OS-NEW",
        "region": "Lagos",
        "request_type": "new_enrollment",
        "medication_subtype": None,
        "member_note": "Employer: MTN Group. Gold Plus plan requested.",
        "urgency": "Medium",
        "status": "Pending",
        "submitted_at": "2026-04-18T09:00:00",
        "decided_at": None,
        "decided_by": None,
        "decision_note": None,
        "current_drug": None, "requested_drug": None,
        "current_dosage": None, "requested_dosage": None,
        "current_frequency": None, "requested_frequency": None,
    },
    {
        "id": "mr02",
        "enrollee_name": "Babajide Ogunleye",
        "policy_no": "LH-LG-0092",
        "region": "Lagos",
        "request_type": "medication_change",
        "medication_subtype": "new_medication",
        "member_note": "Requesting upgrade from Silver to Gold. Insulin added to diagnosis.",
        "urgency": "High",
        "status": "Pending",
        "submitted_at": "2026-04-19T10:30:00",
        "decided_at": None,
        "decided_by": None,
        "decision_note": None,
        "current_drug": None, "requested_drug": "Insulin NPH 100IU/mL",
        "current_dosage": None, "requested_dosage": "10 units nocte",
        "current_frequency": None, "requested_frequency": "Once nightly",
    },
    {
        "id": "mr03",
        "enrollee_name": "Halima Musa",
        "policy_no": "LH-KN-0055",
        "region": "Kano",
        "request_type": "address_change",
        "medication_subtype": None,
        "member_note": "Relocated from Kano to Abuja. New address: 14 Garki Estate.",
        "urgency": "Low",
        "status": "Pending",
        "submitted_at": "2026-04-20T08:15:00",
        "decided_at": None,
        "decided_by": None,
        "decision_note": None,
        "current_drug": None, "requested_drug": None,
        "current_dosage": None, "requested_dosage": None,
        "current_frequency": None, "requested_frequency": None,
    },
    {
        "id": "mr04",
        "enrollee_name": "Emeka Eze",
        "policy_no": "LH-EN-NEW",
        "region": "Enugu",
        "request_type": "new_enrollment",
        "medication_subtype": None,
        "member_note": "Individual plan. Hypertension. Requests Chronic Lagos delivery.",
        "urgency": "Medium",
        "status": "Pending",
        "submitted_at": "2026-04-20T11:45:00",
        "decided_at": None,
        "decided_by": None,
        "decision_note": None,
        "current_drug": None, "requested_drug": None,
        "current_dosage": None, "requested_dosage": None,
        "current_frequency": None, "requested_frequency": None,
    },
    {
        "id": "mr05",
        "enrollee_name": "Adeola Ogunyemi",
        "policy_no": "LH-LG-0088",
        "region": "Lagos",
        "request_type": "medication_change",
        "medication_subtype": "dosage_change",
        "member_note": "Dr Adewale prescribing Amlodipine 10mg instead of 5mg. Specialist letter attached.",
        "urgency": "High",
        "status": "Pending",
        "submitted_at": "2026-04-21T14:00:00",
        "decided_at": None,
        "decided_by": None,
        "decision_note": None,
        "current_drug": "Amlodipine", "requested_drug": "Amlodipine",
        "current_dosage": "5mg", "requested_dosage": "10mg",
        "current_frequency": "Once daily", "requested_frequency": "Once daily",
    },
    {
        "id": "mr06",
        "enrollee_name": "Ngozi Okafor",
        "policy_no": "LH-LG-0041",
        "region": "Lagos",
        "request_type": "medication_change",
        "medication_subtype": "drug_stoppage",
        "member_note": "Metformin causing severe GI side effects. Doctor advised temporary stop.",
        "urgency": "High",
        "status": "Approved",
        "submitted_at": "2026-04-15T09:00:00",
        "decided_at": "2026-04-15T16:30:00",
        "decided_by": "pharm@leadway.com",
        "decision_note": "Approved. Member counselled to switch to diet management pending review.",
        "current_drug": "Metformin 500mg", "requested_drug": None,
        "current_dosage": "500mg BD", "requested_dosage": None,
        "current_frequency": "Twice daily", "requested_frequency": None,
    },
    {
        "id": "mr07",
        "enrollee_name": "Tunde Adeyemi",
        "policy_no": "LH-AB-0033",
        "region": "Abuja",
        "request_type": "plan_upgrade",
        "medication_subtype": None,
        "member_note": "Company changed group plan from Standard to Executive. HR letter attached.",
        "urgency": "Low",
        "status": "Approved",
        "submitted_at": "2026-04-10T10:00:00",
        "decided_at": "2026-04-11T09:00:00",
        "decided_by": "ops@leadway.com",
        "decision_note": "Verified with HR. Plan upgraded effective 1 May 2026.",
        "current_drug": None, "requested_drug": None,
        "current_dosage": None, "requested_dosage": None,
        "current_frequency": None, "requested_frequency": None,
    },
    {
        "id": "mr08",
        "enrollee_name": "Fatima Bello",
        "policy_no": "LH-KN-0071",
        "region": "Kano",
        "request_type": "medication_change",
        "medication_subtype": "brand_change",
        "member_note": "Requesting Glucophage brand over generic Metformin — better tolerance.",
        "urgency": "Low",
        "status": "Rejected",
        "submitted_at": "2026-04-12T13:00:00",
        "decided_at": "2026-04-13T11:00:00",
        "decided_by": "pharm@leadway.com",
        "decision_note": "Rejected. Scheme formulary covers generic only. Member advised to discuss with treating physician.",
        "current_drug": "Metformin 500mg (generic)", "requested_drug": "Glucophage 500mg",
        "current_dosage": "500mg", "requested_dosage": "500mg",
        "current_frequency": "Twice daily", "requested_frequency": "Twice daily",
    },
    {
        "id": "mr09",
        "enrollee_name": "Chidi Nwosu",
        "policy_no": "LH-PH-0019",
        "region": "Port Harcourt",
        "request_type": "medication_change",
        "medication_subtype": "frequency_change",
        "member_note": "Cardiologist changed Lisinopril from once daily to twice daily for better BP control.",
        "urgency": "Medium",
        "status": "Pending",
        "submitted_at": "2026-04-22T08:45:00",
        "decided_at": None,
        "decided_by": None,
        "decision_note": None,
        "current_drug": "Lisinopril 10mg", "requested_drug": "Lisinopril 10mg",
        "current_dosage": "10mg", "requested_dosage": "10mg",
        "current_frequency": "Once daily", "requested_frequency": "Twice daily",
    },
    {
        "id": "mr10",
        "enrollee_name": "Amina Sule",
        "policy_no": "LH-AB-0060",
        "region": "Abuja",
        "request_type": "medication_change",
        "medication_subtype": "new_medication",
        "member_note": "Neurologist added Carbamazepine 200mg for newly diagnosed seizure disorder.",
        "urgency": "High",
        "status": "Pending",
        "submitted_at": "2026-04-23T07:30:00",
        "decided_at": None,
        "decided_by": None,
        "decision_note": None,
        "current_drug": None, "requested_drug": "Carbamazepine 200mg",
        "current_dosage": None, "requested_dosage": "200mg",
        "current_frequency": None, "requested_frequency": "Twice daily",
    },
]

# ---------------------------------------------------------------------------
# NOTIFICATIONS (decision outcomes sent back to members)
# ---------------------------------------------------------------------------
NOTIFICATIONS: list[dict] = [
    {
        "id": "n01",
        "policy_no": "LH-LG-0041",
        "request_id": "mr06",
        "message": "Your Medication Change request (drug stoppage — Metformin 500mg) has been Approved. "
                   "Pharmacist note: Member counselled to switch to diet management pending review.",
        "channel": "email",
        "sent_at": "2026-04-15T16:35:00",
        "read": True,
    },
    {
        "id": "n02",
        "policy_no": "LH-AB-0033",
        "request_id": "mr07",
        "message": "Your Plan Upgrade request has been Approved. "
                   "New plan effective 1 May 2026. Contact us for any questions.",
        "channel": "sms",
        "sent_at": "2026-04-11T09:05:00",
        "read": False,
    },
    {
        "id": "n03",
        "policy_no": "LH-KN-0071",
        "request_id": "mr08",
        "message": "Your Medication Change request (brand change — Glucophage) has been Rejected. "
                   "Scheme formulary covers generic only. Please discuss with your physician.",
        "channel": "email",
        "sent_at": "2026-04-13T11:05:00",
        "read": False,
    },
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
