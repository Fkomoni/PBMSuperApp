"""
In-memory seed data for the PBM Super App backend.
All collections are plain Python dicts/lists — no database required.
"""
import datetime as _dt
from app.core.security import hash_password
from app.core.config import settings

_TODAY = _dt.date(2026, 4, 18)

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

# Canonical 30-day medication list per cohort.
# generic_name drives duplicate detection; brand=None means generic formulation.
# Intentional cross-cohort duplicates for flag testing:
#   Prednisolone  → dc07 (5mg)  + dc08 (10mg)
#   Folic Acid    → dc03 + dc05 + dc08
#   Omeprazole    → dc01 + dc07
_COHORT_DRUGS: dict[str, list[dict]] = {
    "dc01": [
        {"drug": "Metformin 500mg",      "generic_name": "Metformin",    "brand": None, "cohort_id": "dc01", "qty_30day": 60, "dosage": "500mg BD",    "frequency": "Twice daily",      "route": "Oral"},
        {"drug": "Glibenclamide 5mg",    "generic_name": "Glibenclamide","brand": None, "cohort_id": "dc01", "qty_30day": 30, "dosage": "5mg OD",     "frequency": "Once daily",       "route": "Oral"},
        {"drug": "Insulin NPH 100IU/mL", "generic_name": "Insulin NPH",  "brand": None, "cohort_id": "dc01", "qty_30day":  1, "dosage": "10 units",   "frequency": "Once nightly",     "route": "Subcutaneous"},
        {"drug": "Omeprazole 20mg",      "generic_name": "Omeprazole",   "brand": None, "cohort_id": "dc01", "qty_30day": 30, "dosage": "20mg OD",    "frequency": "Once daily",       "route": "Oral"},
    ],
    "dc02": [
        {"drug": "Amlodipine 5mg",           "generic_name": "Amlodipine",          "brand": None, "cohort_id": "dc02", "qty_30day": 30, "dosage": "5mg OD",  "frequency": "Once daily", "route": "Oral"},
        {"drug": "Lisinopril 10mg",          "generic_name": "Lisinopril",          "brand": None, "cohort_id": "dc02", "qty_30day": 30, "dosage": "10mg OD", "frequency": "Once daily", "route": "Oral"},
        {"drug": "Hydrochlorothiazide 25mg", "generic_name": "Hydrochlorothiazide", "brand": None, "cohort_id": "dc02", "qty_30day": 30, "dosage": "25mg OD", "frequency": "Once daily", "route": "Oral"},
        {"drug": "Atenolol 50mg",            "generic_name": "Atenolol",            "brand": None, "cohort_id": "dc02", "qty_30day": 30, "dosage": "50mg OD", "frequency": "Once daily", "route": "Oral"},
    ],
    "dc03": [
        {"drug": "Hydroxyurea 500mg",  "generic_name": "Hydroxyurea",              "brand": None, "cohort_id": "dc03", "qty_30day": 30, "dosage": "500mg OD",  "frequency": "Once daily",  "route": "Oral"},
        {"drug": "Folic Acid 5mg",     "generic_name": "Folic Acid",               "brand": None, "cohort_id": "dc03", "qty_30day": 30, "dosage": "5mg OD",    "frequency": "Once daily",  "route": "Oral"},
        {"drug": "Proguanil 100mg",    "generic_name": "Proguanil",                "brand": None, "cohort_id": "dc03", "qty_30day": 30, "dosage": "100mg OD",  "frequency": "Once daily",  "route": "Oral"},
        {"drug": "Penicillin V 250mg", "generic_name": "Phenoxymethylpenicillin",  "brand": None, "cohort_id": "dc03", "qty_30day": 60, "dosage": "250mg BD",  "frequency": "Twice daily", "route": "Oral"},
    ],
    "dc04": [
        {"drug": "Tenofovir DF 300mg", "generic_name": "Tenofovir Disoproxil", "brand": None, "cohort_id": "dc04", "qty_30day": 30, "dosage": "300mg OD",  "frequency": "Once daily", "route": "Oral"},
        {"drug": "Entecavir 0.5mg",    "generic_name": "Entecavir",            "brand": None, "cohort_id": "dc04", "qty_30day": 30, "dosage": "0.5mg OD", "frequency": "Once daily", "route": "Oral"},
        {"drug": "Vitamin B Complex",  "generic_name": "Vitamin B Complex",    "brand": None, "cohort_id": "dc04", "qty_30day": 30, "dosage": "1 tab OD", "frequency": "Once daily", "route": "Oral"},
    ],
    "dc05": [
        {"drug": "Phenobarbitone 30mg",    "generic_name": "Phenobarbital", "brand": None, "cohort_id": "dc05", "qty_30day": 60, "dosage": "30mg BD",  "frequency": "Twice daily", "route": "Oral"},
        {"drug": "Carbamazepine 200mg",    "generic_name": "Carbamazepine", "brand": None, "cohort_id": "dc05", "qty_30day": 60, "dosage": "200mg BD", "frequency": "Twice daily", "route": "Oral"},
        {"drug": "Sodium Valproate 200mg", "generic_name": "Valproic Acid", "brand": None, "cohort_id": "dc05", "qty_30day": 60, "dosage": "200mg BD", "frequency": "Twice daily", "route": "Oral"},
        {"drug": "Folic Acid 5mg",         "generic_name": "Folic Acid",    "brand": None, "cohort_id": "dc05", "qty_30day": 30, "dosage": "5mg OD",   "frequency": "Once daily",  "route": "Oral"},
    ],
    "dc06": [
        {"drug": "Timolol Eye Drops 0.5%",        "generic_name": "Timolol",          "brand": None, "cohort_id": "dc06", "qty_30day": 2, "dosage": "1 drop BD",  "frequency": "Twice daily",      "route": "Ophthalmic"},
        {"drug": "Latanoprost 0.005% Eye Drops",  "generic_name": "Latanoprost",      "brand": None, "cohort_id": "dc06", "qty_30day": 1, "dosage": "1 drop ON",  "frequency": "Once nightly",     "route": "Ophthalmic"},
        {"drug": "Dorzolamide 2% Eye Drops",      "generic_name": "Dorzolamide",      "brand": None, "cohort_id": "dc06", "qty_30day": 1, "dosage": "1 drop TDS", "frequency": "Three times daily","route": "Ophthalmic"},
        {"drug": "Dexamethasone 0.1% Eye Drops",  "generic_name": "Dexamethasone Eye","brand": None, "cohort_id": "dc06", "qty_30day": 1, "dosage": "1 drop QID", "frequency": "Four times daily", "route": "Ophthalmic"},
    ],
    "dc07": [
        {"drug": "Diclofenac 50mg",     "generic_name": "Diclofenac",    "brand": None, "cohort_id": "dc07", "qty_30day": 60, "dosage": "50mg BD",   "frequency": "Twice daily",      "route": "Oral"},
        {"drug": "Meloxicam 15mg",      "generic_name": "Meloxicam",     "brand": None, "cohort_id": "dc07", "qty_30day": 30, "dosage": "15mg OD",   "frequency": "Once daily",       "route": "Oral"},
        {"drug": "Methocarbamol 500mg", "generic_name": "Methocarbamol", "brand": None, "cohort_id": "dc07", "qty_30day": 60, "dosage": "500mg TDS", "frequency": "Three times daily","route": "Oral"},
        {"drug": "Prednisolone 5mg",    "generic_name": "Prednisolone",  "brand": None, "cohort_id": "dc07", "qty_30day": 30, "dosage": "5mg OD",    "frequency": "Once daily",       "route": "Oral"},
        {"drug": "Omeprazole 20mg",     "generic_name": "Omeprazole",    "brand": None, "cohort_id": "dc07", "qty_30day": 30, "dosage": "20mg OD",   "frequency": "Once daily",       "route": "Oral"},
    ],
    "dc08": [
        {"drug": "Hydroxychloroquine 200mg", "generic_name": "Hydroxychloroquine", "brand": None, "cohort_id": "dc08", "qty_30day": 60, "dosage": "200mg BD", "frequency": "Twice daily", "route": "Oral"},
        {"drug": "Methotrexate 2.5mg",       "generic_name": "Methotrexate",       "brand": None, "cohort_id": "dc08", "qty_30day": 12, "dosage": "2.5mg",    "frequency": "Once weekly", "route": "Oral"},
        {"drug": "Prednisolone 10mg",        "generic_name": "Prednisolone",       "brand": None, "cohort_id": "dc08", "qty_30day": 30, "dosage": "10mg OD",  "frequency": "Once daily",  "route": "Oral"},
        {"drug": "Folic Acid 5mg",           "generic_name": "Folic Acid",         "brand": None, "cohort_id": "dc08", "qty_30day": 30, "dosage": "5mg OD",   "frequency": "Once daily",  "route": "Oral"},
    ],
    "dc09": [
        {"drug": "Erythropoietin 4000IU inj", "generic_name": "Erythropoietin",   "brand": None, "cohort_id": "dc09", "qty_30day":  4, "dosage": "4000IU",    "frequency": "Twice weekly",     "route": "Subcutaneous"},
        {"drug": "Calcium Carbonate 500mg",   "generic_name": "Calcium Carbonate","brand": None, "cohort_id": "dc09", "qty_30day": 90, "dosage": "500mg TDS", "frequency": "Three times daily","route": "Oral"},
        {"drug": "Ferrous Sulphate 200mg",    "generic_name": "Ferrous Sulphate",  "brand": None, "cohort_id": "dc09", "qty_30day": 30, "dosage": "200mg OD",  "frequency": "Once daily",       "route": "Oral"},
        {"drug": "Furosemide 40mg",           "generic_name": "Furosemide",        "brand": None, "cohort_id": "dc09", "qty_30day": 30, "dosage": "40mg OD",   "frequency": "Once daily",       "route": "Oral"},
    ],
    "dc10": [
        {"drug": "Salbutamol Inhaler 100mcg",     "generic_name": "Salbutamol",    "brand": None, "cohort_id": "dc10", "qty_30day":  1, "dosage": "2 puffs PRN", "frequency": "As needed",   "route": "Inhaled"},
        {"drug": "Beclomethasone Inhaler 200mcg", "generic_name": "Beclomethasone","brand": None, "cohort_id": "dc10", "qty_30day":  1, "dosage": "2 puffs BD",  "frequency": "Twice daily", "route": "Inhaled"},
        {"drug": "Aminophylline 100mg",           "generic_name": "Theophylline",  "brand": None, "cohort_id": "dc10", "qty_30day": 60, "dosage": "100mg BD",    "frequency": "Twice daily", "route": "Oral"},
        {"drug": "Montelukast 10mg",              "generic_name": "Montelukast",   "brand": None, "cohort_id": "dc10", "qty_30day": 30, "dosage": "10mg ON",     "frequency": "Once nightly","route": "Oral"},
    ],
}

