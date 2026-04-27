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
# DRUGS / FORMULARY  (18 real names used across orders, claims, and enrollee meds)
# ---------------------------------------------------------------------------
DRUG_NAMES = [
    "Artemether/Lumefantrine 20/120mg",   # 0  – antimalarial (Coartem)
    "Amoxicillin 500mg",                  # 1
    "Metformin 500mg",                    # 2
    "Amlodipine 5mg",                     # 3
    "Lisinopril 10mg",                    # 4
    "Atorvastatin 20mg",                  # 5
    "Omeprazole 20mg",                    # 6
    "Metronidazole 400mg",                # 7
    "Ciprofloxacin 500mg",                # 8
    "Paracetamol 500mg",                  # 9
    "Ibuprofen 400mg",                    # 10
    "Diclofenac Sodium 50mg",             # 11
    "Co-trimoxazole 480mg",               # 12
    "Hydrochlorothiazide 25mg",           # 13
    "Losartan Potassium 50mg",            # 14
    "Prednisolone 5mg",                   # 15
    "Azithromycin 500mg",                 # 16
    "Folic Acid 5mg",                     # 17
]

_drug_categories = [
    "Antimalarial",    "Antibiotic",        "Antidiabetic",      "Antihypertensive",
    "Antihypertensive","Antilipid",         "Antacid/PPI",       "Antibiotic",
    "Antibiotic",      "Analgesic",         "NSAID",             "NSAID",
    "Antibiotic",      "Antihypertensive",  "Antihypertensive",  "Corticosteroid",
    "Antibiotic",      "Vitamin/Supplement",
]

_drug_prices = [
     850.00, 1200.00,  650.00,  980.00, 1100.00, 2400.00,  750.00,  550.00,
    1350.00,  250.00,  400.00,  380.00,  420.00,  320.00, 1050.00,  480.00,
    2100.00,  150.00,
]

_drug_stock = [
    320, 450, 280, 190, 210, 155, 390, 340,
    175, 520, 410, 240, 300, 180, 165,  95,
    220, 480,
]

DRUGS = [
    {
        "id": f"d{i+1:02d}",
        "name": DRUG_NAMES[i],
        "category": _drug_categories[i],
        "stock_level": _drug_stock[i],
        "unit": "tablets",
        "reorder_level": 50,
        "partner_id": f"p{(i % 8) + 1}",
        "price_ngn": _drug_prices[i],
    }
    for i in range(18)
]

# ---------------------------------------------------------------------------
# COHORTS  (3 employer groups; plan_code drives the member_id prefix)
# member_id format:  {plan_code}{seq:04d}/0   e.g. 21006001/0
# ---------------------------------------------------------------------------
COHORTS = [
    {
        "id": "COH-2100",
        "plan_code": "2100",
        "company": "Leadway Assurance",
        "scheme": "Executive",
        "max_annual_benefit_ngn": 1_000_000,
        "copay_percent": 10,
        "member_count": 10,
    },
    {
        "id": "COH-2101",
        "plan_code": "2101",
        "company": "AXA Mansard Insurance",
        "scheme": "Standard",
        "max_annual_benefit_ngn": 500_000,
        "copay_percent": 20,
        "member_count": 8,
    },
    {
        "id": "COH-2102",
        "plan_code": "2102",
        "company": "AIICO Insurance",
        "scheme": "Premium",
        "max_annual_benefit_ngn": 2_000_000,
        "copay_percent": 5,
        "member_count": 7,
    },
]

# ---------------------------------------------------------------------------
# ENROLLEES  (25 real Nigerian members)
# Each tuple: (name, email, phone, region, cohort_idx, seq, med_indices)
# med_indices reference DRUG_NAMES; up to 18 entries per member.
# ---------------------------------------------------------------------------
_regions  = ["Lagos", "Abuja", "Port Harcourt", "Kano", "Ibadan", "Enugu"]
_statuses = ["Active", "Suspended", "Pending", "Lapsed"]

