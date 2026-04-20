"""Thin wrapper over Google Places / Geocoding. Falls back to inline stubs if
no API key is configured, so the frontend wizard always works in dev.
"""
from __future__ import annotations

import httpx

from app.core.config import settings

_TIMEOUT = httpx.Timeout(6.0, connect=3.0)


async def autocomplete(query: str) -> list[dict]:
    key = settings.google_maps_api_key
    if not key:
        return _stub_autocomplete(query)
    url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    params = {"input": query, "key": key, "components": "country:ng"}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()
    return [
        {
            "place_id": p.get("place_id"),
            "description": p.get("description"),
            "main_text": (p.get("structured_formatting") or {}).get("main_text"),
            "secondary_text": (p.get("structured_formatting") or {}).get("secondary_text"),
        }
        for p in data.get("predictions", [])
    ]


async def details(place_id: str) -> dict:
    key = settings.google_maps_api_key
    if not key:
        return _stub_details(place_id)
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {"place_id": place_id, "key": key, "fields": "formatted_address,geometry,address_components"}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json().get("result") or {}
    loc = (data.get("geometry") or {}).get("location") or {}
    components = data.get("address_components") or []
    return {
        "place_id": place_id,
        "formatted_address": data.get("formatted_address"),
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "components": components,
        # Convenience extracts — Nigeria maps state to
        # administrative_area_level_1 and LGA to _level_2.
        "state": _extract(components, "administrative_area_level_1"),
        "lga":   _extract(components, "administrative_area_level_2"),
    }


def _extract(components: list[dict], wanted_type: str) -> str | None:
    for c in components or []:
        if wanted_type in (c.get("types") or []):
            return c.get("long_name") or c.get("short_name")
    return None


def _stub_autocomplete(query: str) -> list[dict]:
    if len((query or "").strip()) < 3:
        return []
    return [
        {"place_id": "stub-1", "description": f"{query} Street, Lagos, Nigeria", "main_text": f"{query} Street", "secondary_text": "Lagos, Nigeria"},
        {"place_id": "stub-2", "description": f"{query} Close, Victoria Island, Lagos", "main_text": f"{query} Close", "secondary_text": "Victoria Island, Lagos"},
        {"place_id": "stub-3", "description": f"{query} Road, Abuja, Nigeria", "main_text": f"{query} Road", "secondary_text": "Abuja, Nigeria"},
    ]


def _stub_details(place_id: str) -> dict:
    return {
        "place_id": place_id,
        "formatted_address": "1 Marina Road, Lagos, Nigeria",
        "lat": 6.4550575,
        "lng": 3.3841664,
        "components": None,
        "state": "Lagos",
        "lga": "Lagos Island",
    }
