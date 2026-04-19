from fastapi import APIRouter, Depends, Query

from app.core.security import current_provider
from app.services import icd10, places

router = APIRouter(prefix="/lookup", tags=["lookup"], dependencies=[Depends(current_provider)])


@router.get("/enrollee")
async def enrollee(enrollee_id: str = Query(..., alias="enrollee_id")):
    """Fetch enrollee details. TODO: call Prognosis enrollee lookup."""
    return {
        "enrollee_id": enrollee_id,
        "name": "Adaeze Okafor",
        "scheme": "Leadway Premium",
        "company": "Leadway Health",
        "age": 42,
        "phone": "08012345678",
        "email": "adaeze@example.com",
        "state": "Lagos",
        "status": "Active",
        "expiry_date": "2026-12-31",
        "flag": "green",
        "flag_reason": None,
        "vip": False,
        "medications": [
            {"name": "Amlodipine 10mg", "generic": "Amlodipine", "dosage": "10mg OD", "quantity": 30,
             "classification": "chronic", "next_refill": "2026-05-03"},
            {"name": "Metformin 500mg", "generic": "Metformin", "dosage": "500mg BD", "quantity": 60,
             "classification": "chronic", "next_refill": "2026-05-10"},
        ],
    }


@router.get("/diagnoses")
async def diagnoses(q: str = Query(default="", min_length=0), limit: int = Query(default=20, ge=1, le=100)):
    """Standard ICD-10 search backed by the embedded catalog in app.services.icd10."""
    return icd10.search(q, limit=limit)


@router.get("/address-autocomplete")
async def address_autocomplete(input: str = Query(...)):
    """Google Places autocomplete (Nigeria-scoped). Falls back to inline stubs
    when GOOGLE_MAPS_API_KEY is unset so the wizard works in dev.
    """
    return await places.autocomplete(input)


@router.get("/address-details")
async def address_details(place_id: str = Query(...)):
    """Google Place details + geometry. Same fallback behavior as autocomplete."""
    return await places.details(place_id)