# Per-member supplemental medications — brand conflicts and standalone Rx.
_MEMBER_EXTRA_MEDS: dict[str, list[dict]] = {
    # Member 50 has dc01 (generic Metformin) + brand Glucophage → BRAND_CONFLICT
    "21000050/0": [
        {"drug": "Glucophage 500mg",     "generic_name": "Metformin",    "brand": "Glucophage",  "cohort_id": None, "qty_30day": 60, "dosage": "500mg BD",    "frequency": "Twice daily",      "route": "Oral"},
    ],
    # Member 22 (dc04) gets extra Vitamin B Complex from standalone Rx → DUPLICATE_GENERIC
    "21000022/0": [
        {"drug": "Neurovit Forte",       "generic_name": "Vitamin B Complex", "brand": "Neurovit","cohort_id": None, "qty_30day": 30, "dosage": "1 cap OD",   "frequency": "Once daily",       "route": "Oral"},
        {"drug": "Paracetamol 500mg",    "generic_name": "Paracetamol",  "brand": None,          "cohort_id": None, "qty_30day": 60, "dosage": "500mg TDS PRN","frequency": "PRN",             "route": "Oral"},
    ],
    # Member 55 — ultra-complex, manually push well past 18 meds
    "21000055/0": [
        {"drug": "Omeprazole 40mg",      "generic_name": "Omeprazole",   "brand": None,          "cohort_id": None, "qty_30day": 30, "dosage": "40mg OD",     "frequency": "Once daily",       "route": "Oral"},
        {"drug": "Paracetamol 500mg",    "generic_name": "Paracetamol",  "brand": None,          "cohort_id": None, "qty_30day": 60, "dosage": "500mg TDS PRN","frequency": "PRN",             "route": "Oral"},
        {"drug": "Vitamin B Complex",    "generic_name": "Vitamin B Complex","brand": None,       "cohort_id": None, "qty_30day": 30, "dosage": "1 tab OD",    "frequency": "Once daily",       "route": "Oral"},
        {"drug": "Calcium + Vit D3",     "generic_name": "Calcium Carbonate","brand": None,       "cohort_id": None, "qty_30day": 90, "dosage": "500mg TDS",   "frequency": "Three times daily","route": "Oral"},
    ],
}

# High-polypharmacy / deliberate-duplicate overrides (keyed by 1-based enrollee index)
_COHORT_OVERRIDES: dict[int, list[str]] = {
    # dc07+dc08 → Prednisolone dup; dc01+dc07 → Omeprazole dup (~21 meds)
    45: ["dc01", "dc02", "dc07", "dc08", "dc10"],
    # dc03+dc05+dc08 → triple Folic Acid; dc01+dc07 → Omeprazole dup (~22 meds)
    50: ["dc01", "dc03", "dc05", "dc07", "dc08"],
    # Maximum complexity — 7 cohorts, all duplicate classes present (~30 meds)
    55: ["dc01", "dc02", "dc03", "dc05", "dc07", "dc08", "dc10"],
    # Clean high-complexity (no intentional dups, ~16 meds)
    60: ["dc02", "dc03", "dc06", "dc09"],
}

_cohort_ids = [c["id"] for c in DISEASE_COHORTS]


def _pick_cohorts(i: int) -> list[str]:
    """Tiered cohort assignment: 0 cohorts (no Rx) → 6 cohorts (polypharmacy)."""
    if i in _COHORT_OVERRIDES:
        return _COHORT_OVERRIDES[i]
    if i % 8 == 0:                     # ~12 % of members are prescription-free
        return []
    tier = (i - 1) // 10              # tier 0-5 as i climbs from 1→60
    base = (i - 1) % 10
    picks = [_cohort_ids[base]]
    if tier >= 1: picks.append(_cohort_ids[(base + 3) % 10])
    if tier >= 2: picks.append(_cohort_ids[(base + 6) % 10])
    if tier >= 3: picks.append(_cohort_ids[(base + 8) % 10])
    if tier >= 4: picks.append(_cohort_ids[(base + 1) % 10])
    if tier >= 5: picks.append(_cohort_ids[(base + 4) % 10])
    return list(dict.fromkeys(picks))  # preserve order, remove accidental dups

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
# ENROLLEES (60) — real Nigerian names, member-ID format 2100XXXX/0
# ---------------------------------------------------------------------------
_names_60 = [
    ("Chiamaka",    "Uzor"),         ("Babajide",    "Ogunleye"),    ("Halima",       "Musa"),
    ("Emeka",       "Eze"),          ("Adeola",      "Ogunyemi"),    ("Ngozi",        "Okafor"),
    ("Tunde",       "Adeyemi"),      ("Fatima",      "Bello"),       ("Chidi",        "Nwosu"),
    ("Amina",       "Sule"),         ("Segun",       "Adesanya"),    ("Blessing",     "Chukwu"),
    ("Ibrahim",     "Garba"),        ("Yetunde",     "Olawale"),     ("Obinna",       "Onyekachi"),
    ("Zainab",      "Aliyu"),        ("Rotimi",      "Akintunde"),   ("Adaeze",       "Okonkwo"),
    ("Musa",        "Abdullahi"),    ("Bukola",      "Fashola"),     ("Chinedu",      "Nwachukwu"),
    ("Khadija",     "Usman"),        ("Femi",        "Adesina"),     ("Ifeoma",       "Nduka"),
    ("Yusuf",       "Abubakar"),     ("Toyin",       "Olorunfemi"),  ("Uche",         "Ogbuagu"),
    ("Aisha",       "Ibrahim"),      ("Dele",        "Akinseye"),    ("Chidinma",     "Onuoha"),
    ("Suleiman",    "Danlami"),      ("Adenike",     "Balogun"),     ("Nnamdi",       "Obi"),
    ("Zulaihat",    "Yakubu"),       ("Wale",        "Badmus"),      ("Adaora",       "Obiechina"),
    ("Garba",       "Hassan"),       ("Shade",       "Adewuyi"),     ("Ifeanyi",      "Okeke"),
    ("Maryam",      "Kabir"),        ("Dapo",        "Sobowale"),    ("Uju",          "Ezenwachi"),
    ("Aminu",       "Lawan"),        ("Bola",        "Akande"),      ("Chukwuemeka", "Agu"),
    ("Sadiya",      "Ismail"),       ("Kunle",       "Adeyinka"),    ("Nneka",        "Dibia"),
    ("Abdullahi",   "Danmusa"),      ("Modupe",      "Okubena"),     ("Ozzy",         "Okonkwo"),
    ("Bilkis",      "Waziri"),       ("Ayobami",     "Oladele"),     ("Chinwe",       "Abafor"),
    ("Nasiru",      "Kwankwaso"),    ("Funmilayo",   "Adeyeye"),     ("Obi",          "Nwofor"),
    ("Hadiza",      "Gwadabe"),      ("Tobi",        "Adesola"),     ("Grace",        "Obiora"),
]

