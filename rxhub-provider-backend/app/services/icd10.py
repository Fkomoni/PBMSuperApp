"""Standard ICD-10-CM catalog (subset covering common chronic + acute presentations).

Source: WHO ICD-10 + CDC ICD-10-CM tabulations. This module keeps the catalog
embedded so the API has no external dependency for diagnosis lookup. Extend
the list or replace with a DB table when you need the full ~70k code set.

Lookup: `search(q)` matches a case-insensitive substring against both the code
and the description, returning the first N hits ranked by exactness.
"""
from __future__ import annotations

from functools import lru_cache

# (code, description)
_CATALOG: list[tuple[str, str]] = [
    # A00–B99 · Infectious & parasitic
    ("A09", "Infectious gastroenteritis and colitis, unspecified"),
    ("A15.0", "Tuberculosis of lung"),
    ("A41.9", "Sepsis, unspecified organism"),
    ("A90", "Dengue fever"),
    ("B05.9", "Measles without complication"),
    ("B20", "Human immunodeficiency virus [HIV] disease"),
    ("B24", "Unspecified HIV disease"),
    ("B34.9", "Viral infection, unspecified"),
    ("B50.9", "Plasmodium falciparum malaria, unspecified"),
    ("B51.9", "Plasmodium vivax malaria, unspecified"),
    ("B54", "Unspecified malaria"),

    # C00–D49 · Neoplasms
    ("C18.9", "Malignant neoplasm of colon, unspecified"),
    ("C20", "Malignant neoplasm of rectum"),
    ("C34.90", "Malignant neoplasm of unspecified part of unspecified bronchus or lung"),
    ("C50.911", "Malignant neoplasm of unspecified site of right female breast"),
    ("C50.912", "Malignant neoplasm of unspecified site of left female breast"),
    ("C53.9", "Malignant neoplasm of cervix uteri, unspecified"),
    ("C56.9", "Malignant neoplasm of unspecified ovary"),
    ("C61", "Malignant neoplasm of prostate"),
    ("C73", "Malignant neoplasm of thyroid gland"),
    ("C80.1", "Malignant (primary) neoplasm, unspecified"),
    ("C81.90", "Hodgkin lymphoma, unspecified, unspecified site"),
    ("C91.00", "Acute lymphoblastic leukemia not having achieved remission"),
    ("D12.6", "Benign neoplasm of colon, unspecified"),
    ("D25.9", "Leiomyoma of uterus, unspecified"),
    ("D50.9", "Iron deficiency anemia, unspecified"),
    ("D57.1", "Sickle-cell disease without crisis"),
    ("D64.9", "Anemia, unspecified"),

    # E00–E89 · Endocrine, nutritional, metabolic
    ("E03.9", "Hypothyroidism, unspecified"),
    ("E05.90", "Thyrotoxicosis, unspecified without thyrotoxic crisis or storm"),
    ("E10.9", "Type 1 diabetes mellitus without complications"),
    ("E10.65", "Type 1 diabetes mellitus with hyperglycemia"),
    ("E11.9", "Type 2 diabetes mellitus without complications"),
    ("E11.22", "Type 2 diabetes mellitus with diabetic chronic kidney disease"),
    ("E11.40", "Type 2 diabetes mellitus with diabetic neuropathy, unspecified"),
    ("E11.65", "Type 2 diabetes mellitus with hyperglycemia"),
    ("E11.8", "Type 2 diabetes mellitus with unspecified complications"),
    ("E16.2", "Hypoglycemia, unspecified"),
    ("E66.9", "Obesity, unspecified"),
    ("E78.0", "Pure hypercholesterolemia"),
    ("E78.2", "Mixed hyperlipidemia"),
    ("E78.5", "Hyperlipidemia, unspecified"),
    ("E86.0", "Dehydration"),
    ("E87.1", "Hypo-osmolality and hyponatremia"),
    ("E87.6", "Hypokalemia"),

    # F01–F99 · Mental, behavioural, neurodevelopmental
    ("F10.20", "Alcohol dependence, uncomplicated"),
    ("F17.210", "Nicotine dependence, cigarettes, uncomplicated"),
    ("F20.9", "Schizophrenia, unspecified"),
    ("F31.9", "Bipolar disorder, unspecified"),
    ("F32.0", "Major depressive disorder, single episode, mild"),
    ("F32.9", "Major depressive disorder, single episode, unspecified"),
    ("F33.9", "Major depressive disorder, recurrent, unspecified"),
    ("F41.0", "Panic disorder without agoraphobia"),
    ("F41.1", "Generalized anxiety disorder"),
    ("F41.9", "Anxiety disorder, unspecified"),
    ("F43.10", "Post-traumatic stress disorder, unspecified"),
    ("F51.01", "Primary insomnia"),
    ("F90.9", "Attention-deficit hyperactivity disorder, unspecified type"),

    # G00–G99 · Nervous system
    ("G20", "Parkinson's disease"),
    ("G35", "Multiple sclerosis"),
    ("G40.909", "Epilepsy, unspecified, not intractable, without status epilepticus"),
    ("G43.909", "Migraine, unspecified, not intractable, without status migrainosus"),
    ("G47.00", "Insomnia, unspecified"),
    ("G47.33", "Obstructive sleep apnea (adult) (pediatric)"),
    ("G56.00", "Carpal tunnel syndrome, unspecified upper limb"),
    ("G89.29", "Other chronic pain"),

    # H00–H59 · Eye
    ("H10.9", "Unspecified conjunctivitis"),
    ("H25.9", "Unspecified age-related cataract"),
    ("H40.11X0", "Primary open-angle glaucoma, stage unspecified"),
    ("H52.00", "Hypermetropia, unspecified eye"),
    ("H52.13", "Myopia, bilateral"),

    # H60–H95 · Ear
    ("H66.90", "Otitis media, unspecified, unspecified ear"),
    ("H81.10", "Benign paroxysmal vertigo, unspecified ear"),
    ("H91.90", "Unspecified hearing loss, unspecified ear"),

    # I00–I99 · Circulatory
    ("I10", "Essential (primary) hypertension"),
    ("I11.0", "Hypertensive heart disease with heart failure"),
    ("I11.9", "Hypertensive heart disease without heart failure"),
    ("I12.9", "Hypertensive chronic kidney disease with stage 1-4 CKD"),
    ("I13.10", "Hypertensive heart + CKD w/o heart failure, CKD stage 1-4"),
    ("I20.9", "Angina pectoris, unspecified"),
    ("I21.4", "Non-ST elevation (NSTEMI) myocardial infarction"),
    ("I21.9", "Acute myocardial infarction, unspecified"),
    ("I25.10", "Atherosclerotic heart disease of native coronary artery w/o angina"),
    ("I25.9", "Chronic ischemic heart disease, unspecified"),
    ("I48.0", "Paroxysmal atrial fibrillation"),
    ("I48.91", "Unspecified atrial fibrillation"),
    ("I50.9", "Heart failure, unspecified"),
    ("I50.32", "Chronic diastolic (congestive) heart failure"),
    ("I50.42", "Chronic combined systolic and diastolic heart failure"),
    ("I63.9", "Cerebral infarction, unspecified"),
    ("I64", "Stroke, not specified as haemorrhage or infarction"),
    ("I73.9", "Peripheral vascular disease, unspecified"),
    ("I80.209", "Phlebitis and thrombophlebitis of unspecified deep vessels, unspecified"),
    ("I82.40", "Acute embolism and thrombosis of unspecified deep veins of lower extremity"),
    ("I83.90", "Asymptomatic varicose veins of unspecified lower extremity"),
    ("I87.2", "Venous insufficiency (chronic) (peripheral)"),
    ("I95.9", "Hypotension, unspecified"),

    # J00–J99 · Respiratory
    ("J00", "Acute nasopharyngitis [common cold]"),
    ("J02.9", "Acute pharyngitis, unspecified"),
    ("J03.90", "Acute tonsillitis, unspecified"),
    ("J04.10", "Acute tracheitis without obstruction"),
    ("J06.9", "Acute upper respiratory infection, unspecified"),
    ("J11.1", "Influenza due to unidentified influenza virus with other respiratory manifestations"),
    ("J18.9", "Pneumonia, unspecified organism"),
    ("J20.9", "Acute bronchitis, unspecified"),
    ("J30.9", "Allergic rhinitis, unspecified"),
    ("J32.9", "Chronic sinusitis, unspecified"),
    ("J40", "Bronchitis, not specified as acute or chronic"),
    ("J44.0", "Chronic obstructive pulmonary disease with (acute) lower respiratory infection"),
    ("J44.1", "Chronic obstructive pulmonary disease with (acute) exacerbation"),
    ("J44.9", "Chronic obstructive pulmonary disease, unspecified"),
    ("J45.20", "Mild intermittent asthma, uncomplicated"),
    ("J45.30", "Mild persistent asthma, uncomplicated"),
    ("J45.40", "Moderate persistent asthma, uncomplicated"),
    ("J45.50", "Severe persistent asthma, uncomplicated"),
    ("J45.909", "Unspecified asthma, uncomplicated"),
    ("J45.901", "Unspecified asthma with (acute) exacerbation"),
    ("J96.00", "Acute respiratory failure, unspecified whether with hypoxia or hypercapnia"),
    ("J98.4", "Other disorders of lung"),

    # K00–K95 · Digestive
    ("K21.0", "Gastro-oesophageal reflux disease with oesophagitis"),
    ("K21.9", "Gastro-oesophageal reflux disease without oesophagitis"),
    ("K25.9", "Gastric ulcer, unspecified"),
    ("K29.70", "Gastritis, unspecified, without bleeding"),
    ("K30", "Functional dyspepsia"),
    ("K35.80", "Unspecified acute appendicitis"),
    ("K40.90", "Unilateral inguinal hernia, without obstruction or gangrene, not recurrent"),
    ("K52.9", "Noninfective gastroenteritis and colitis, unspecified"),
    ("K57.30", "Diverticulosis of large intestine without perforation/abscess, without bleeding"),
    ("K58.9", "Irritable bowel syndrome without diarrhoea"),
    ("K59.00", "Constipation, unspecified"),
    ("K70.30", "Alcoholic cirrhosis of liver without ascites"),
    ("K74.60", "Unspecified cirrhosis of liver"),
    ("K80.20", "Calculus of gallbladder without cholecystitis without obstruction"),
    ("K92.2", "Gastrointestinal haemorrhage, unspecified"),

    # L00–L99 · Skin
    ("L03.90", "Cellulitis, unspecified"),
    ("L20.9", "Atopic dermatitis, unspecified"),
    ("L23.9", "Allergic contact dermatitis, unspecified cause"),
    ("L30.9", "Dermatitis, unspecified"),
    ("L40.0", "Psoriasis vulgaris"),
    ("L50.9", "Urticaria, unspecified"),
    ("L70.0", "Acne vulgaris"),
    ("L98.9", "Disorder of the skin and subcutaneous tissue, unspecified"),

    # M00–M99 · Musculoskeletal
    ("M06.9", "Rheumatoid arthritis, unspecified"),
    ("M10.9", "Gout, unspecified"),
    ("M15.9", "Polyosteoarthritis, unspecified"),
    ("M17.9", "Osteoarthritis of knee, unspecified"),
    ("M19.90", "Unspecified osteoarthritis, unspecified site"),
    ("M25.50", "Pain in unspecified joint"),
    ("M32.9", "Systemic lupus erythematosus, unspecified"),
    ("M35.00", "Sjögren syndrome, unspecified"),
    ("M45.9", "Ankylosing spondylitis of unspecified sites in spine"),
    ("M47.812", "Spondylosis without myelopathy or radiculopathy, cervical region"),
    ("M54.2", "Cervicalgia"),
    ("M54.5", "Low back pain"),
    ("M54.50", "Low back pain, unspecified"),
    ("M62.81", "Muscle weakness (generalized)"),
    ("M79.1", "Myalgia"),
    ("M79.7", "Fibromyalgia"),
    ("M81.0", "Age-related osteoporosis without current pathological fracture"),

    # N00–N99 · Genitourinary
    ("N17.9", "Acute kidney failure, unspecified"),
    ("N18.1", "Chronic kidney disease, stage 1"),
    ("N18.2", "Chronic kidney disease, stage 2 (mild)"),
    ("N18.3", "Chronic kidney disease, stage 3 (moderate)"),
    ("N18.4", "Chronic kidney disease, stage 4 (severe)"),
    ("N18.5", "Chronic kidney disease, stage 5"),
    ("N18.6", "End stage renal disease"),
    ("N18.9", "Chronic kidney disease, unspecified"),
    ("N20.0", "Calculus of kidney"),
    ("N30.00", "Acute cystitis without haematuria"),
    ("N39.0", "Urinary tract infection, site not specified"),
    ("N40.1", "Benign prostatic hyperplasia with lower urinary tract symptoms"),
    ("N80.9", "Endometriosis, unspecified"),
    ("N83.20", "Unspecified ovarian cysts"),
    ("N91.2", "Amenorrhoea, unspecified"),
    ("N92.0", "Excessive and frequent menstruation with regular cycle"),
    ("N95.1", "Menopausal and female climacteric states"),
    ("N97.9", "Female infertility, unspecified"),
    ("N46.9", "Male infertility, unspecified"),

    # O00–O9A · Pregnancy, childbirth, puerperium
    ("O09.90", "Supervision of high-risk pregnancy, unspecified, unspecified trimester"),
    ("O13.9", "Gestational [pregnancy-induced] hypertension, unspecified trimester"),
    ("O14.90", "Unspecified pre-eclampsia, unspecified trimester"),
    ("O24.410", "Gestational diabetes mellitus in pregnancy, diet controlled"),
    ("O80", "Encounter for full-term uncomplicated delivery"),

    # P00–P96 · Perinatal
    ("P07.30", "Preterm newborn, unspecified weeks of gestation"),
    ("P59.9", "Neonatal jaundice, unspecified"),

    # Q00–Q99 · Congenital
    ("Q21.0", "Ventricular septal defect"),
    ("Q90.9", "Down syndrome, unspecified"),

    # R00–R99 · Symptoms, signs, abnormal findings
    ("R05.9", "Cough, unspecified"),
    ("R06.02", "Shortness of breath"),
    ("R07.9", "Chest pain, unspecified"),
    ("R10.9", "Unspecified abdominal pain"),
    ("R11.10", "Vomiting, unspecified"),
    ("R19.7", "Diarrhoea, unspecified"),
    ("R21", "Rash and other nonspecific skin eruption"),
    ("R30.0", "Dysuria"),
    ("R42", "Dizziness and giddiness"),
    ("R50.9", "Fever, unspecified"),
    ("R51", "Headache"),
    ("R53.83", "Other fatigue"),
    ("R60.9", "Oedema, unspecified"),
    ("R63.0", "Anorexia"),
    ("R73.03", "Prediabetes"),
    ("R73.9", "Hyperglycaemia, unspecified"),
    ("R94.31", "Abnormal electrocardiogram [ECG] [EKG]"),

    # S00–T88 · Injury, poisoning (selected)
    ("S06.0X0A", "Concussion without loss of consciousness, initial encounter"),
    ("S52.501A", "Unspecified fracture of the lower end of right radius, initial encounter"),
    ("S72.001A", "Fracture of unspecified part of neck of right femur, initial encounter"),
    ("T78.40XA", "Allergy, unspecified, initial encounter"),

    # Z00–Z99 · Factors influencing health status
    ("Z00.00", "Encounter for general adult medical examination w/o abnormal findings"),
    ("Z23", "Encounter for immunization"),
    ("Z30.9", "Encounter for contraceptive management, unspecified"),
    ("Z33.1", "Pregnant state, incidental"),
    ("Z34.90", "Encounter for supervision of normal pregnancy, unspecified, unspecified trimester"),
    ("Z51.11", "Encounter for antineoplastic chemotherapy"),
    ("Z68.25", "Body mass index [BMI] 25.0-25.9, adult"),
    ("Z79.4", "Long term (current) use of insulin"),
    ("Z79.82", "Long term (current) use of aspirin"),
    ("Z79.84", "Long term (current) use of oral hypoglycemic drugs"),
    ("Z79.899", "Other long term (current) drug therapy"),
    ("Z86.73", "Personal history of transient ischaemic attack and cerebral infarction w/o residual deficits"),
    ("Z87.891", "Personal history of nicotine dependence"),
]


@lru_cache(maxsize=1)
def _index() -> list[dict]:
    return [{"code": c, "name": n, "search": (c + " " + n).lower()} for c, n in _CATALOG]


def all_codes() -> list[dict]:
    return [{"code": x["code"], "name": x["name"]} for x in _index()]


def search(query: str, limit: int = 20) -> list[dict]:
    q = (query or "").strip().lower()
    if not q:
        return all_codes()[:limit]
    idx = _index()
    exact_code = [x for x in idx if x["code"].lower() == q]
    prefix_code = [x for x in idx if x["code"].lower().startswith(q) and x not in exact_code]
    substring = [x for x in idx if q in x["search"] and x not in exact_code and x not in prefix_code]
    hits = exact_code + prefix_code + substring
    return [{"code": x["code"], "name": x["name"]} for x in hits[:limit]]
