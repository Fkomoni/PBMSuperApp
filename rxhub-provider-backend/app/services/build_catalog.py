"""One-off generator: reads the Leadway Wefill tariff xlsx and emits a
clean Python data file (drug_catalog_data.py) the backend loads at import.

Run once locally (or when the tariff is updated):

    cd backend
    python -m app.services.build_catalog   # expects xlsx in repo root

Layout of each emitted tuple:
    (drug_id, name, generic, form, strength, unit_price, classification)
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

import openpyxl

XLSX_NAME = "Leadway Wefill Tariff wo brand (Jan 2026) REVIEWED (1) (1).xlsx"
OUT_PATH = Path(__file__).resolve().parent / "drug_catalog_data.py"


# DrugClass -> our routing cohort.
# fertility is a sub-category of HORMONAL, detected by drug-name keyword.
CLASS_MAP = {
    # chronic
    "ANTI-HYPERTENSIVE": "chronic",
    "ANTI-DIABETIC":     "chronic",
    "CARDIOVASCULAR":    "chronic",
    "NEUROLOGIC":        "chronic",
    "GASTROINTESTINAL":  "chronic",
    "Gastrointestinal":  "chronic",
    "ANTI-ULCER":        "chronic",
    "RESPIRATORY":       "chronic",
    "INHALER":           "chronic",
    "ANTIPLATELET":      "chronic",
    # acute
    "ANTIBIOTIC":        "acute",
    "ANTIMALARIAL":      "acute",
    "ANALGESIC":         "acute",
    "analgesic":         "acute",
    "ANTIFUNGAL":        "acute",
    "ANTIVIRAL":         "acute",
    "ANTACID":           "acute",
    "ANTI-INFLAMMATORY": "acute",
    "ANTI-ALLERGY":      "acute",
    "COUGH AND COLD":    "acute",
    "ANTHELMINTIC":      "acute",
    "ANTI-PARASITIC":    "acute",
    "ANTIPYRETIC":       "acute",
    "ANAESTHETIC":       "acute",
    "OPTHALMIC":         "acute",
    "SUPPLEMENT":        "acute",
    "CONSUMABLES":       "acute",
    "OTHERS":            "acute",
    "TOPICAL":           "acute",
    "MEDICAL AID":       "acute",
    "MEDICAL DEVICE":    "acute",
    "IV FLUIDS":         "acute",
    "UROLOGIC":          "acute",
    # hormonal (fertility overrides below)
    "HORMONAL":          "hormonal",
    "SEXUAL HEALTH":     "hormonal",
    # cancer
    "CHEMOTHERAPEUTIC":  "cancer",
    # autoimmune
    "STEROID":           "autoimmune",
    "IMMUNOLOGICAL":     "autoimmune",
}

FERTILITY_KEYWORDS = (
    "CLOMID", "CLOMIPHENE", "CYCLOGEST", "DUPHASTON", "PROGESTERONE",
    "GONAL", "PREGNYL", "BRAVELLE", "FOLLITROPIN", "MENOTROPIN", "HCG",
    "NAMET",  # NAMET is branded clomiphene
)


FORM_NORMALIZE = {
    "TABLETS":  "Tablet",
    "CAPSULES": "Capsule",
    "SYRUP":    "Syrup",
    "SUSPENSION": "Suspension",
    "INJECTION":  "Injection",
    "INFUSION":   "Infusion",
    "EYE DROP":   "Drops",
    "EYE OINTMENT":"Ointment",
    "EAR DROP":   "Drops",
    "EYE/EAR DROP":"Drops",
    "EARDROP":    "Drops",
    "NASAL DROP": "Drops",
    "NASAL SPRAY": "Spray",
    "NASAL INHALER": "Inhaler",
    "DROPS":      "Drops",
    "CREAM":      "Cream",
    "LOTION":     "Lotion",
    "GEL":        "Gel",
    "OINTMENT":   "Ointment",
    "SPRAY":      "Spray",
    "POWDER":     "Powder",
    "POWDER SPRAY": "Spray",
    "PATCH":      "Patch",
    "PESSARY":    "Pessary",
    "SUPPOSITORY":"Suppository",
    "LOZENGES":   "Lozenge",
    "SOLUTION":   "Solution",
    "INHALER":    "Inhaler",
    "INHALATION SOLUTION": "Inhalation Solution",
    "SC INJECTION": "SC Injection",
    "INTRAVENOUS (IV)": "IV Injection",
    "FACE WASH":  "Face Wash",
    "EMULSION":   "Emulsion",
    "GRANULES":   "Granules",
    "ORAL DROP":  "Drops",
    "CAPLETS":    "Caplet",
    "NIL":        "",
}


def _normalize_form(s):
    if s is None:
        return ""
    s = str(s).strip()
    return FORM_NORMALIZE.get(s.upper(), s.title())


def _clean_name(raw: str) -> str:
    """Keep the brand + strength; drop trailing pack sizes like "X10"."""
    s = raw.strip()
    # Collapse repeated spaces; title-case most common casing
    s = re.sub(r"\s+", " ", s)
    # Strip pack markers at the end: " X10", " X 20", " X30" etc.
    s = re.sub(r"\s*X\s*\d+\s*$", "", s, flags=re.IGNORECASE)
    return s


def _guess_generic(name: str) -> str:
    """First token of the (usually brand-prefixed) name — not perfect but
    gives a usable fallback if no mapping is available.
    """
    parts = re.split(r"[ \-/(]", name, maxsplit=1)
    return (parts[0] or "").title()


def _to_cohort(drug_class: str | None, name: str) -> str | None:
    if not drug_class:
        return None
    mapped = CLASS_MAP.get(drug_class)
    if mapped == "hormonal":
        up = name.upper()
        if any(k in up for k in FERTILITY_KEYWORDS):
            return "fertility"
    return mapped


def parse(xlsx_path: Path) -> list[tuple]:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True, read_only=True)
    ws = wb.worksheets[0]
    seen: set[str] = set()
    out: list[tuple] = []
    drug_id = 0
    for row in ws.iter_rows(values_only=True):
        name_raw, drug_price, unit_price, pack, form, strength, drug_class, *_ = row
        if not name_raw or not isinstance(name_raw, str):
            continue
        if name_raw == "TariffDrugName":
            continue  # header
        cohort = _to_cohort(drug_class, name_raw)
        if not cohort:
            continue  # skip rows we can't place
        name = _clean_name(name_raw)
        if not name or name.upper() in seen:
            continue
        seen.add(name.upper())

        drug_id += 1
        out.append((
            drug_id,
            name,
            _guess_generic(name),
            _normalize_form(form),
            (strength or "").strip() if isinstance(strength, str) else "",
            round(float(unit_price), 2) if isinstance(unit_price, (int, float)) else None,
            cohort,
        ))
    return out


def emit(rows: list[tuple], out_path: Path) -> None:
    lines = [
        '"""Auto-generated from the Leadway Wefill tariff xlsx.',
        "",
        "Regenerate with: python -m app.services.build_catalog",
        "Do not edit by hand.",
        '"""',
        "",
        "# (drug_id, name, generic, form, strength, unit_price, classification)",
        "CATALOG: list[tuple] = [",
    ]
    for r in rows:
        did, name, gen, form, strength, price, cohort = r
        lines.append(
            f'    ({did}, {name!r}, {gen!r}, {form!r}, {strength!r}, '
            f'{price!r}, {cohort!r}),'
        )
    lines.append("]")
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    # xlsx lives in repo root (two levels up from this file)
    repo_root = Path(__file__).resolve().parents[3]
    xlsx = repo_root / XLSX_NAME
    if not xlsx.exists():
        raise SystemExit(f"xlsx not found at {xlsx}")
    rows = parse(xlsx)
    from collections import Counter
    counts = Counter(r[6] for r in rows)
    emit(rows, OUT_PATH)
    print(f"wrote {len(rows)} drugs -> {OUT_PATH}")
    for k, v in counts.most_common():
        print(f"  {v:5d}  {k}")


if __name__ == "__main__":
    main()