_regions   = ["Lagos", "Abuja", "Port Harcourt", "Kano", "Ibadan", "Enugu"]
_companies = [
    "Leadway Assurance", "Crusader Sterling", "AXA Mansard",
    "AIICO", "Sovereign Trust", "Stanbic IBTC",
    "Cornerstone Insurance", "Custodian Life",
]
_schemes = [
    "Magnum", "Promax", "Max", "Pro", "Plus",
    "Senior Cranberry", "Senior Blueberry", "Senior Blackberry",
    "Senior Raspberry", "MRcare 1", "MRcare 2",
]
_statuses = ["Active", "Suspended", "Pending", "Lapsed"]

ENROLLEES = [
    {
        "id":             f"2100{i:04d}/0",
        "policy_no":      f"2100{i:04d}/0",
        "name":           f"{_names_60[i-1][0]} {_names_60[i-1][1]}",
        "email":          f"{_names_60[i-1][0].lower()}.{_names_60[i-1][1].lower()}@example.ng",
        "phone":          f"080{i:08d}",
        "region":         _regions[(i - 1) % len(_regions)],
        "company":        _companies[(i - 1) % len(_companies)],
        "scheme":         _schemes[(i - 1) % len(_schemes)],
        "status":         _statuses[(i - 1) % len(_statuses)],
        "disease_cohorts": _pick_cohorts(i),
        "next_refill":    (_TODAY + _dt.timedelta(days=(i - 1) % 30 + 1)).isoformat(),
        "adherence":      62 + (i * 13 % 38),
        "copay":          (i % 5 + 1) * 1500,
        "benefit_cap":    ((i % 4) + 3) * 150000,
        "comments":       [],
    }
    for i in range(1, 61)
]

# ---------------------------------------------------------------------------
# ENROLLEE MEDICATIONS — structured {drug, generic_name, brand, cohort_id,
#   qty_30day, dosage, frequency, route} list per member.
# Supplemental/brand-conflict meds appended from _MEMBER_EXTRA_MEDS.
# ---------------------------------------------------------------------------
ENROLLEE_MEDICATIONS: dict[str, list[dict]] = {
    e["id"]: (
        [med for cid in e["disease_cohorts"] for med in _COHORT_DRUGS.get(cid, [])]
        + _MEMBER_EXTRA_MEDS.get(e["id"], [])
    )
    for e in ENROLLEES
}

# ---------------------------------------------------------------------------
# ACUTE ORDERS (20)
# ---------------------------------------------------------------------------
_buckets = ["Pending", "Processing", "Dispatched", "Delivered", "Cancelled", "Awaiting Claim"]
_ao_drugs = [
    "Metformin 500mg", "Amlodipine 5mg", "Hydroxyurea 500mg", "Tenofovir DF 300mg",
    "Carbamazepine 200mg", "Timolol Eye Drops 0.5%", "Diclofenac 50mg",
    "Hydroxychloroquine 200mg", "Erythropoietin 4000IU inj", "Salbutamol Inhaler 100mcg",
    "Lisinopril 10mg", "Insulin NPH 100IU/mL", "Folic Acid 5mg", "Prednisolone 5mg",
    "Omeprazole 20mg", "Glibenclamide 5mg", "Furosemide 40mg", "Montelukast 10mg",
    "Entecavir 0.5mg", "Sodium Valproate 200mg",
]

ACUTE_ORDERS = [
    {
        "id":            f"ao{i:02d}",
        "enrollee_id":   f"2100{i:04d}/0",
        "enrollee_name": f"{_names_60[i-1][0]} {_names_60[i-1][1]}",
        "drug":          _ao_drugs[(i - 1) % len(_ao_drugs)],
        "quantity":      (i % 5 + 1) * 10,
        "bucket":        _buckets[(i - 1) % len(_buckets)],
        "region":        _regions[(i - 1) % len(_regions)],
        "created_at":    f"2026-04-{(i % 28) + 1:02d}T{(i % 10) + 8:02d}:00:00",
        "notes":         "",
        # Rider assignment — populated by POST /assign-rider, cleared by /unpack
        "rider_id":      None,
        "rider_name":    None,
        "assigned_at":   None,
        # Claim linkage — populated by POST /submit-claim
        "claim_id":      None,
        "partner_id":    None,
        "amount_ngn":    None,
    }
    for i in range(1, 21)
]

# ---------------------------------------------------------------------------
# RIDERS (10)
# ---------------------------------------------------------------------------
_rider_names = [
    "Emeka Obi", "Tunde Lawal", "Musa Garba", "Chidi Eze", "Segun Adebayo",
    "Ibrahim Sule", "Rotimi Alabi", "Nnamdi Uche", "Aminu Danlami", "Dele Fashola",
]
_rider_statuses = ["Available", "On Delivery", "Off Duty"]

RIDERS = [
    {
        "id":               f"r{i:02d}",
        "name":             _rider_names[i - 1],
        "phone":            f"070{i:08d}",
        "region":           _regions[(i - 1) % len(_regions)],
        "status":           _rider_statuses[(i - 1) % len(_rider_statuses)],
        "deliveries_today": (i % 8) + 1,
        "vehicle":          "Motorcycle" if i % 2 == 0 else "Bicycle",
    }
    for i in range(1, 11)
]

