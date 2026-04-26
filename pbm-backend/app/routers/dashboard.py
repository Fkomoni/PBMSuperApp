from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.seed import ENROLLEES, ACUTE_ORDERS, CLAIMS, DRUGS, RIDERS, PARTNERS

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def get_dashboard(current_user: dict = Depends(get_current_user)):
    total_enrollees   = len(ENROLLEES)
    active_enrollees  = sum(1 for e in ENROLLEES if e["status"] == "Active")
    pending_orders    = sum(1 for o in ACUTE_ORDERS if o["bucket"] == "Pending")
    dispatched_orders = sum(1 for o in ACUTE_ORDERS if o["bucket"] == "Dispatched")
    total_claims      = len(CLAIMS)
    approved_claims   = sum(1 for c in CLAIMS if c["status"] == "Approved")
    pending_claims    = sum(1 for c in CLAIMS if c["status"] == "Pending")
    low_stock_drugs   = sum(1 for d in DRUGS if d["stock_level"] <= d["reorder_level"])
    available_riders  = sum(1 for r in RIDERS if r["status"] == "Available")
    active_partners   = sum(1 for p in PARTNERS if p["active"])

    # Claims value
    total_claims_value = sum(c["amount_ngn"] for c in CLAIMS)
    approved_claims_value = sum(c["amount_ngn"] for c in CLAIMS if c["status"] == "Approved")

    # Region breakdown
    region_counts: dict = {}
    for e in ENROLLEES:
        region_counts[e["region"]] = region_counts.get(e["region"], 0) + 1

    return {
        "enrollees": {
            "total": total_enrollees,
            "active": active_enrollees,
            "by_region": region_counts,
        },
        "acute_orders": {
            "pending": pending_orders,
            "dispatched": dispatched_orders,
            "total": len(ACUTE_ORDERS),
        },
        "claims": {
            "total": total_claims,
            "approved": approved_claims,
            "pending": pending_claims,
            "total_value_ngn": total_claims_value,
            "approved_value_ngn": approved_claims_value,
        },
        "stock": {
            "total_drugs": len(DRUGS),
            "low_stock_count": low_stock_drugs,
        },
        "riders": {
            "total": len(RIDERS),
            "available": available_riders,
        },
        "partners": {
            "total": len(PARTNERS),
            "active": active_partners,
        },
    }
