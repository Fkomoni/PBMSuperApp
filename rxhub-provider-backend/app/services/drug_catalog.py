"""Drug catalog — real Leadway Wefill tariff loaded from the generated
drug_catalog_data.py. Source xlsx lives in the repo root; regenerate
the data file with `python -m app.services.build_catalog` when the
tariff is updated.

WellaHealth's Fulfilments POST accepts free-form drugs (no catalog
endpoint), so this catalog is the source of truth for provider
autocomplete. Each row carries:

    drug_id         integer (stable within a generation; sent as
                    drugs[].id to Wella)
    name            brand + strength, e.g. "Amlodipine 10mg Tabs"
    generic         best-guess generic (first token of name); use the
                    full name for matching — generic is a display aid
    form            Tablet / Capsule / Syrup / Injection / Inhaler / …
    strength        "10mg", "80/480mg", "100IU/ml", …
    unit_price      NGN per unit from the tariff (None when missing)
    classification  acute | chronic | hormonal | cancer | autoimmune |
                    fertility  (drives the routing matrix)
"""
from __future__ import annotations

from functools import lru_cache

from app.services.drug_catalog_data import CATALOG as _CATALOG


@lru_cache(maxsize=1)
def _index() -> list[dict]:
    return [
        {
            "drug_id":        did,
            "name":           name,
            "generic":        gen,
            "form":           form,
            "strength":       strength,
            "unit_price":     unit_price,
            "classification": classification,
            "_search":        (name + " " + gen + " " + form + " " + (strength or "")).lower(),
        }
        for did, name, gen, form, strength, unit_price, classification in _CATALOG
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
