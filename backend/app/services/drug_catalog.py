"""Nigerian drug catalog — brand + generic names, strengths, forms, and the
classification hint used by the router (acute / chronic / hormonal / cancer
/ autoimmune / fertility).

WellaHealth's Fulfilments POST accepts free-form drug objects
({name, form, strength, frequency, duration, quantity}) — it does NOT
expose a drug catalog endpoint. So autocomplete / selection has to come
from our own list.

The entries below cover the common Nigerian formulary across every
routing cohort, with brand names a Nigerian prescriber will recognise.
Extend as new drugs appear on the tariff.

Fields on each entry:
    name           brand + strength (what shows in the search dropdown)
    generic        INN / generic name
    form           "Tablet" / "Capsule" / "Syrup" / "Injection" / "Inhaler" / ...
    strength       "10mg" / "80/480mg" / "100 units/ml" / ...
    unit_price     indicative NGN per unit — refresh from Wella / WellaTariff
                   when available. None means unknown.
    classification acute | chronic | hormonal | cancer | autoimmune | fertility
"""
from __future__ import annotations

from functools import lru_cache


# Tuple layout: name, generic, form, strength, unit_price, classification
_CATALOG: list[tuple[str, str, str, str, int | None, str]] = [
    # ── Antihypertensives (chronic) ────────────────────────────────
    ("Amlodipine 5mg (Norvasc)",        "Amlodipine",        "Tablet", "5mg",   28,  "chronic"),
    ("Amlodipine 10mg (Norvasc)",       "Amlodipine",        "Tablet", "10mg",  42,  "chronic"),
    ("Lisinopril 5mg (Zestril)",        "Lisinopril",        "Tablet", "5mg",   35,  "chronic"),
    ("Lisinopril 10mg (Zestril)",       "Lisinopril",        "Tablet", "10mg",  55,  "chronic"),
    ("Losartan 50mg (Cozaar)",          "Losartan potassium","Tablet", "50mg",  90,  "chronic"),
    ("Losartan 100mg (Cozaar)",         "Losartan potassium","Tablet", "100mg", 140, "chronic"),
    ("Valsartan 80mg (Diovan)",         "Valsartan",         "Tablet", "80mg",  160, "chronic"),
    ("Valsartan 160mg (Diovan)",        "Valsartan",         "Tablet", "160mg", 220, "chronic"),
    ("Telmisartan 40mg (Micardis)",     "Telmisartan",       "Tablet", "40mg",  180, "chronic"),
    ("Telmisartan 80mg (Micardis)",     "Telmisartan",       "Tablet", "80mg",  260, "chronic"),
    ("Enalapril 5mg",                   "Enalapril",         "Tablet", "5mg",   25,  "chronic"),
    ("Enalapril 10mg",                  "Enalapril",         "Tablet", "10mg",  40,  "chronic"),
    ("Nifedipine 20mg SR (Adalat)",     "Nifedipine",        "Tablet", "20mg",  55,  "chronic"),
    ("Atenolol 50mg (Tenormin)",        "Atenolol",          "Tablet", "50mg",  30,  "chronic"),
    ("Atenolol 100mg (Tenormin)",       "Atenolol",          "Tablet", "100mg", 50,  "chronic"),
    ("Bisoprolol 5mg (Concor)",         "Bisoprolol",        "Tablet", "5mg",   110, "chronic"),
    ("Bisoprolol 10mg (Concor)",        "Bisoprolol",        "Tablet", "10mg",  160, "chronic"),
    ("Hydrochlorothiazide 25mg",        "Hydrochlorothiazide","Tablet","25mg",  20,  "chronic"),
    ("Spironolactone 25mg (Aldactone)", "Spironolactone",    "Tablet", "25mg",  45,  "chronic"),
    ("Furosemide 40mg (Lasix)",         "Furosemide",        "Tablet", "40mg",  22,  "chronic"),
    ("Methyldopa 250mg (Aldomet)",      "Methyldopa",        "Tablet", "250mg", 70,  "chronic"),

    # ── Antidiabetics (chronic) ────────────────────────────────────
    ("Metformin 500mg (Glucophage)",    "Metformin",         "Tablet", "500mg", 16,  "chronic"),
    ("Metformin 850mg (Glucophage)",    "Metformin",         "Tablet", "850mg", 28,  "chronic"),
    ("Metformin 1000mg (Glucophage XR)","Metformin",         "Tablet", "1000mg",44,  "chronic"),
    ("Glibenclamide 5mg (Daonil)",      "Glibenclamide",     "Tablet", "5mg",   15,  "chronic"),
    ("Gliclazide 80mg (Diamicron)",     "Gliclazide",        "Tablet", "80mg",  50,  "chronic"),
    ("Gliclazide 60mg MR (Diamicron MR)","Gliclazide",       "Tablet", "60mg",  70,  "chronic"),
    ("Sitagliptin 100mg (Januvia)",     "Sitagliptin",       "Tablet", "100mg", 500, "chronic"),
    ("Empagliflozin 10mg (Jardiance)",  "Empagliflozin",     "Tablet", "10mg",  650, "chronic"),
    ("Empagliflozin 25mg (Jardiance)",  "Empagliflozin",     "Tablet", "25mg",  850, "chronic"),
    ("Pioglitazone 30mg (Actos)",       "Pioglitazone",      "Tablet", "30mg",  180, "chronic"),
    ("Insulin Mixtard 30/70 100IU/ml",  "Biphasic insulin",  "Injection","100IU/ml (10ml)", 3500, "chronic"),
    ("Insulin Lantus 100IU/ml",         "Insulin glargine",  "Injection","100IU/ml (3ml pen)", 9500, "chronic"),
    ("Insulin Actrapid 100IU/ml",       "Insulin regular",   "Injection","100IU/ml (10ml)", 3800, "chronic"),

    # ── Statins + cardiovascular (chronic) ─────────────────────────
    ("Simvastatin 20mg (Zocor)",        "Simvastatin",       "Tablet", "20mg",  80,  "chronic"),
    ("Simvastatin 40mg (Zocor)",        "Simvastatin",       "Tablet", "40mg",  110, "chronic"),
    ("Atorvastatin 10mg (Lipitor)",     "Atorvastatin",      "Tablet", "10mg",  100, "chronic"),
    ("Atorvastatin 20mg (Lipitor)",     "Atorvastatin",      "Tablet", "20mg",  140, "chronic"),
    ("Atorvastatin 40mg (Lipitor)",     "Atorvastatin",      "Tablet", "40mg",  200, "chronic"),
    ("Rosuvastatin 10mg (Crestor)",     "Rosuvastatin",      "Tablet", "10mg",  250, "chronic"),
    ("Rosuvastatin 20mg (Crestor)",     "Rosuvastatin",      "Tablet", "20mg",  350, "chronic"),
    ("Aspirin 75mg (Cardioaspirin)",    "Acetylsalicylic acid","Tablet","75mg", 12,  "chronic"),
    ("Clopidogrel 75mg (Plavix)",       "Clopidogrel",       "Tablet", "75mg",  140, "chronic"),
    ("Warfarin 5mg (Coumadin)",         "Warfarin",          "Tablet", "5mg",   35,  "chronic"),
    ("Rivaroxaban 20mg (Xarelto)",      "Rivaroxaban",       "Tablet", "20mg",  950, "chronic"),
    ("Apixaban 5mg (Eliquis)",          "Apixaban",          "Tablet", "5mg",   820, "chronic"),

    # ── PPIs / GI (often chronic) ──────────────────────────────────
    ("Omeprazole 20mg (Losec)",         "Omeprazole",        "Capsule","20mg",  60,  "chronic"),
    ("Omeprazole 40mg",                 "Omeprazole",        "Capsule","40mg",  110, "chronic"),
    ("Esomeprazole 20mg (Nexium)",      "Esomeprazole",      "Tablet", "20mg",  210, "chronic"),
    ("Esomeprazole 40mg (Nexium)",      "Esomeprazole",      "Tablet", "40mg",  320, "chronic"),
    ("Pantoprazole 40mg (Pantoloc)",    "Pantoprazole",      "Tablet", "40mg",  90,  "chronic"),
    ("Rabeprazole 20mg (Pariet)",       "Rabeprazole",       "Tablet", "20mg",  140, "chronic"),
    ("Lansoprazole 30mg (Prevacid)",    "Lansoprazole",      "Capsule","30mg",  110, "chronic"),
    ("Famotidine 40mg (Pepcid)",        "Famotidine",        "Tablet", "40mg",  45,  "chronic"),

    # ── Asthma / COPD (chronic) ────────────────────────────────────
    ("Salbutamol Inhaler 100mcg (Ventolin)","Salbutamol",    "Inhaler","100mcg/puff (200 doses)", 2500, "chronic"),
    ("Salbutamol 4mg Tablet",           "Salbutamol",        "Tablet", "4mg",   25,  "chronic"),
    ("Salbutamol 2mg/5ml Syrup",        "Salbutamol",        "Syrup",  "2mg/5ml (100ml)", 900, "chronic"),
    ("Beclomethasone Inhaler 250mcg",   "Beclomethasone",    "Inhaler","250mcg/puff", 3500, "chronic"),
    ("Fluticasone/Salmeterol 250/50 (Seretide)","Fluticasone+Salmeterol","Inhaler","250/50mcg",7500,"chronic"),
    ("Budesonide/Formoterol (Symbicort)","Budesonide+Formoterol","Inhaler","160/4.5mcg",9000,"chronic"),
    ("Montelukast 10mg (Singulair)",    "Montelukast",       "Tablet", "10mg",  220, "chronic"),
    ("Ipratropium Inhaler (Atrovent)",  "Ipratropium bromide","Inhaler","20mcg/puff", 4200, "chronic"),

    # ── Thyroid (chronic) ──────────────────────────────────────────
    ("Levothyroxine 50mcg (Eltroxin)",  "Levothyroxine",     "Tablet", "50mcg", 45,  "chronic"),
    ("Levothyroxine 100mcg (Eltroxin)", "Levothyroxine",     "Tablet", "100mcg",60,  "chronic"),
    ("Carbimazole 5mg (Neo-Mercazole)", "Carbimazole",       "Tablet", "5mg",   80,  "chronic"),

    # ── Antiepileptics / CNS (chronic) ─────────────────────────────
    ("Carbamazepine 200mg (Tegretol)",  "Carbamazepine",     "Tablet", "200mg", 45,  "chronic"),
    ("Phenytoin 100mg (Dilantin)",      "Phenytoin",         "Capsule","100mg", 50,  "chronic"),
    ("Sodium Valproate 200mg (Epilim)", "Sodium valproate",  "Tablet", "200mg", 60,  "chronic"),
    ("Lamotrigine 100mg (Lamictal)",    "Lamotrigine",       "Tablet", "100mg", 220, "chronic"),
    ("Levetiracetam 500mg (Keppra)",    "Levetiracetam",     "Tablet", "500mg", 280, "chronic"),

    # ── Psychiatric (chronic) ──────────────────────────────────────
    ("Fluoxetine 20mg (Prozac)",        "Fluoxetine",        "Capsule","20mg",  90,  "chronic"),
    ("Sertraline 50mg (Zoloft)",        "Sertraline",        "Tablet", "50mg",  140, "chronic"),
    ("Sertraline 100mg (Zoloft)",       "Sertraline",        "Tablet", "100mg", 210, "chronic"),
    ("Amitriptyline 25mg",              "Amitriptyline",     "Tablet", "25mg",  30,  "chronic"),
    ("Olanzapine 10mg (Zyprexa)",       "Olanzapine",        "Tablet", "10mg",  320, "chronic"),
    ("Risperidone 2mg (Risperdal)",     "Risperidone",       "Tablet", "2mg",   180, "chronic"),
    ("Quetiapine 100mg (Seroquel)",     "Quetiapine",        "Tablet", "100mg", 260, "chronic"),
    ("Diazepam 5mg (Valium)",           "Diazepam",          "Tablet", "5mg",   35,  "acute"),

    # ── Antibiotics (acute) ────────────────────────────────────────
    ("Amoxicillin 500mg (Amoxil)",      "Amoxicillin",       "Capsule","500mg", 35,  "acute"),
    ("Amoxicillin 500mg (Moxalin)",     "Amoxicillin",       "Capsule","500mg", 28,  "acute"),
    ("Amoxicillin 500mg (Emzor Amoxil)","Amoxicillin",       "Capsule","500mg", 30,  "acute"),
    ("Amoxicillin 250mg/5ml Syrup",     "Amoxicillin",       "Syrup",  "250mg/5ml (100ml)", 1200, "acute"),
    ("Ampiclox 500mg (Beecham)",        "Ampicillin+Cloxacillin","Capsule","500mg", 45, "acute"),
    ("Flucloxacillin 500mg (Floxapen)", "Flucloxacillin",    "Capsule","500mg", 90,  "acute"),
    ("Amoxiclav 625mg (Augmentin)",     "Amoxicillin+Clavulanate","Tablet","625mg",350,"acute"),
    ("Amoxiclav 1g (Augmentin)",        "Amoxicillin+Clavulanate","Tablet","1g", 480,"acute"),
    ("Amoxiclav 625mg (Clavulin)",      "Amoxicillin+Clavulanate","Tablet","625mg",320,"acute"),
    ("Amoxiclav 457mg/5ml Suspension (Augmentin)","Amoxicillin+Clavulanate","Syrup","457mg/5ml (70ml)",3200,"acute"),
    ("Ciprofloxacin 500mg (Cipro)",     "Ciprofloxacin",     "Tablet", "500mg", 80,  "acute"),
    ("Ciprofloxacin 500mg (Ciprotab)",  "Ciprofloxacin",     "Tablet", "500mg", 65,  "acute"),
    ("Levofloxacin 500mg (Tavanic)",    "Levofloxacin",      "Tablet", "500mg", 280, "acute"),
    ("Ofloxacin 200mg (Tarivid)",       "Ofloxacin",         "Tablet", "200mg", 140, "acute"),
    ("Azithromycin 500mg (Zithromax)",  "Azithromycin",      "Tablet", "500mg", 420, "acute"),
    ("Azithromycin 500mg (Azithrex)",   "Azithromycin",      "Tablet", "500mg", 350, "acute"),
    ("Azithromycin 200mg/5ml Syrup",    "Azithromycin",      "Syrup",  "200mg/5ml (15ml)", 2500, "acute"),
    ("Clarithromycin 500mg (Klacid)",   "Clarithromycin",    "Tablet", "500mg", 550, "acute"),
    ("Erythromycin 500mg (Erythrocin)", "Erythromycin",      "Tablet", "500mg", 90,  "acute"),
    ("Cefuroxime 500mg (Zinnat)",       "Cefuroxime",        "Tablet", "500mg", 380, "acute"),
    ("Cefixime 400mg (Suprax)",         "Cefixime",          "Capsule","400mg", 310, "acute"),
    ("Ceftriaxone 1g Injection (Rocephin)","Ceftriaxone",    "Injection","1g",   950, "acute"),
    ("Doxycycline 100mg (Vibramycin)",  "Doxycycline",       "Capsule","100mg", 55,  "acute"),
    ("Metronidazole 400mg (Flagyl)",    "Metronidazole",     "Tablet", "400mg", 22,  "acute"),
    ("Metronidazole 200mg/5ml Syrup",   "Metronidazole",     "Syrup",  "200mg/5ml (60ml)", 850, "acute"),
    ("Cotrimoxazole 960mg (Septrin)",   "Sulfamethoxazole+Trimethoprim","Tablet","960mg",30,"acute"),
    ("Cotrimoxazole 240mg/5ml Syrup (Septrin)","Sulfamethoxazole+Trimethoprim","Syrup","240mg/5ml (100ml)",720,"acute"),
    ("Nitrofurantoin 100mg (Macrobid)", "Nitrofurantoin",    "Capsule","100mg", 80,  "acute"),
    ("Fluconazole 150mg (Diflucan)",    "Fluconazole",       "Capsule","150mg", 110, "acute"),
    ("Nystatin 100000IU/ml Suspension", "Nystatin",          "Syrup",  "100000IU/ml (30ml)",1400,"acute"),
    ("Clotrimazole 1% Cream",           "Clotrimazole",      "Cream",  "1% (15g)", 350, "acute"),
    ("Ketoconazole 200mg (Nizoral)",    "Ketoconazole",      "Tablet", "200mg", 280, "acute"),
    ("Griseofulvin 500mg",              "Griseofulvin",      "Tablet", "500mg", 180, "acute"),
    ("Albendazole 400mg (Zentel)",      "Albendazole",       "Tablet", "400mg", 120, "acute"),
    ("Mebendazole 100mg (Vermox)",      "Mebendazole",       "Tablet", "100mg", 60,  "acute"),
    ("Ivermectin 6mg (Mectizan)",       "Ivermectin",        "Tablet", "6mg",   150, "acute"),
    ("Praziquantel 600mg (Biltricide)", "Praziquantel",      "Tablet", "600mg", 320, "acute"),

    # ── Antimalarials (acute) ──────────────────────────────────────
    # Nigeria has many brand SKUs of artemether/lumefantrine — keep them
    # separate so prescribers can pick the exact brand the member is used to.
    ("Artemether/Lumefantrine 80/480mg (Coartem)","Artemether+Lumefantrine","Tablet","80/480mg",2500,"acute"),
    ("Artemether/Lumefantrine 20/120mg (Coartem)","Artemether+Lumefantrine","Tablet","20/120mg",1800,"acute"),
    ("Artemether/Lumefantrine 80/480mg (Lonart)","Artemether+Lumefantrine","Tablet","80/480mg",2300,"acute"),
    ("Artemether/Lumefantrine 20/120mg (Lonart DS)","Artemether+Lumefantrine","Tablet","20/120mg",1700,"acute"),
    ("Artemether/Lumefantrine 80/480mg (Amatem Softgel)","Artemether+Lumefantrine","Capsule","80/480mg",2400,"acute"),
    ("Artemether/Lumefantrine 20/120mg (Amatem)","Artemether+Lumefantrine","Tablet","20/120mg",1600,"acute"),
    ("Artemether/Lumefantrine 80/480mg (Lumartem)","Artemether+Lumefantrine","Tablet","80/480mg",2100,"acute"),
    ("Artemether/Lumefantrine Suspension (Lonart-DS Syrup)","Artemether+Lumefantrine","Syrup","15/90mg per 5ml (60ml)",2200,"acute"),
    ("Artemether/Lumefantrine Suspension (Coartem Baby)","Artemether+Lumefantrine","Syrup","15/90mg per 5ml (60ml)",2600,"acute"),
    ("Dihydroartemisinin/Piperaquine (P-Alaxin)","DHA+Piperaquine","Tablet","40/320mg",2200,"acute"),
    ("Dihydroartemisinin/Piperaquine (Eurartesim)","DHA+Piperaquine","Tablet","40/320mg",2600,"acute"),
    ("Dihydroartemisinin/Piperaquine Suspension (P-Alaxin Syrup)","DHA+Piperaquine","Syrup","10/80mg per 5ml",2100,"acute"),
    ("Artesunate/Amodiaquine (Larimal)","Artesunate+Amodiaquine","Tablet","100/270mg",1900,"acute"),
    ("Artesunate/Amodiaquine (Camosunate)","Artesunate+Amodiaquine","Tablet","100/270mg",1800,"acute"),
    ("Artesunate/Amodiaquine (Winthrop)","Artesunate+Amodiaquine","Tablet","100/270mg",1700,"acute"),
    ("Artesunate Injection 60mg (Artesun)","Artesunate",     "Injection","60mg",  1600, "acute"),
    ("Artesunate Tablet 50mg (Arsumax)", "Artesunate",        "Tablet", "50mg",  450, "acute"),
    ("Quinine 300mg Tablet",            "Quinine sulphate",  "Tablet", "300mg", 50,  "acute"),
    ("Quinine Injection 600mg",         "Quinine dihydrochloride","Injection","600mg/2ml",420,"acute"),
    ("Sulfadoxine/Pyrimethamine (Fansidar)","Sulfadoxine+Pyrimethamine","Tablet","500/25mg",120,"acute"),

    # ── Analgesics / antipyretics / anti-inflammatory (acute) ──────
    ("Paracetamol 500mg (Panadol)",     "Paracetamol",       "Tablet", "500mg", 5,   "acute"),
    ("Paracetamol 500mg (Emzor Paracetamol)","Paracetamol",  "Tablet", "500mg", 4,   "acute"),
    ("Paracetamol 500mg (M&B Paracetamol)","Paracetamol",    "Tablet", "500mg", 4,   "acute"),
    ("Paracetamol Extra 500mg (Panadol Extra)","Paracetamol+Caffeine","Tablet","500/65mg",15,"acute"),
    ("Paracetamol 120mg/5ml Syrup (Calpol)","Paracetamol",   "Syrup",  "120mg/5ml (100ml)", 650, "acute"),
    ("Paracetamol 120mg/5ml Syrup (Emzor Paracetamol)","Paracetamol","Syrup","120mg/5ml (100ml)",450,"acute"),
    ("Paracetamol 1g IV Infusion (Perfalgan)","Paracetamol", "Injection","1g/100ml", 1400, "acute"),
    ("Ibuprofen 400mg (Brufen)",        "Ibuprofen",         "Tablet", "400mg", 18,  "acute"),
    ("Ibuprofen 200mg/5ml Syrup",       "Ibuprofen",         "Syrup",  "200mg/5ml (100ml)", 950, "acute"),
    ("Diclofenac 50mg (Voltaren)",      "Diclofenac",        "Tablet", "50mg",  22,  "acute"),
    ("Diclofenac 100mg SR (Cataflam SR)","Diclofenac",       "Tablet", "100mg", 55,  "acute"),
    ("Diclofenac 75mg Injection",       "Diclofenac",        "Injection","75mg/3ml", 300, "acute"),
    ("Diclofenac Gel 1% (Voltaren Emulgel)","Diclofenac",    "Gel",    "1% (50g)", 1600, "acute"),
    ("Naproxen 500mg",                  "Naproxen",          "Tablet", "500mg", 65,  "acute"),
    ("Celecoxib 200mg (Celebrex)",      "Celecoxib",         "Capsule","200mg", 380, "acute"),
    ("Piroxicam 20mg (Feldene)",        "Piroxicam",         "Capsule","20mg",  55,  "acute"),
    ("Meloxicam 15mg (Mobic)",          "Meloxicam",         "Tablet", "15mg",  110, "acute"),
    ("Tramadol 50mg",                   "Tramadol",          "Capsule","50mg",  35,  "acute"),
    ("Tramadol 100mg Injection",        "Tramadol",          "Injection","100mg/2ml",150,"acute"),
    ("Morphine 10mg Injection",         "Morphine",          "Injection","10mg/ml",  380, "acute"),
    ("Pentazocine 30mg Injection (Fortwin)","Pentazocine",   "Injection","30mg/ml",  280, "acute"),

    # ── ENT / cough / antihistamines (mostly acute) ────────────────
    ("Cetirizine 10mg (Zyrtec)",        "Cetirizine",        "Tablet", "10mg",  25,  "acute"),
    ("Cetirizine 5mg/5ml Syrup",        "Cetirizine",        "Syrup",  "5mg/5ml (60ml)", 750, "acute"),
    ("Loratadine 10mg (Claritin)",      "Loratadine",        "Tablet", "10mg",  35,  "acute"),
    ("Chlorpheniramine 4mg (Piriton)",  "Chlorpheniramine",  "Tablet", "4mg",   8,   "acute"),
    ("Dextromethorphan 15mg/5ml (Benylin DM)","Dextromethorphan","Syrup","15mg/5ml (100ml)",850,"acute"),
    ("Promethazine 25mg (Phenergan)",   "Promethazine",      "Tablet", "25mg",  25,  "acute"),
    ("Xylometazoline 0.1% Nasal Drops (Otrivin)","Xylometazoline","Drops","0.1% (10ml)",850,"acute"),

    # ── GI (acute) ─────────────────────────────────────────────────
    ("Loperamide 2mg (Imodium)",        "Loperamide",        "Capsule","2mg",   20,  "acute"),
    ("Oral Rehydration Salts Sachet",   "ORS",               "Sachet", "Per sachet", 120, "acute"),
    ("Ondansetron 4mg (Zofran)",        "Ondansetron",       "Tablet", "4mg",   85,  "acute"),
    ("Metoclopramide 10mg (Maxolon)",   "Metoclopramide",    "Tablet", "10mg",  18,  "acute"),
    ("Hyoscine Butylbromide 10mg (Buscopan)","Hyoscine N-butylbromide","Tablet","10mg",45,"acute"),

    # ── Hormonal cohort (hormonal) ─────────────────────────────────
    ("Estradiol 2mg (Progynova)",       "Estradiol valerate","Tablet", "2mg",   120, "hormonal"),
    ("Ethinylestradiol/Levonorgestrel (Microgynon)","Ethinylestradiol+Levonorgestrel","Tablet","30mcg/150mcg",450,"hormonal"),
    ("Medroxyprogesterone 150mg (Depo-Provera)","Medroxyprogesterone","Injection","150mg/ml",1200,"hormonal"),
    ("Norethisterone 5mg (Primolut N)", "Norethisterone",    "Tablet", "5mg",   85,  "hormonal"),
    ("Tibolone 2.5mg (Livial)",         "Tibolone",          "Tablet", "2.5mg", 380, "hormonal"),

    # ── Fertility cohort (fertility) ───────────────────────────────
    ("Clomiphene 50mg (Clomid)",        "Clomiphene citrate","Tablet", "50mg",  180, "fertility"),
    ("Letrozole 2.5mg (Femara)",        "Letrozole",         "Tablet", "2.5mg", 320, "fertility"),
    ("Cyclogest 400mg (Progesterone)",  "Progesterone",      "Pessary","400mg", 950, "fertility"),
    ("Duphaston 10mg (Dydrogesterone)", "Dydrogesterone",    "Tablet", "10mg",  420, "fertility"),
    ("Follitropin 75IU Injection (Gonal-F)","Follitropin alfa","Injection","75IU",8500,"fertility"),
    ("HCG 5000IU Injection (Pregnyl)",  "Human chorionic gonadotropin","Injection","5000IU",2800,"fertility"),

    # ── Cancer cohort (cancer) ─────────────────────────────────────
    ("Tamoxifen 20mg (Nolvadex)",       "Tamoxifen",         "Tablet", "20mg",  180, "cancer"),
    ("Anastrozole 1mg (Arimidex)",      "Anastrozole",       "Tablet", "1mg",   850, "cancer"),
    ("Capecitabine 500mg (Xeloda)",     "Capecitabine",      "Tablet", "500mg", 1400,"cancer"),
    ("Imatinib 400mg (Glivec)",         "Imatinib",          "Tablet", "400mg", 2500,"cancer"),
    ("Cyclophosphamide 50mg (Endoxan)", "Cyclophosphamide",  "Tablet", "50mg",  220, "cancer"),
    ("Methotrexate 2.5mg Tablet",       "Methotrexate",      "Tablet", "2.5mg", 75,  "cancer"),
    ("Leuprolide 3.75mg Depot (Lupron)","Leuprolide acetate","Injection","3.75mg",24000,"cancer"),
    ("Goserelin 3.6mg Implant (Zoladex)","Goserelin",        "Injection","3.6mg",28000,"cancer"),

    # ── Autoimmune cohort (autoimmune) ─────────────────────────────
    ("Hydroxychloroquine 200mg (Plaquenil)","Hydroxychloroquine","Tablet","200mg",180,"autoimmune"),
    ("Prednisolone 5mg",                "Prednisolone",      "Tablet", "5mg",   15,  "autoimmune"),
    ("Methylprednisolone 4mg (Medrol)", "Methylprednisolone","Tablet", "4mg",   120, "autoimmune"),
    ("Azathioprine 50mg (Imuran)",      "Azathioprine",      "Tablet", "50mg",  160, "autoimmune"),
    ("Sulfasalazine 500mg (Salazopyrin)","Sulfasalazine",    "Tablet", "500mg", 90,  "autoimmune"),
    ("Mycophenolate 500mg (CellCept)",  "Mycophenolate mofetil","Tablet","500mg",480,"autoimmune"),

    # ── Eye / topical / misc (acute) ───────────────────────────────
    ("Timolol 0.5% Eye Drops (Timoptol)","Timolol",          "Drops",  "0.5% (5ml)",  680, "chronic"),
    ("Latanoprost 0.005% Eye Drops (Xalatan)","Latanoprost", "Drops",  "0.005% (2.5ml)", 3200, "chronic"),
    ("Chloramphenicol 0.5% Eye Drops",  "Chloramphenicol",   "Drops",  "0.5% (10ml)", 450, "acute"),
    ("Tobramycin 0.3% Eye Drops (Tobrex)","Tobramycin",      "Drops",  "0.3% (5ml)",  1100, "acute"),
    ("Hydrocortisone 1% Cream",         "Hydrocortisone",    "Cream",  "1% (15g)", 420, "acute"),
    ("Betamethasone 0.1% Cream",        "Betamethasone",     "Cream",  "0.1% (15g)", 550, "acute"),

    # ── Vitamins / supplements (often chronic when prescribed long-term) ─
    ("Folic Acid 5mg",                  "Folic acid",        "Tablet", "5mg",   8,   "chronic"),
    ("Ferrous Sulphate 200mg",          "Ferrous sulphate",  "Tablet", "200mg", 12,  "chronic"),
    ("Vitamin B-Complex",               "Vitamin B complex", "Tablet", "Standard",20,"chronic"),
    ("Vitamin D3 1000IU",               "Cholecalciferol",   "Tablet", "1000IU", 45,  "chronic"),
    ("Calcium Carbonate 500mg (Caltrate)","Calcium carbonate","Tablet","500mg",  35,  "chronic"),
]