_raw_enrollees = [
    # ── Cohort 2100 · Leadway Assurance · Executive (10 members, seq 6001-6010) ──
    ("Adaeze Okonkwo",        "adaeze.okonkwo@leadway.com",     "08031234501", "Lagos",         0, 6001, [0, 2, 3, 6, 9]),
    ("Chukwuemeka Nwachukwu", "c.nwachukwu@leadway.com",        "08061234502", "Enugu",         0, 6002, [0, 1, 7, 9, 10, 11]),
    ("Oluwaseun Adeyemi",     "seun.adeyemi@leadway.com",       "08131234503", "Lagos",         0, 6003, [3, 4, 5, 6, 9]),
    ("Babatunde Ogundimu",    "b.ogundimu@leadway.com",         "07031234504", "Ibadan",        0, 6004, [3, 4, 9, 13, 14]),
    ("Ngozi Eze",             "ngozi.eze@leadway.com",          "08021234505", "Abuja",         0, 6005, [0, 1, 8, 9]),
    ("Taiwo Fashola",         "taiwo.fashola@leadway.com",      "08051234506", "Lagos",         0, 6006, [2, 3, 5, 6, 9, 15]),
    ("Ifeoma Chukwu",         "ifeoma.chukwu@leadway.com",      "08121234507", "Port Harcourt", 0, 6007, [0, 7, 8, 9, 10]),
    ("Rotimi Akindele",       "rotimi.akindele@leadway.com",    "08071234508", "Lagos",         0, 6008, [3, 4, 5, 9, 13]),
    ("Nkechi Okafor",         "nkechi.okafor@leadway.com",      "08091234509", "Enugu",         0, 6009, [1, 2, 6, 9, 17]),
    ("Emeka Ozoemena",        "emeka.ozoemena@leadway.com",     "07061234510", "Abuja",         0, 6010,
     [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]),   # full 18-drug regimen

    # ── Cohort 2101 · AXA Mansard Insurance · Standard (8 members, seq 6001-6008) ──
    ("Fatima Usman",          "fatima.usman@axamansard.com",    "08161234511", "Kano",          1, 6001, [0, 9, 16]),
    ("Ibrahim Musa",          "ibrahim.musa@axamansard.com",    "08081234512", "Kano",          1, 6002, [3, 9, 13]),
    ("Aminu Garba",           "aminu.garba@axamansard.com",     "08151234513", "Abuja",         1, 6003, [0, 1, 8, 12]),
    ("Aisha Aliyu",           "aisha.aliyu@axamansard.com",     "07081234514", "Kano",          1, 6004, [2, 9, 17]),
    ("Khadija Bello",         "khadija.bello@axamansard.com",   "08171234515", "Abuja",         1, 6005, [0, 9, 10, 16]),
    ("Musa Abdullahi",        "musa.abdullahi@axamansard.com",  "08181234516", "Kano",          1, 6006, [3, 4, 9, 13, 14]),
    ("Zainab Sule",           "zainab.sule@axamansard.com",     "07011234517", "Lagos",         1, 6007, [0, 1, 9, 11]),
    ("Hauwa Mohammed",        "hauwa.mohammed@axamansard.com",  "08031234518", "Kano",          1, 6008, [2, 3, 9, 17]),

    # ── Cohort 2102 · AIICO Insurance · Premium (7 members, seq 6001-6007) ──
    ("Chidinma Obi",          "chidinma.obi@aiico.com",         "07031234519", "Port Harcourt", 2, 6001, [0, 1, 6, 9, 10]),
    ("Obiageli Nnaji",        "obiageli.nnaji@aiico.com",       "08131234520", "Enugu",         2, 6002, [2, 3, 4, 5, 9]),
    ("Seun Afolabi",          "seun.afolabi@aiico.com",         "08061234521", "Lagos",         2, 6003, [3, 4, 9, 13, 14, 15]),
    ("Kayode Adeleke",        "kayode.adeleke@aiico.com",       "07061234522", "Ibadan",        2, 6004, [0, 9, 10, 11]),
    ("Uche Ejike",            "uche.ejike@aiico.com",           "08021234523", "Enugu",         2, 6005, [1, 8, 9, 12, 16]),
    ("Tolani Bankole",        "tolani.bankole@aiico.com",       "08051234524", "Lagos",         2, 6006, [0, 2, 9, 17]),
    ("Emeka Onyekachi",       "emeka.onyekachi@aiico.com",      "08071234525", "Port Harcourt", 2, 6007, [3, 4, 5, 6, 9, 13, 14]),
]