# ---------------------------------------------------------------------------
# DRUGS / TARIFF (70 real drugs)
# Fields: id, name, generic_name, brand_name, category, form,
#         strength, stock_level, unit, reorder_level, price_ngn,
#         formulary (A/B/C), partner_id
# ---------------------------------------------------------------------------
DRUGS = [
    # ── Antidiabetic ──────────────────────────────────────────────────────
    {"id":"d01","name":"Metformin 500mg",           "generic_name":"Metformin",           "brand_name":None,           "category":"Antidiabetic",       "form":"Tablet",   "strength":"500mg",       "stock_level":850,"unit":"tablets",  "reorder_level":150,"price_ngn":200.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d02","name":"Metformin 1000mg",          "generic_name":"Metformin",           "brand_name":None,           "category":"Antidiabetic",       "form":"Tablet",   "strength":"1000mg",      "stock_level":620,"unit":"tablets",  "reorder_level":100,"price_ngn":380.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d03","name":"Glibenclamide 5mg",         "generic_name":"Glibenclamide",       "brand_name":None,           "category":"Antidiabetic",       "form":"Tablet",   "strength":"5mg",         "stock_level":540,"unit":"tablets",  "reorder_level":100,"price_ngn":180.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d04","name":"Gliclazide MR 60mg",        "generic_name":"Gliclazide",          "brand_name":None,           "category":"Antidiabetic",       "form":"Tablet",   "strength":"60mg",        "stock_level":380,"unit":"tablets",  "reorder_level": 80,"price_ngn":650.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d05","name":"Glimepiride 2mg",            "generic_name":"Glimepiride",         "brand_name":None,           "category":"Antidiabetic",       "form":"Tablet",   "strength":"2mg",         "stock_level":290,"unit":"tablets",  "reorder_level": 60,"price_ngn":580.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d06","name":"Insulin NPH 100IU/mL",      "generic_name":"Insulin NPH",         "brand_name":None,           "category":"Antidiabetic",       "form":"Injection","strength":"100IU/mL",    "stock_level":120,"unit":"vials",    "reorder_level": 30,"price_ngn":4800.00, "formulary":"A","partner_id":"p03"},
    {"id":"d07","name":"Insulin Glargine 100IU/mL", "generic_name":"Insulin Glargine",    "brand_name":"Lantus",       "category":"Antidiabetic",       "form":"Injection","strength":"100IU/mL",    "stock_level": 45,"unit":"vials",    "reorder_level": 15,"price_ngn":18000.00,"formulary":"A","partner_id":"p03"},
    {"id":"d08","name":"Glucophage 500mg",           "generic_name":"Metformin",           "brand_name":"Glucophage",   "category":"Antidiabetic",       "form":"Tablet",   "strength":"500mg",       "stock_level":180,"unit":"tablets",  "reorder_level": 50,"price_ngn":650.00,  "formulary":"B","partner_id":"p04"},
    # ── Antihypertensive ─────────────────────────────────────────────────
    {"id":"d09","name":"Amlodipine 5mg",             "generic_name":"Amlodipine",          "brand_name":None,           "category":"Antihypertensive",   "form":"Tablet",   "strength":"5mg",         "stock_level":720,"unit":"tablets",  "reorder_level":120,"price_ngn":850.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d10","name":"Amlodipine 10mg",            "generic_name":"Amlodipine",          "brand_name":None,           "category":"Antihypertensive",   "form":"Tablet",   "strength":"10mg",        "stock_level":480,"unit":"tablets",  "reorder_level": 80,"price_ngn":1100.00, "formulary":"A","partner_id":"p01"},
    {"id":"d11","name":"Norvasc 5mg",                "generic_name":"Amlodipine",          "brand_name":"Norvasc",      "category":"Antihypertensive",   "form":"Tablet",   "strength":"5mg",         "stock_level": 90,"unit":"tablets",  "reorder_level": 20,"price_ngn":2500.00, "formulary":"B","partner_id":"p04"},
    {"id":"d12","name":"Lisinopril 5mg",             "generic_name":"Lisinopril",          "brand_name":None,           "category":"Antihypertensive",   "form":"Tablet",   "strength":"5mg",         "stock_level":560,"unit":"tablets",  "reorder_level":100,"price_ngn":650.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d13","name":"Lisinopril 10mg",            "generic_name":"Lisinopril",          "brand_name":None,           "category":"Antihypertensive",   "form":"Tablet",   "strength":"10mg",        "stock_level":640,"unit":"tablets",  "reorder_level":100,"price_ngn":850.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d14","name":"Losartan 50mg",              "generic_name":"Losartan",            "brand_name":None,           "category":"Antihypertensive",   "form":"Tablet",   "strength":"50mg",        "stock_level":310,"unit":"tablets",  "reorder_level": 60,"price_ngn":1200.00, "formulary":"A","partner_id":"p02"},
    {"id":"d15","name":"Hydrochlorothiazide 25mg",   "generic_name":"Hydrochlorothiazide", "brand_name":None,           "category":"Antihypertensive",   "form":"Tablet",   "strength":"25mg",        "stock_level":890,"unit":"tablets",  "reorder_level":150,"price_ngn":350.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d16","name":"Atenolol 50mg",              "generic_name":"Atenolol",            "brand_name":None,           "category":"Antihypertensive",   "form":"Tablet",   "strength":"50mg",        "stock_level":740,"unit":"tablets",  "reorder_level":120,"price_ngn":450.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d17","name":"Carvedilol 12.5mg",          "generic_name":"Carvedilol",          "brand_name":None,           "category":"Antihypertensive",   "form":"Tablet",   "strength":"12.5mg",      "stock_level":220,"unit":"tablets",  "reorder_level": 50,"price_ngn":1400.00, "formulary":"A","partner_id":"p03"},
    {"id":"d18","name":"Methyldopa 250mg",           "generic_name":"Methyldopa",          "brand_name":None,           "category":"Antihypertensive",   "form":"Tablet",   "strength":"250mg",       "stock_level":180,"unit":"tablets",  "reorder_level": 40,"price_ngn":550.00,  "formulary":"B","partner_id":"p05"},
    # ── Anticonvulsant ───────────────────────────────────────────────────
    {"id":"d19","name":"Carbamazepine 200mg",        "generic_name":"Carbamazepine",       "brand_name":None,           "category":"Anticonvulsant",     "form":"Tablet",   "strength":"200mg",       "stock_level":460,"unit":"tablets",  "reorder_level": 80,"price_ngn":280.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d20","name":"Sodium Valproate 200mg",     "generic_name":"Valproic Acid",       "brand_name":None,           "category":"Anticonvulsant",     "form":"Tablet",   "strength":"200mg",       "stock_level":380,"unit":"tablets",  "reorder_level": 70,"price_ngn":350.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d21","name":"Sodium Valproate 500mg",     "generic_name":"Valproic Acid",       "brand_name":None,           "category":"Anticonvulsant",     "form":"Tablet",   "strength":"500mg",       "stock_level":240,"unit":"tablets",  "reorder_level": 50,"price_ngn":600.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d22","name":"Phenobarbitone 30mg",        "generic_name":"Phenobarbital",       "brand_name":None,           "category":"Anticonvulsant",     "form":"Tablet",   "strength":"30mg",        "stock_level":620,"unit":"tablets",  "reorder_level":100,"price_ngn":120.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d23","name":"Levetiracetam 500mg",        "generic_name":"Levetiracetam",       "brand_name":None,           "category":"Anticonvulsant",     "form":"Tablet",   "strength":"500mg",       "stock_level":190,"unit":"tablets",  "reorder_level": 40,"price_ngn":1800.00, "formulary":"A","partner_id":"p03"},
    {"id":"d24","name":"Lamotrigine 50mg",           "generic_name":"Lamotrigine",         "brand_name":None,           "category":"Anticonvulsant",     "form":"Tablet",   "strength":"50mg",        "stock_level":140,"unit":"tablets",  "reorder_level": 30,"price_ngn":2200.00, "formulary":"B","partner_id":"p04"},
    # ── Sickle Cell ──────────────────────────────────────────────────────
    {"id":"d25","name":"Hydroxyurea 500mg",          "generic_name":"Hydroxyurea",         "brand_name":None,           "category":"Sickle Cell",        "form":"Capsule",  "strength":"500mg",       "stock_level":210,"unit":"capsules", "reorder_level": 40,"price_ngn":2400.00, "formulary":"A","partner_id":"p03"},
    {"id":"d26","name":"Folic Acid 5mg",             "generic_name":"Folic Acid",          "brand_name":None,           "category":"Sickle Cell",        "form":"Tablet",   "strength":"5mg",         "stock_level":1200,"unit":"tablets", "reorder_level":200,"price_ngn":80.00,   "formulary":"A","partner_id":"p01"},
    {"id":"d27","name":"Penicillin V 250mg",         "generic_name":"Phenoxymethylpenicillin","brand_name":None,        "category":"Sickle Cell",        "form":"Tablet",   "strength":"250mg",       "stock_level":680,"unit":"tablets",  "reorder_level":100,"price_ngn":150.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d28","name":"Proguanil 100mg",            "generic_name":"Proguanil",           "brand_name":None,           "category":"Sickle Cell",        "form":"Tablet",   "strength":"100mg",       "stock_level":390,"unit":"tablets",  "reorder_level": 70,"price_ngn":280.00,  "formulary":"A","partner_id":"p02"},
    # ── Hepatitis B ──────────────────────────────────────────────────────
    {"id":"d29","name":"Tenofovir DF 300mg",         "generic_name":"Tenofovir Disoproxil","brand_name":None,           "category":"Hepatitis B",        "form":"Tablet",   "strength":"300mg",       "stock_level":280,"unit":"tablets",  "reorder_level": 50,"price_ngn":2800.00, "formulary":"A","partner_id":"p03"},
    {"id":"d30","name":"Entecavir 0.5mg",            "generic_name":"Entecavir",           "brand_name":None,           "category":"Hepatitis B",        "form":"Tablet",   "strength":"0.5mg",       "stock_level":150,"unit":"tablets",  "reorder_level": 30,"price_ngn":4500.00, "formulary":"A","partner_id":"p03"},
    {"id":"d31","name":"Lamivudine 100mg",           "generic_name":"Lamivudine",          "brand_name":None,           "category":"Hepatitis B",        "form":"Tablet",   "strength":"100mg",       "stock_level":220,"unit":"tablets",  "reorder_level": 40,"price_ngn":1200.00, "formulary":"B","partner_id":"p04"},
    # ── Ophthalmology ────────────────────────────────────────────────────
    {"id":"d32","name":"Timolol Eye Drops 0.5%",     "generic_name":"Timolol",             "brand_name":None,           "category":"Ophthalmology",      "form":"Eye Drops","strength":"0.5% 5mL",    "stock_level":180,"unit":"bottles",  "reorder_level": 30,"price_ngn":3500.00, "formulary":"A","partner_id":"p05"},
    {"id":"d33","name":"Latanoprost 0.005% Eye Drops","generic_name":"Latanoprost",        "brand_name":None,           "category":"Ophthalmology",      "form":"Eye Drops","strength":"0.005% 2.5mL","stock_level": 95,"unit":"bottles",  "reorder_level": 20,"price_ngn":8500.00, "formulary":"A","partner_id":"p05"},
    {"id":"d34","name":"Dorzolamide 2% Eye Drops",   "generic_name":"Dorzolamide",         "brand_name":None,           "category":"Ophthalmology",      "form":"Eye Drops","strength":"2% 5mL",      "stock_level":110,"unit":"bottles",  "reorder_level": 20,"price_ngn":6800.00, "formulary":"A","partner_id":"p05"},
    {"id":"d35","name":"Dexamethasone 0.1% Eye Drops","generic_name":"Dexamethasone Eye",  "brand_name":None,           "category":"Ophthalmology",      "form":"Eye Drops","strength":"0.1% 5mL",    "stock_level":210,"unit":"bottles",  "reorder_level": 30,"price_ngn":2200.00, "formulary":"A","partner_id":"p05"},
    {"id":"d36","name":"Brimonidine 0.2% Eye Drops", "generic_name":"Brimonidine",         "brand_name":None,           "category":"Ophthalmology",      "form":"Eye Drops","strength":"0.2% 5mL",    "stock_level": 80,"unit":"bottles",  "reorder_level": 15,"price_ngn":5500.00, "formulary":"B","partner_id":"p06"},
    {"id":"d37","name":"Artificial Tears 10mL",      "generic_name":"Sodium Hyaluronate",  "brand_name":None,           "category":"Ophthalmology",      "form":"Eye Drops","strength":"0.1% 10mL",   "stock_level":320,"unit":"bottles",  "reorder_level": 50,"price_ngn":1500.00, "formulary":"A","partner_id":"p05"},
    # ── Musculoskeletal ──────────────────────────────────────────────────
    {"id":"d38","name":"Diclofenac 50mg",            "generic_name":"Diclofenac",          "brand_name":None,           "category":"Musculoskeletal",    "form":"Tablet",   "strength":"50mg",        "stock_level":760,"unit":"tablets",  "reorder_level":120,"price_ngn":250.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d39","name":"Meloxicam 15mg",             "generic_name":"Meloxicam",           "brand_name":None,           "category":"Musculoskeletal",    "form":"Tablet",   "strength":"15mg",        "stock_level":430,"unit":"tablets",  "reorder_level": 80,"price_ngn":850.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d40","name":"Methocarbamol 500mg",        "generic_name":"Methocarbamol",       "brand_name":None,           "category":"Musculoskeletal",    "form":"Tablet",   "strength":"500mg",       "stock_level":350,"unit":"tablets",  "reorder_level": 70,"price_ngn":420.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d41","name":"Celecoxib 200mg",            "generic_name":"Celecoxib",           "brand_name":None,           "category":"Musculoskeletal",    "form":"Capsule",  "strength":"200mg",       "stock_level":210,"unit":"capsules", "reorder_level": 40,"price_ngn":1400.00, "formulary":"A","partner_id":"p03"},
    {"id":"d42","name":"Baclofen 10mg",              "generic_name":"Baclofen",            "brand_name":None,           "category":"Musculoskeletal",    "form":"Tablet",   "strength":"10mg",        "stock_level":280,"unit":"tablets",  "reorder_level": 50,"price_ngn":650.00,  "formulary":"A","partner_id":"p03"},
    {"id":"d43","name":"Tramadol 50mg",              "generic_name":"Tramadol",            "brand_name":None,           "category":"Musculoskeletal",    "form":"Capsule",  "strength":"50mg",        "stock_level":340,"unit":"capsules", "reorder_level": 60,"price_ngn":380.00,  "formulary":"A","partner_id":"p02"},
    # ── Corticosteroid ───────────────────────────────────────────────────
    {"id":"d44","name":"Prednisolone 5mg",           "generic_name":"Prednisolone",        "brand_name":None,           "category":"Corticosteroid",     "form":"Tablet",   "strength":"5mg",         "stock_level":520,"unit":"tablets",  "reorder_level": 80,"price_ngn":180.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d45","name":"Prednisolone 10mg",          "generic_name":"Prednisolone",        "brand_name":None,           "category":"Corticosteroid",     "form":"Tablet",   "strength":"10mg",        "stock_level":390,"unit":"tablets",  "reorder_level": 60,"price_ngn":280.00,  "formulary":"A","partner_id":"p01"},
    # ── Autoimmune ───────────────────────────────────────────────────────
    {"id":"d46","name":"Hydroxychloroquine 200mg",   "generic_name":"Hydroxychloroquine",  "brand_name":None,           "category":"Autoimmune",         "form":"Tablet",   "strength":"200mg",       "stock_level":240,"unit":"tablets",  "reorder_level": 40,"price_ngn":3200.00, "formulary":"A","partner_id":"p03"},
    {"id":"d47","name":"Methotrexate 2.5mg",         "generic_name":"Methotrexate",        "brand_name":None,           "category":"Autoimmune",         "form":"Tablet",   "strength":"2.5mg",       "stock_level":180,"unit":"tablets",  "reorder_level": 30,"price_ngn":950.00,  "formulary":"A","partner_id":"p03"},
    {"id":"d48","name":"Azathioprine 50mg",          "generic_name":"Azathioprine",        "brand_name":None,           "category":"Autoimmune",         "form":"Tablet",   "strength":"50mg",        "stock_level":110,"unit":"tablets",  "reorder_level": 25,"price_ngn":2800.00, "formulary":"A","partner_id":"p04"},
    {"id":"d49","name":"Sulfasalazine 500mg",        "generic_name":"Sulfasalazine",       "brand_name":None,           "category":"Autoimmune",         "form":"Tablet",   "strength":"500mg",       "stock_level":260,"unit":"tablets",  "reorder_level": 50,"price_ngn":1100.00, "formulary":"B","partner_id":"p05"},
    {"id":"d50","name":"Mycophenolate Mofetil 500mg","generic_name":"Mycophenolate",       "brand_name":None,           "category":"Autoimmune",         "form":"Tablet",   "strength":"500mg",       "stock_level": 80,"unit":"tablets",  "reorder_level": 20,"price_ngn":5500.00, "formulary":"B","partner_id":"p06"},
    # ── Chronic Kidney Disease ───────────────────────────────────────────
    {"id":"d51","name":"Erythropoietin 4000IU inj",  "generic_name":"Erythropoietin",      "brand_name":None,           "category":"CKD",                "form":"Injection","strength":"4000IU",      "stock_level": 60,"unit":"vials",    "reorder_level": 15,"price_ngn":18500.00,"formulary":"A","partner_id":"p03"},
    {"id":"d52","name":"Calcium Carbonate 500mg",    "generic_name":"Calcium Carbonate",   "brand_name":None,           "category":"CKD",                "form":"Tablet",   "strength":"500mg",       "stock_level":840,"unit":"tablets",  "reorder_level":120,"price_ngn":280.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d53","name":"Ferrous Sulphate 200mg",     "generic_name":"Ferrous Sulphate",    "brand_name":None,           "category":"CKD",                "form":"Tablet",   "strength":"200mg",       "stock_level":920,"unit":"tablets",  "reorder_level":150,"price_ngn":180.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d54","name":"Furosemide 40mg",            "generic_name":"Furosemide",          "brand_name":None,           "category":"CKD",                "form":"Tablet",   "strength":"40mg",        "stock_level":680,"unit":"tablets",  "reorder_level":100,"price_ngn":220.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d55","name":"Cinacalcet 30mg",            "generic_name":"Cinacalcet",          "brand_name":None,           "category":"CKD",                "form":"Tablet",   "strength":"30mg",        "stock_level": 45,"unit":"tablets",  "reorder_level": 10,"price_ngn":12000.00,"formulary":"B","partner_id":"p06"},
    # ── Respiratory ──────────────────────────────────────────────────────
    {"id":"d56","name":"Salbutamol Inhaler 100mcg",      "generic_name":"Salbutamol",       "brand_name":None,       "category":"Respiratory",        "form":"Inhaler",  "strength":"100mcg",      "stock_level":320,"unit":"inhalers", "reorder_level": 50,"price_ngn":3500.00, "formulary":"A","partner_id":"p05"},
    {"id":"d57","name":"Beclomethasone Inhaler 200mcg",  "generic_name":"Beclomethasone",   "brand_name":None,       "category":"Respiratory",        "form":"Inhaler",  "strength":"200mcg",      "stock_level":180,"unit":"inhalers", "reorder_level": 30,"price_ngn":8500.00, "formulary":"A","partner_id":"p05"},
    {"id":"d58","name":"Ipratropium Bromide Inhaler",    "generic_name":"Ipratropium",      "brand_name":None,       "category":"Respiratory",        "form":"Inhaler",  "strength":"20mcg",       "stock_level":120,"unit":"inhalers", "reorder_level": 25,"price_ngn":6200.00, "formulary":"A","partner_id":"p05"},
    {"id":"d59","name":"Aminophylline 100mg",            "generic_name":"Theophylline",     "brand_name":None,       "category":"Respiratory",        "form":"Tablet",   "strength":"100mg",       "stock_level":450,"unit":"tablets",  "reorder_level": 70,"price_ngn":320.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d60","name":"Montelukast 10mg",               "generic_name":"Montelukast",      "brand_name":None,       "category":"Respiratory",        "form":"Tablet",   "strength":"10mg",        "stock_level":360,"unit":"tablets",  "reorder_level": 60,"price_ngn":1500.00, "formulary":"A","partner_id":"p02"},
    {"id":"d61","name":"Tiotropium Inhaler 18mcg",       "generic_name":"Tiotropium",       "brand_name":None,       "category":"Respiratory",        "form":"Inhaler",  "strength":"18mcg",       "stock_level": 55,"unit":"inhalers", "reorder_level": 12,"price_ngn":15000.00,"formulary":"B","partner_id":"p06"},
    {"id":"d62","name":"Budesonide/Formoterol 160/4.5mcg","generic_name":"Budesonide/Formoterol","brand_name":None,  "category":"Respiratory",        "form":"Inhaler",  "strength":"160/4.5mcg",  "stock_level": 40,"unit":"inhalers", "reorder_level": 10,"price_ngn":18000.00,"formulary":"B","partner_id":"p06"},
    # ── Analgesic / General ───────────────────────────────────────────────
    {"id":"d63","name":"Paracetamol 500mg",          "generic_name":"Paracetamol",         "brand_name":None,           "category":"Analgesic",          "form":"Tablet",   "strength":"500mg",       "stock_level":1500,"unit":"tablets", "reorder_level":250,"price_ngn":120.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d64","name":"Ibuprofen 400mg",            "generic_name":"Ibuprofen",           "brand_name":None,           "category":"Analgesic",          "form":"Tablet",   "strength":"400mg",       "stock_level":860,"unit":"tablets",  "reorder_level":150,"price_ngn":220.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d65","name":"Codeine 30mg",               "generic_name":"Codeine",             "brand_name":None,           "category":"Analgesic",          "form":"Tablet",   "strength":"30mg",        "stock_level":290,"unit":"tablets",  "reorder_level": 60,"price_ngn":450.00,  "formulary":"B","partner_id":"p03"},
    {"id":"d66","name":"Tramadol 100mg",             "generic_name":"Tramadol",            "brand_name":None,           "category":"Analgesic",          "form":"Capsule",  "strength":"100mg",       "stock_level":190,"unit":"capsules", "reorder_level": 40,"price_ngn":680.00,  "formulary":"B","partner_id":"p03"},
    # ── GI / Gastric ─────────────────────────────────────────────────────
    {"id":"d67","name":"Omeprazole 20mg",            "generic_name":"Omeprazole",          "brand_name":None,           "category":"GI",                 "form":"Capsule",  "strength":"20mg",        "stock_level":740,"unit":"capsules", "reorder_level":120,"price_ngn":280.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d68","name":"Omeprazole 40mg",            "generic_name":"Omeprazole",          "brand_name":None,           "category":"GI",                 "form":"Capsule",  "strength":"40mg",        "stock_level":480,"unit":"capsules", "reorder_level": 80,"price_ngn":450.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d69","name":"Domperidone 10mg",           "generic_name":"Domperidone",         "brand_name":None,           "category":"GI",                 "form":"Tablet",   "strength":"10mg",        "stock_level":560,"unit":"tablets",  "reorder_level": 90,"price_ngn":220.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d70","name":"Metoclopramide 10mg",        "generic_name":"Metoclopramide",      "brand_name":None,           "category":"GI",                 "form":"Tablet",   "strength":"10mg",        "stock_level":490,"unit":"tablets",  "reorder_level": 80,"price_ngn":180.00,  "formulary":"A","partner_id":"p02"},
    # ── Vitamins / Supplements ───────────────────────────────────────────
    {"id":"d71","name":"Vitamin B Complex",          "generic_name":"Vitamin B Complex",   "brand_name":None,           "category":"Supplement",         "form":"Tablet",   "strength":"Standard",    "stock_level":640,"unit":"tablets",  "reorder_level":100,"price_ngn":350.00,  "formulary":"A","partner_id":"p01"},
    {"id":"d72","name":"Neurovit Forte",             "generic_name":"Vitamin B Complex",   "brand_name":"Neurovit",     "category":"Supplement",         "form":"Capsule",  "strength":"Forte",       "stock_level":310,"unit":"capsules", "reorder_level": 50,"price_ngn":850.00,  "formulary":"B","partner_id":"p04"},
    {"id":"d73","name":"Calcium + Vit D3 500mg/400IU","generic_name":"Calcium Carbonate",  "brand_name":None,           "category":"Supplement",         "form":"Tablet",   "strength":"500mg/400IU", "stock_level":520,"unit":"tablets",  "reorder_level": 80,"price_ngn":650.00,  "formulary":"A","partner_id":"p02"},
    {"id":"d74","name":"Zinc Sulphate 20mg",         "generic_name":"Zinc Sulphate",       "brand_name":None,           "category":"Supplement",         "form":"Tablet",   "strength":"20mg",        "stock_level":380,"unit":"tablets",  "reorder_level": 60,"price_ngn":280.00,  "formulary":"A","partner_id":"p02"},
]

# ---------------------------------------------------------------------------
# PARTNERS (12) — real Nigerian health facility names
# ---------------------------------------------------------------------------
PARTNERS = [
    {"id":"p01","name":"MedPlus Pharmacy Ikeja",           "type":"Pharmacy",          "region":"Lagos",         "contact":"medplus.ikeja@health.ng",       "active":True, "claims_this_month": 48},
    {"id":"p02","name":"HealthPlus Pharmacy VI",           "type":"Pharmacy",          "region":"Lagos",         "contact":"healthplus.vi@health.ng",        "active":True, "claims_this_month": 62},
    {"id":"p03","name":"Reddington Hospital",              "type":"Hospital",          "region":"Lagos",         "contact":"reddington@reddington.ng",       "active":True, "claims_this_month": 91},
    {"id":"p04","name":"Eko Hospital",                     "type":"Hospital",          "region":"Lagos",         "contact":"info@ekohospitals.com",          "active":True, "claims_this_month": 74},
    {"id":"p05","name":"Lagoon Hospital Apapa",            "type":"Hospital",          "region":"Lagos",         "contact":"apapa@lagoonhospitals.com",      "active":True, "claims_this_month": 55},
    {"id":"p06","name":"BetaCare Pharmacy Wuse",           "type":"Pharmacy",          "region":"Abuja",         "contact":"betacare.wuse@health.ng",        "active":True, "claims_this_month": 39},
    {"id":"p07","name":"National Hospital Abuja",          "type":"Hospital",          "region":"Abuja",         "contact":"nhq@nationalhospital.gov.ng",    "active":True, "claims_this_month": 83},
    {"id":"p08","name":"Garki Hospital",                   "type":"Clinic",            "region":"Abuja",         "contact":"garki@garkihospital.ng",         "active":True, "claims_this_month": 47},
    {"id":"p09","name":"St. Gerard's Hospital Kano",       "type":"Hospital",          "region":"Kano",          "contact":"stgerards@stgerards.ng",         "active":True, "claims_this_month": 36},
    {"id":"p10","name":"UPTH Pharmacy",                    "type":"Hospital",          "region":"Port Harcourt", "contact":"pharmacy@upth.gov.ng",           "active":True, "claims_this_month": 29},
    {"id":"p11","name":"UCH Pharmacy Ibadan",              "type":"Hospital",          "region":"Ibadan",        "contact":"pharmacy@uch.ui.edu.ng",         "active":False,"claims_this_month":  0},
    {"id":"p12","name":"ESUT Teaching Hospital Enugu",     "type":"Hospital",          "region":"Enugu",         "contact":"pharmacy@esutth.ng",             "active":True, "claims_this_month": 21},
]

# ---------------------------------------------------------------------------
# CLAIMS (60)
# ---------------------------------------------------------------------------
_claim_statuses = ["Approved", "Pending", "Rejected", "Under Review"]
_claim_drugs = [
    "Metformin 500mg","Amlodipine 5mg","Hydroxyurea 500mg","Tenofovir DF 300mg",
    "Carbamazepine 200mg","Timolol Eye Drops 0.5%","Diclofenac 50mg",
    "Hydroxychloroquine 200mg","Erythropoietin 4000IU inj","Salbutamol Inhaler 100mcg",
    "Lisinopril 10mg","Insulin NPH 100IU/mL","Folic Acid 5mg","Prednisolone 5mg",
    "Omeprazole 20mg","Glibenclamide 5mg","Furosemide 40mg","Montelukast 10mg",
    "Entecavir 0.5mg","Sodium Valproate 200mg","Atenolol 50mg","Meloxicam 15mg",
    "Penicillin V 250mg","Methotrexate 2.5mg","Calcium Carbonate 500mg",
    "Beclomethasone Inhaler 200mcg","Hydrochlorothiazide 25mg","Latanoprost 0.005% Eye Drops",
    "Ferrous Sulphate 200mg","Phenobarbitone 30mg",
]

CLAIMS = [
    {
        "id":            f"c{i:03d}",
        "enrollee_id":   f"2100{i:04d}/0",
        "enrollee_name": f"{_names_60[(i-1) % 60][0]} {_names_60[(i-1) % 60][1]}",
        "partner_id":    f"p{(i % 12) + 1:02d}",
        "amount_ngn":    round(((i * 3750) % 85000) + 1500, 2),
        "status":        _claim_statuses[(i - 1) % len(_claim_statuses)],
        "drug":          _claim_drugs[(i - 1) % len(_claim_drugs)],
        "date":          f"2026-{((i - 1) % 4) + 1:02d}-{(i % 28) + 1:02d}",
        "scheme":        _schemes[(i - 1) % len(_schemes)],
    }
    for i in range(1, 61)
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
        "policy_no": "21000001/0",
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
    {"id":"mr02","enrollee_name":"Babajide Ogunleye","policy_no":"21000002/0","region":"Lagos",
     "request_type":"medication_change","medication_subtype":"new_medication",
     "member_note":"Insulin NPH added by endocrinologist following HbA1c of 10.2%. Requesting plan coverage.",
     "urgency":"High","status":"Pending","submitted_at":"2026-04-19T10:30:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":"Insulin NPH 100IU/mL","current_dosage":None,"requested_dosage":"10 units nocte","current_frequency":None,"requested_frequency":"Once nightly"},
    {"id":"mr03","enrollee_name":"Halima Musa","policy_no":"21000003/0","region":"Kano",
     "request_type":"address_change","medication_subtype":None,
     "member_note":"Relocated from Kano to Abuja. New delivery address: 14 Garki Estate, Abuja.",
     "urgency":"Low","status":"Pending","submitted_at":"2026-04-20T08:15:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":None,"current_dosage":None,"requested_dosage":None,"current_frequency":None,"requested_frequency":None},
    {"id":"mr04","enrollee_name":"Emeka Eze","policy_no":"21000004/0","region":"Enugu",
     "request_type":"new_enrollment","medication_subtype":None,
     "member_note":"Individual plan. Hypertension — on Amlodipine. Requests Chronic Lagos delivery.",
     "urgency":"Medium","status":"Pending","submitted_at":"2026-04-20T11:45:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":None,"current_dosage":None,"requested_dosage":None,"current_frequency":None,"requested_frequency":None},
    {"id":"mr05","enrollee_name":"Adeola Ogunyemi","policy_no":"21000005/0","region":"Lagos",
     "request_type":"medication_change","medication_subtype":"dosage_change",
     "member_note":"Dr Adewale prescribing Amlodipine 10mg instead of 5mg. Specialist letter attached.",
     "urgency":"High","status":"Pending","submitted_at":"2026-04-21T14:00:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":"Amlodipine","requested_drug":"Amlodipine","current_dosage":"5mg","requested_dosage":"10mg","current_frequency":"Once daily","requested_frequency":"Once daily"},
    {"id":"mr06","enrollee_name":"Ngozi Okafor","policy_no":"21000006/0","region":"Lagos",
     "request_type":"medication_change","medication_subtype":"drug_stoppage",
     "member_note":"Metformin causing severe GI side effects. Doctor advised temporary stop pending renal review.",
     "urgency":"High","status":"Approved","submitted_at":"2026-04-15T09:00:00",
     "decided_at":"2026-04-15T16:30:00","decided_by":"pharm@leadway.com",
     "decision_note":"Approved. Member counselled; diet management until specialist review.",
     "current_drug":"Metformin 500mg","requested_drug":None,"current_dosage":"500mg BD","requested_dosage":None,"current_frequency":"Twice daily","requested_frequency":None},
    {"id":"mr07","enrollee_name":"Tunde Adeyemi","policy_no":"21000007/0","region":"Abuja",
     "request_type":"plan_upgrade","medication_subtype":None,
     "member_note":"Company revised group scheme from Pro to Promax. HR letter attached.",
     "urgency":"Low","status":"Approved","submitted_at":"2026-04-10T10:00:00",
     "decided_at":"2026-04-11T09:00:00","decided_by":"ops@leadway.com",
     "decision_note":"Verified with HR. Plan upgraded to Promax effective 1 May 2026.",
     "current_drug":None,"requested_drug":None,"current_dosage":None,"requested_dosage":None,"current_frequency":None,"requested_frequency":None},
    {"id":"mr08","enrollee_name":"Fatima Bello","policy_no":"21000008/0","region":"Kano",
     "request_type":"medication_change","medication_subtype":"brand_change",
     "member_note":"Requesting Glucophage brand over generic Metformin — better GI tolerance reported.",
     "urgency":"Low","status":"Rejected","submitted_at":"2026-04-12T13:00:00",
     "decided_at":"2026-04-13T11:00:00","decided_by":"pharm@leadway.com",
     "decision_note":"Rejected. MRcare 1 formulary covers generic only. Member to discuss with physician.",
     "current_drug":"Metformin 500mg","requested_drug":"Glucophage 500mg","current_dosage":"500mg","requested_dosage":"500mg","current_frequency":"Twice daily","requested_frequency":"Twice daily"},
    {"id":"mr09","enrollee_name":"Chidi Nwosu","policy_no":"21000009/0","region":"Port Harcourt",
     "request_type":"medication_change","medication_subtype":"frequency_change",
     "member_note":"Cardiologist changed Lisinopril to twice daily for better BP control. Letter attached.",
     "urgency":"Medium","status":"Pending","submitted_at":"2026-04-22T08:45:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":"Lisinopril 10mg","requested_drug":"Lisinopril 10mg","current_dosage":"10mg","requested_dosage":"10mg","current_frequency":"Once daily","requested_frequency":"Twice daily"},
    {"id":"mr10","enrollee_name":"Amina Sule","policy_no":"21000010/0","region":"Abuja",
     "request_type":"medication_change","medication_subtype":"new_medication",
     "member_note":"Neurologist added Carbamazepine 200mg for newly diagnosed seizure disorder. Clinic letter attached.",
     "urgency":"High","status":"Pending","submitted_at":"2026-04-23T07:30:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":"Carbamazepine 200mg","current_dosage":None,"requested_dosage":"200mg BD","current_frequency":None,"requested_frequency":"Twice daily"},
    {"id":"mr11","enrollee_name":"Segun Adesanya","policy_no":"21000011/0","region":"Lagos",
     "request_type":"medication_change","medication_subtype":"drug_stoppage",
     "member_note":"Hydroxychloroquine causing visual disturbance. Rheumatologist advising cessation.",
     "urgency":"High","status":"Pending","submitted_at":"2026-04-23T09:00:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":"Hydroxychloroquine 200mg","requested_drug":None,"current_dosage":"200mg BD","requested_dosage":None,"current_frequency":"Twice daily","requested_frequency":None},
    {"id":"mr12","enrollee_name":"Blessing Chukwu","policy_no":"21000012/0","region":"Abuja",
     "request_type":"new_enrollment","medication_subtype":None,
     "member_note":"New hire at Stanbic IBTC. Requesting Senior Cranberry plan. Has Sickle Cell Disease.",
     "urgency":"High","status":"Pending","submitted_at":"2026-04-23T10:15:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":None,"current_dosage":None,"requested_dosage":None,"current_frequency":None,"requested_frequency":None},
    {"id":"mr13","enrollee_name":"Ibrahim Garba","policy_no":"21000013/0","region":"Kano",
     "request_type":"medication_change","medication_subtype":"new_medication",
     "member_note":"Ophthalmologist added Latanoprost drops for newly diagnosed open-angle glaucoma.",
     "urgency":"Medium","status":"Approved","submitted_at":"2026-04-08T14:00:00",
     "decided_at":"2026-04-09T10:30:00","decided_by":"pharm@leadway.com",
     "decision_note":"Approved. Latanoprost added to chronic refill plan.",
     "current_drug":None,"requested_drug":"Latanoprost 0.005% Eye Drops","current_dosage":None,"requested_dosage":"1 drop ON","current_frequency":None,"requested_frequency":"Once nightly"},
    {"id":"mr14","enrollee_name":"Yetunde Olawale","policy_no":"21000014/0","region":"Ibadan",
     "request_type":"medication_change","medication_subtype":"dosage_change",
     "member_note":"Haematologist increasing Hydroxyurea to 1000mg OD for better HbF response.",
     "urgency":"Medium","status":"Pending","submitted_at":"2026-04-24T08:00:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":"Hydroxyurea 500mg","requested_drug":"Hydroxyurea 1000mg","current_dosage":"500mg","requested_dosage":"1000mg","current_frequency":"Once daily","requested_frequency":"Once daily"},
    {"id":"mr15","enrollee_name":"Obinna Onyekachi","policy_no":"21000015/0","region":"Port Harcourt",
     "request_type":"medication_change","medication_subtype":"brand_change",
     "member_note":"Requesting Norvasc (brand Amlodipine) — consistent supply at local pharmacy.",
     "urgency":"Low","status":"Pending","submitted_at":"2026-04-24T11:30:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":"Amlodipine 5mg","requested_drug":"Norvasc 5mg","current_dosage":"5mg","requested_dosage":"5mg","current_frequency":"Once daily","requested_frequency":"Once daily"},
    {"id":"mr16","enrollee_name":"Zainab Aliyu","policy_no":"21000016/0","region":"Kano",
     "request_type":"address_change","medication_subtype":None,
     "member_note":"Moved to Kaduna. New address: Block 5, Barnawa GRA, Kaduna.",
     "urgency":"Low","status":"Approved","submitted_at":"2026-04-05T09:00:00",
     "decided_at":"2026-04-06T14:00:00","decided_by":"ops@leadway.com",
     "decision_note":"Address updated. Rider assignment reassigned to Kaduna route.",
     "current_drug":None,"requested_drug":None,"current_dosage":None,"requested_dosage":None,"current_frequency":None,"requested_frequency":None},
    {"id":"mr17","enrollee_name":"Rotimi Akintunde","policy_no":"21000017/0","region":"Lagos",
     "request_type":"medication_change","medication_subtype":"new_medication",
     "member_note":"Nephrologist prescribed Erythropoietin 4000IU injections for CKD anaemia.",
     "urgency":"High","status":"Pending","submitted_at":"2026-04-25T07:00:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":"Erythropoietin 4000IU inj","current_dosage":None,"requested_dosage":"4000IU SC","current_frequency":None,"requested_frequency":"Twice weekly"},
    {"id":"mr18","enrollee_name":"Adaeze Okonkwo","policy_no":"21000018/0","region":"Enugu",
     "request_type":"plan_upgrade","medication_subtype":None,
     "member_note":"Employer upgrading group from Plus to Max. Attached board resolution.",
     "urgency":"Low","status":"Pending","submitted_at":"2026-04-25T10:00:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":None,"current_dosage":None,"requested_dosage":None,"current_frequency":None,"requested_frequency":None},
    {"id":"mr19","enrollee_name":"Musa Abdullahi","policy_no":"21000019/0","region":"Kano",
     "request_type":"medication_change","medication_subtype":"frequency_change",
     "member_note":"Cardiologist adjusted Atenolol to twice daily after stress ECG.",
     "urgency":"Medium","status":"Rejected","submitted_at":"2026-04-14T13:00:00",
     "decided_at":"2026-04-15T09:00:00","decided_by":"pharm@leadway.com",
     "decision_note":"Rejected — documentation insufficient. Please resubmit with cardiology clinic letter.",
     "current_drug":"Atenolol 50mg","requested_drug":"Atenolol 50mg","current_dosage":"50mg","requested_dosage":"50mg","current_frequency":"Once daily","requested_frequency":"Twice daily"},
    {"id":"mr20","enrollee_name":"Bukola Fashola","policy_no":"21000020/0","region":"Lagos",
     "request_type":"medication_change","medication_subtype":"new_medication",
     "member_note":"Rheumatologist adding Sulfasalazine 500mg for RA — not currently on formulary list.",
     "urgency":"Medium","status":"Pending","submitted_at":"2026-04-26T09:30:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":"Sulfasalazine 500mg","current_dosage":None,"requested_dosage":"500mg BD","current_frequency":None,"requested_frequency":"Twice daily"},
    {"id":"mr21","enrollee_name":"Chinedu Nwachukwu","policy_no":"21000021/0","region":"Abuja",
     "request_type":"medication_change","medication_subtype":"drug_stoppage",
     "member_note":"Sodium Valproate causing weight gain and hair loss. Neurologist agreeing to switch.",
     "urgency":"Medium","status":"Pending","submitted_at":"2026-04-26T11:00:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":"Sodium Valproate 200mg","requested_drug":None,"current_dosage":"200mg BD","requested_dosage":None,"current_frequency":"Twice daily","requested_frequency":None},
    {"id":"mr22","enrollee_name":"Khadija Usman","policy_no":"21000022/0","region":"Kano",
     "request_type":"medication_change","medication_subtype":"dosage_change",
     "member_note":"Hepatologist increasing Tenofovir — viral load not suppressed at current dose.",
     "urgency":"High","status":"Pending","submitted_at":"2026-04-26T14:30:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":"Tenofovir DF 300mg","requested_drug":"Tenofovir DF 300mg","current_dosage":"300mg OD","requested_dosage":"300mg BD","current_frequency":"Once daily","requested_frequency":"Twice daily"},
    {"id":"mr23","enrollee_name":"Femi Adesina","policy_no":"21000023/0","region":"Lagos",
     "request_type":"new_enrollment","medication_subtype":None,
     "member_note":"New corporate enrollee — AXA Mansard Magnum plan. Diabetic on Metformin and Insulin.",
     "urgency":"Medium","status":"Pending","submitted_at":"2026-04-27T08:00:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":None,"current_dosage":None,"requested_dosage":None,"current_frequency":None,"requested_frequency":None},
    {"id":"mr24","enrollee_name":"Ifeoma Nduka","policy_no":"21000024/0","region":"Enugu",
     "request_type":"medication_change","medication_subtype":"brand_change",
     "member_note":"Requesting Losartan brand Cozaar — local pharmacy unable to source generic.",
     "urgency":"Low","status":"Pending","submitted_at":"2026-04-27T09:15:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":"Losartan 50mg","requested_drug":"Cozaar 50mg","current_dosage":"50mg","requested_dosage":"50mg","current_frequency":"Once daily","requested_frequency":"Once daily"},
    {"id":"mr25","enrollee_name":"Yusuf Abubakar","policy_no":"21000025/0","region":"Kano",
     "request_type":"medication_change","medication_subtype":"new_medication",
     "member_note":"Pulmonologist adding Tiotropium inhaler for COPD exacerbation management.",
     "urgency":"High","status":"Pending","submitted_at":"2026-04-27T10:45:00",
     "decided_at":None,"decided_by":None,"decision_note":None,
     "current_drug":None,"requested_drug":"Tiotropium Inhaler 18mcg","current_dosage":None,"requested_dosage":"18mcg OD","current_frequency":None,"requested_frequency":"Once daily"},
]

# ---------------------------------------------------------------------------
# NOTIFICATIONS (decision outcomes sent back to members)
# ---------------------------------------------------------------------------
NOTIFICATIONS: list[dict] = [
    {"id":"n01","policy_no":"21000006/0","request_id":"mr06","channel":"email","read":True,
     "sent_at":"2026-04-15T16:35:00",
     "message":"Your Medication Change request (drug stoppage — Metformin 500mg) has been Approved. "
               "PBM note: Member counselled; diet management until specialist review."},
    {"id":"n02","policy_no":"21000007/0","request_id":"mr07","channel":"sms","read":True,
     "sent_at":"2026-04-11T09:05:00",
     "message":"Your Plan Upgrade request has been Approved. "
               "New Promax plan effective 1 May 2026. Contact us for any questions."},
    {"id":"n03","policy_no":"21000008/0","request_id":"mr08","channel":"email","read":False,
     "sent_at":"2026-04-13T11:05:00",
     "message":"Your Medication Change request (brand change — Glucophage) has been Rejected. "
               "MRcare 1 formulary covers generic only. Please discuss with your physician."},
    {"id":"n04","policy_no":"21000013/0","request_id":"mr13","channel":"email","read":False,
     "sent_at":"2026-04-09T10:35:00",
     "message":"Your Medication Change request (new medication — Latanoprost) has been Approved. "
               "Added to your chronic refill plan from next dispatch cycle."},
    {"id":"n05","policy_no":"21000016/0","request_id":"mr16","channel":"sms","read":True,
     "sent_at":"2026-04-06T14:05:00",
     "message":"Your Address Change request has been Approved. "
               "New delivery address confirmed: Block 5, Barnawa GRA, Kaduna."},
    {"id":"n06","policy_no":"21000019/0","request_id":"mr19","channel":"email","read":False,
     "sent_at":"2026-04-15T09:05:00",
     "message":"Your Medication Change request (frequency change — Atenolol) has been Rejected. "
               "Please resubmit with your cardiologist's clinic letter attached."},
]

# ---------------------------------------------------------------------------
# SCHEME RULES (11 — one per scheme)
# ---------------------------------------------------------------------------
SCHEME_RULES = [
    {"id":"sr01","scheme":"Magnum",           "max_annual_benefit_ngn":10_000_000,"copay_percent": 0,"formulary":"A+B+C","preauth_required":False,"active":True},
    {"id":"sr02","scheme":"Promax",           "max_annual_benefit_ngn": 5_000_000,"copay_percent": 5,"formulary":"A+B",  "preauth_required":False,"active":True},
    {"id":"sr03","scheme":"Max",              "max_annual_benefit_ngn": 3_500_000,"copay_percent":10,"formulary":"A+B",  "preauth_required":False,"active":True},
    {"id":"sr04","scheme":"Pro",              "max_annual_benefit_ngn": 2_000_000,"copay_percent":15,"formulary":"A",    "preauth_required":True, "active":True},
    {"id":"sr05","scheme":"Plus",             "max_annual_benefit_ngn": 1_000_000,"copay_percent":20,"formulary":"A",    "preauth_required":True, "active":True},
    {"id":"sr06","scheme":"Senior Cranberry", "max_annual_benefit_ngn": 1_500_000,"copay_percent":10,"formulary":"A+B",  "preauth_required":True, "active":True},
    {"id":"sr07","scheme":"Senior Blueberry", "max_annual_benefit_ngn": 1_200_000,"copay_percent":15,"formulary":"A+B",  "preauth_required":True, "active":True},
    {"id":"sr08","scheme":"Senior Blackberry","max_annual_benefit_ngn":   900_000,"copay_percent":20,"formulary":"A",    "preauth_required":True, "active":True},
    {"id":"sr09","scheme":"Senior Raspberry", "max_annual_benefit_ngn":   600_000,"copay_percent":25,"formulary":"A",    "preauth_required":True, "active":True},
    {"id":"sr10","scheme":"MRcare 1",         "max_annual_benefit_ngn":   500_000,"copay_percent":30,"formulary":"B",    "preauth_required":True, "active":True},
    {"id":"sr11","scheme":"MRcare 2",         "max_annual_benefit_ngn":   300_000,"copay_percent":40,"formulary":"B",    "preauth_required":True, "active":True},
]
