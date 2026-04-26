from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.audit_log import log_event
from app.core.security import require_roles, ALL_STAFF, ADMIN_ONLY
from app.seed import DRUGS, SCHEME_RULES

router = APIRouter(tags=["stock"])


@router.get("/stock")
def list_stock(current_user: dict = Depends(require_roles(*ALL_STAFF))):
    return DRUGS


@router.get("/drugs")
def list_drugs(current_user: dict = Depends(require_roles(*ALL_STAFF))):
    return DRUGS


class DrugUpdate(BaseModel):
    id: str
    unit_price: float = Field(..., gt=0, lt=10_000_000)


@router.put("/drugs/bulk-update")
def bulk_update_drugs(
    updates: List[DrugUpdate],
    current_user: dict = Depends(require_roles(*ADMIN_ONLY)),
):
    updated_map = {u.id: u.unit_price for u in updates}
    count = 0
    for d in DRUGS:
        if d["id"] in updated_map:
            d["price_ngn"] = updated_map[d["id"]]
            count += 1
    log_event("UPDATE_TARIFF", current_user, "stock/bulk-update", f"{count} drug(s) repriced")
    return {"updated": count}


@router.get("/scheme-rules")
def list_scheme_rules(current_user: dict = Depends(require_roles(*ALL_STAFF))):
    return SCHEME_RULES
