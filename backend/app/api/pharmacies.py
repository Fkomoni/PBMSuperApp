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


def _unwrap_list(payload: Any) -> list[dict]:
    """Walk common envelope shapes to find the first list[dict]."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        # Direct keys first
        for k in ("data", "Data", "result", "Result", "items", "Items"):
            v = payload.get(k)
            if isinstance(v, list):
                return v
        # Stoplight wraps: {"responses": {"200": {"data": [...]}}}
        for outer in ("responses", "Responses"):
            if isinstance(payload.get(outer), dict):
                for code, inner in payload[outer].items():
                    got = _unwrap_list(inner)
                    if got:
                        return got
        # Single-value wrapper {"value": {...}}
        if isinstance(payload.get("value"), (list, dict)):
            got = _unwrap_list(payload["value"])
            if got:
                return got
    return []


async def _fetch_in_state(state: str, lga: str | None) -> list[dict]:
    """Ask Wella. Normalize the shape. Trim to pharmacies with a usable code."""
    if lga:
        raw = await wellahealth.pharmacies_in_lga(state, lga, page_size=200)
    else:
        raw = await wellahealth.pharmacies_in_state(state, page_size=200)
    items = _unwrap_list(raw)
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
    # Wella returns {stateOfPremise, lgas: [...]} but may wrap it; try several
    lgas_candidate = None
    if isinstance(raw, dict):
        lgas_candidate = raw.get("lgas") or raw.get("Lgas") or raw.get("LGAs")
        if lgas_candidate is None:
            # One level deeper — e.g. {"data": {"lgas": [...]}}
            for k in ("data", "Data", "result", "Result"):
                inner = raw.get(k)
                if isinstance(inner, dict):
                    lgas_candidate = inner.get("lgas") or inner.get("Lgas") or inner.get("LGAs")
                    if lgas_candidate:
                        break
                elif isinstance(inner, list):
                    lgas_candidate = inner
                    break
    lgas = sorted({str(x) for x in (lgas_candidate or []) if x})
    _LGA_CACHE[key] = (now, lgas)
    return {"ok": True, "state": state, "lgas": lgas}
