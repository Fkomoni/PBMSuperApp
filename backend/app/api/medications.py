from fastapi import APIRouter, Depends, Query

from app.core.security import current_provider
from app.services import drug_catalog

router = APIRouter(prefix="/medications", tags=["medications"], dependencies=[Depends(current_provider)])


@router.get("/search")
async def search(q: str = Query(..., min_length=1), limit: int = Query(default=20, ge=1, le=100)):
    """Drug autocomplete backed by the Nigerian formulary catalog in
    app.services.drug_catalog.

    WellaHealth's Fulfilments POST accepts free-form drug objects
    (no server-side drug ID registry), so this catalog is the source of
    truth for what a provider can pick. Each result carries:

        drug_id        integer (stable in-catalog id; sent as drugs[].id to Wella)
        name           brand + strength, e.g. "Amlodipine 10mg (Norvasc)"
        generic        INN name
        form           Tablet / Capsule / Syrup / Injection / Inhaler / ...
        strength       e.g. "10mg", "80/480mg", "100IU/ml"
        unit_price     indicative NGN per unit (None if unknown)
        classification acute | chronic | hormonal | cancer | autoimmune | fertility
    """
    return drug_catalog.search(q, limit=limit)
