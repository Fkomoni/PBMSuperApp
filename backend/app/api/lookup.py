from fastapi import APIRouter, Depends, Query

from app.core.security import current_provider

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
async def diagnoses(q: str = Query(default="", min_length=0)):
    """ICD-10 search. TODO: back with the diagnoses table in the DB."""
    seed = [
        {"code": "I10", "name": "Essential (primary) hypertension"},
        {"code": "E11.9", "name": "Type 2 diabetes mellitus without complications"},
        {"code": "J45.909", "name": "Unspecified asthma, uncomplicated"},
        {"code": "N18.3", "name": "Chronic kidney disease, stage 3"},
        {"code": "K21.0", "name": "Gastro-oesophageal reflux disease with oesophagitis"},
        {"code": "F32.9", "name": "Major depressive disorder, single episode, unspecified"},
        {"code": "M54.5", "name": "Low back pain"},
        {"code": "R51", "name": "Headache"},
    ]
    q = (q or "").lower()
    if not q:
        return seed
    return [d for d in seed if q in d["code"].lower() or q in d["name"].lower()]


@router.get("/address-autocomplete")
async def address_autocomplete(input: str = Query(...)):
    """Google Places autocomplete. TODO: proxy to Google Maps Places API."""
    if len(input.strip()) < 3:
        return []
    return [
        {"place_id": "stub-1", "description": f"{input} Street, Lagos, Nigeria", "main_text": f"{input} Street", "secondary_text": "Lagos, Nigeria"},
        {"place_id": "stub-2", "description": f"{input} Close, Victoria Island, Lagos", "main_text": f"{input} Close", "secondary_text": "Victoria Island, Lagos"},
    ]


@router.get("/address-details")
async def address_details(place_id: str = Query(...)):
    """Google Geocoding. TODO: proxy to Google Maps."""
    return {"place_id": place_id, "formatted_address": "1 Marina Road, Lagos, Nigeria", "lat": 6.4550575, "lng": 3.3841664}