@lru_cache(maxsize=1)
def _index() -> list[dict]:
    """Build the search index once, lower-case combined key + integer id."""
    return [
        {
            "drug_id": i + 1,  # integer id — Wella's Fulfilments schema expects int
            "name": name,
            "generic": generic,
            "form": form,
            "strength": strength,
            "unit_price": unit_price,
            "classification": classification,
            "_search": (name + " " + generic + " " + form + " " + strength).lower(),
        }
        for i, (name, generic, form, strength, unit_price, classification) in enumerate(_CATALOG)
    ]


def all_drugs() -> list[dict]:
    return [{k: v for k, v in d.items() if not k.startswith("_")} for d in _index()]


def search(query: str, limit: int = 20) -> list[dict]:
    q = (query or "").strip().lower()
    if not q:
        return all_drugs()[:limit]
    idx = _index()
    scored: list[tuple[int, dict]] = []
    for d in idx:
        name_l = d["name"].lower()
        if name_l.startswith(q):
            scored.append((0, d))
        elif d["generic"].lower().startswith(q):
            scored.append((1, d))
        elif q in d["_search"]:
            scored.append((2, d))
    scored.sort(key=lambda t: t[0])
    return [{k: v for k, v in d.items() if not k.startswith("_")} for _, d in scored[:limit]]