ENROLLEES = []
for _idx, (_name, _email, _phone, _region, _cohort_idx, _seq, _meds) in enumerate(_raw_enrollees, 1):
    _cohort = COHORTS[_cohort_idx]
    ENROLLEES.append({
        "id":        f"e{_idx:02d}",
        "member_id": f"{_cohort['plan_code']}{_seq:04d}/0",
        "name":      _name,
        "email":     _email,
        "phone":     _phone,
        "region":    _region,
        "company":   _cohort["company"],
        "cohort_id": _cohort["id"],
        "scheme":    _cohort["scheme"],
        "status":    _statuses[(_idx - 1) % len(_statuses)],
        "policy_no": f"LW/{_cohort['plan_code']}/{_seq:04d}/0",
        "medications": [DRUG_NAMES[i] for i in _meds],
        "comments":  [],
    })

# ---------------------------------------------------------------------------
# ACUTE ORDERS  (12 orders spread across cohorts with real drug names)
# ---------------------------------------------------------------------------
_buckets = ["Pending", "Processing", "Dispatched", "Delivered", "Cancelled"]

_order_data = [
    # (enrollee_idx 1-based, drug_idx, qty, bucket_idx, day)
    (1,  0,  6, 0,  1),   # Adaeze – Coartem – Pending
    (3,  3, 28, 1,  2),   # Seun A. – Amlodipine – Processing
    (5,  1, 14, 2,  3),   # Ngozi – Amoxicillin – Dispatched
    (7,  9, 30, 3,  4),   # Ifeoma – Paracetamol – Delivered
    (11, 0,  6, 0,  5),   # Fatima – Coartem – Pending
    (12, 3, 28, 1,  6),   # Ibrahim – Amlodipine – Processing
    (15, 16, 7, 4,  7),   # Khadija – Azithromycin – Cancelled
    (19, 0,  6, 0,  8),   # Chidinma – Coartem – Pending
    (20, 2, 60, 1,  9),   # Obiageli – Metformin – Processing
    (22, 9, 30, 2, 10),   # Kayode – Paracetamol – Dispatched
    (24, 0,  6, 3, 11),   # Tolani – Coartem – Delivered
    (10, 5, 30, 1, 12),   # Emeka O. – Atorvastatin – Processing
]

ACUTE_ORDERS = [
    {
        "id":            f"ao{i+1}",
        "enrollee_id":   ENROLLEES[ei - 1]["id"],
        "enrollee_name": ENROLLEES[ei - 1]["name"],
        "drug":          DRUG_NAMES[di],
        "quantity":      qty,
        "bucket":        _buckets[bi],
        "region":        ENROLLEES[ei - 1]["region"],
        "created_at":    f"2026-04-{day:02d}T08:00:00",
        "notes":         "",
    }
    for i, (ei, di, qty, bi, day) in enumerate(_order_data)
]

# ---------------------------------------------------------------------------
# RIDERS (6)
# ---------------------------------------------------------------------------
_rider_statuses = ["Available", "On Delivery", "Off Duty"]

RIDERS = [
    {
        "id":               f"r{i}",
        "name":             f"Rider {i}",
        "phone":            f"070{i:08d}",
        "region":           _regions[i % len(_regions)],
        "status":           _rider_statuses[i % len(_rider_statuses)],
        "deliveries_today": i * 3,
        "vehicle":          "Motorcycle" if i % 2 == 0 else "Bicycle",
    }
    for i in range(1, 7)
]

