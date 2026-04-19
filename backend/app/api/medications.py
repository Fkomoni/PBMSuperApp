from fastapi import APIRouter, Depends, Query

from app.core.security import current_provider

router = APIRouter(prefix="/medications", tags=["medications"], dependencies=[Depends(current_provider)])


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    """Drug search backed by WellaHealth tariff + local drug_master.

    TODO: query the drug_master table and fall back to WellaHealth tariff
    (see settings.wellahealth_base_url).
    """
    seed = [
        {"drug_id": "D-AMLO-10", "name": "Amlodipine 10mg (Norvasc)", "generic": "Amlodipine", "unit_price": 42, "classification": "chronic"},
        {"drug_id": "D-AMLO-5", "name": "Amlodipine 5mg (Norvasc)", "generic": "Amlodipine", "unit_price": 28, "classification": "chronic"},
        {"drug_id": "D-MET-500", "name": "Metformin 500mg (Glucophage)", "generic": "Metformin", "unit_price": 16, "classification": "chronic"},
        {"drug_id": "D-AUG-625", "name": "Augmentin 625mg", "generic": "Amoxicillin/Clavulanate", "unit_price": 350, "classification": "acute"},
        {"drug_id": "D-ARTE-20", "name": "Coartem 20/120mg", "generic": "Artemether/Lumefantrine", "unit_price": 2500, "classification": "acute"},
        {"drug_id": "D-PARA-500", "name": "Paracetamol 500mg", "generic": "Paracetamol", "unit_price": 5, "classification": "acute"},
        {"drug_id": "D-TAMOX-20", "name": "Tamoxifen 20mg", "generic": "Tamoxifen", "unit_price": 180, "classification": "cancer"},
    ]
    ql = q.lower()
    return [d for d in seed if ql in d["name"].lower() or ql in d["generic"].lower()]
