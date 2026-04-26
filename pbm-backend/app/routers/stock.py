from fastapi import APIRouter, Depends
from typing import List
from pydantic import BaseModel

from app.core.security import get_current_user
from app.seed import DRUGS, SCHEME_RULES

router = APIRouter(tags=["stock"])


@router.get("/stock")
def list_stock(current_user: dict = Depends(get_current_user)):
    return DRUGS


@router.get("/drugs")
def list_drugs(current_user: dict = Depends(get_current_user)):
    return DRUGS


class DrugUpdate(BaseModel):
    id: int
    unit_price: float


@router.put("/drugs/bulk-update")
def bulk_update_drugs(updates: List[DrugUpdate], current_user: dict = Depends(get_current_user)):
    updated = {u.id: u.unit_price for u in updates}
    for d in DRUGS:
        if d["id"] in updated:
            d["unit_price"] = updated[d["id"]]
    return {"updated": len(updates)}


@router.get("/scheme-rules")
def list_scheme_rules(current_user: dict = Depends(get_current_user)):
    return SCHEME_RULES