# ---------------------------------------------------------------------------
# PARTNERS (8 real Nigerian healthcare providers)
# ---------------------------------------------------------------------------
_partner_names = [
    "MedPlus Pharmacy",
    "Reddington Hospital",
    "Lifebridge Medical Centre",
    "Drugstoc eHub",
    "St. Nicholas Hospital",
    "HealthPlus Pharmacy",
    "Clinotel Hospital",
    "Synlab Nigeria Diagnostics",
]
_partner_types = ["Pharmacy", "Hospital", "Clinic", "Pharmacy", "Hospital", "Pharmacy", "Clinic", "Diagnostic Centre"]
_partner_regions = ["Lagos", "Lagos", "Abuja", "Lagos", "Lagos", "Port Harcourt", "Kano", "Lagos"]

PARTNERS = [
    {
        "id":                f"p{i+1}",
        "name":              _partner_names[i],
        "type":              _partner_types[i],
        "region":            _partner_regions[i],
        "contact":           f"partner{i+1}@health.ng",
        "active":            (i + 1) % 5 != 0,
        "claims_this_month": (i + 1) * 14,
    }
    for i in range(8)
]

# ---------------------------------------------------------------------------
# CLAIMS  (25 — one per enrollee, real drug names)
# ---------------------------------------------------------------------------
_claim_statuses = ["Approved", "Pending", "Rejected", "Under Review"]
_claim_amounts  = [
    4200.00,  8750.00, 12400.00,  3150.00,  6800.00,  9300.00,  5600.00, 11200.00,
    7400.00,  4900.00,  3300.00,  6100.00,  8900.00,  5200.00, 14500.00,  4700.00,
    7800.00,  3900.00,  6500.00, 10200.00,  4400.00,  8100.00,  5900.00,  7200.00,
    13500.00,
]

CLAIMS = [
    {
        "id":           f"c{i+1:02d}",
        "enrollee_id":  ENROLLEES[i]["id"],
        "enrollee_name": ENROLLEES[i]["name"],
        "partner_id":   f"p{(i % 8) + 1}",
        "amount_ngn":   _claim_amounts[i],
        "status":       _claim_statuses[i % len(_claim_statuses)],
        "drug":         ENROLLEES[i]["medications"][0],
        "date":         f"2026-04-{(i % 28) + 1:02d}",
        "scheme":       ENROLLEES[i]["scheme"],
    }
    for i in range(25)
]

# ---------------------------------------------------------------------------
# AUDIT LOGS (12)
# ---------------------------------------------------------------------------
_audit_actions = ["LOGIN", "VIEW_ENROLLEE", "UPDATE_ORDER", "APPROVE_CLAIM", "ADD_COMMENT", "EXPORT_REPORT"]
_audit_roles   = ["pharmacist", "pharm_ops", "logistics", "contact", "admin", "rider"]

AUDIT = [
    {
        "id":        f"a{i:02d}",
        "user":      f"{_audit_roles[i % len(_audit_roles)]}@leadway.com",
        "role":      _audit_roles[i % len(_audit_roles)],
        "action":    _audit_actions[i % len(_audit_actions)],
        "resource":  f"enrollee/{ENROLLEES[i % 25]['id']}" if i % 2 == 0 else f"order/ao{i % 12 + 1}",
        "timestamp": f"2026-04-{(i % 25) + 1:02d}T{(i % 12) + 6:02d}:00:00",
        "ip":        f"10.0.0.{i}",
        "detail":    f"Audit event {i} details",
    }
    for i in range(1, 13)
]

# ---------------------------------------------------------------------------
# SCHEME RULES (3 — one per cohort)
# ---------------------------------------------------------------------------
SCHEME_RULES = [
    {
        "id":                    "sr1",
        "scheme":                "Executive",
        "max_annual_benefit_ngn": 1_000_000,
        "copay_percent":          10,
        "drug_coverage":          "Formulary A",
        "preauth_required":       False,
        "active":                 True,
    },
    {
        "id":                    "sr2",
        "scheme":                "Standard",
        "max_annual_benefit_ngn":  500_000,
        "copay_percent":           20,
        "drug_coverage":          "Formulary B",
        "preauth_required":       False,
        "active":                 True,
    },
    {
        "id":                    "sr3",
        "scheme":                "Premium",
        "max_annual_benefit_ngn": 2_000_000,
        "copay_percent":           5,
        "drug_coverage":          "Formulary A",
        "preauth_required":       True,
        "active":                 True,
    },
]
