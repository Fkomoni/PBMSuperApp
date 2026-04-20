"""Partner-pharmacy lookup — proxies WellaHealth's pharmacy directory
with a short in-process TTL cache so repeated provider lookups don't hammer
their API.

Endpoints:
  GET /api/v1/pharmacies?state=Lagos              list all pharmacies in a state
  GET /api/v1/pharmacies?state=Lagos&lga=Surulere list pharmacies in an LGA
  GET /api/v1/pharmacies/lgas?state=Lagos         list every LGA Wella covers
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.security import current_provider
from app.services import wellahealth
from app.services.wellahealth import WellaHealthError

router = APIRouter(prefix="/pharmacies", tags=["pharmacies"], dependencies=[Depends(current_provider)])

# Cache { (state, lga or "*") : (fetched_at_epoch, [pharmacies]) }
_PCACHE: dict[tuple[str, str], tuple[float, list[dict]]] = {}
_LGA_CACHE: dict[str, tuple[float, list[str]]] = {}
_TTL_SECONDS = 3600  # refresh hourly


def _normalize(p: dict) -> dict:
    return {
        "pharmacy_code": p.get("pharmacyCode") or p.get("PharmacyCode"),
        "name":          p.get("pharmacyName") or p.get("PharmacyName"),
        "state":         p.get("state") or p.get("State"),
        "lga":           p.get("lga") or p.get("LGA"),
        "area":          p.get("area") or p.get("Area"),
        "address":       p.get("address") or p.get("Address"),
    }


async def _fetch_in_state(state: str, lga: str | None) -> list[dict]:
    """Ask Wella. Normalize the shape. Trim to pharmacies with a usable code."""
    if lga:
        raw = await wellahealth.pharmacies_in_lga(state, lga, page_size=50)
    else:
        raw = await wellahealth.pharmacies_in_state(state, page_size=50)
    items = raw.get("data") if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        return []
    return [p for p in (_normalize(x) for x in items) if p.get("pharmacy_code") and p.get("name")]


@router.get("")
async def list_pharmacies(
    state: str = Query(..., description="Nigerian state, e.g. Lagos"),
    lga: str | None = Query(default=None, description="Optional LGA — narrows list"),
    limit: int = Query(default=30, ge=1, le=100),
):
    key = (state.strip().lower(), (lga or "*").strip().lower())
    now = time.time()
    cached = _PCACHE.get(key)
    if cached and (now - cached[0] < _TTL_SECONDS):
        items = cached[1]
    else:
        try:
            items = await _fetch_in_state(state.strip(), (lga or "").strip() or None)
        except WellaHealthError as e:
            return {"ok": False, "error": str(e), "items": []}
        _PCACHE[key] = (now, items)
    return {"ok": True, "state": state, "lga": lga, "count": len(items), "items": items[:limit]}


@router.get("/lgas")
async def list_lgas(state: str = Query(...)):
    key = state.strip().lower()
    now = time.time()
    cached = _LGA_CACHE.get(key)
    if cached and (now - cached[0] < _TTL_SECONDS):
        return {"ok": True, "state": state, "lgas": cached[1]}
    try:
        raw = await wellahealth.lgas_in_state(state.strip())
    except WellaHealthError as e:
        return {"ok": False, "error": str(e), "lgas": []}
    lgas: list[str] = raw.get("lgas") if isinstance(raw, dict) else []
    if not isinstance(lgas, list):
        lgas = []
    lgas = sorted({str(x) for x in lgas if x})
    _LGA_CACHE[key] = (now, lgas)
    return {"ok": True, "state": state, "lgas": lgas}
