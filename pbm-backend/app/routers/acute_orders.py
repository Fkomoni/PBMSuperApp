from datetime import datetime, timezone
from typing import Optional
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.audit_log import log_event
from app.core.security import require_roles, ALL_STAFF, CLINICAL
from app.seed import ACUTE_ORDERS, CLAIMS, DRUGS, ENROLLEES, RIDERS

router = APIRouter(tags=["acute_orders"])


class BucketEnum(str, Enum):
    pending        = "Pending"
    processing     = "Processing"
    dispatched     = "Dispatched"
    delivered      = "Delivered"
    cancelled      = "Cancelled"
    awaiting_claim = "Awaiting Claim"


class OrderPatch(BaseModel):
    bucket: Optional[BucketEnum] = None
    notes: Optional[str] = Field(None, max_length=500)


class AssignRiderBody(BaseModel):
    rider_id: str


class SubmitClaimBody(BaseModel):
    partner_id: str
    amount_ngn: Optional[float] = Field(None, gt=0)


@router.get("/acute-orders")
def list_acute_orders(
    bucket: Optional[str] = Query(None, description="Filter by bucket/status"),
    region: Optional[str] = Query(None, description="'lagos', 'outside', or exact region name"),
    current_user: dict = Depends(require_roles(*ALL_STAFF)),
):
    data = ACUTE_ORDERS
    if bucket:
        data = [o for o in data if o["bucket"].lower() == bucket.lower()]
    if region:
        if region.lower() == "outside":
            data = [o for o in data if o["region"].lower() != "lagos"]
        else:
            data = [o for o in data if o["region"].lower() == region.lower()]
    return data


@router.patch("/acute-orders/{order_id}")
def patch_acute_order(
    order_id: str,
    body: OrderPatch,
    current_user: dict = Depends(require_roles(*CLINICAL)),
):
    order = next((o for o in ACUTE_ORDERS if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    if body.bucket is not None:
        order["bucket"] = body.bucket.value
    if body.notes is not None:
        order["notes"] = body.notes
    log_event("UPDATE_ORDER", current_user, f"order/{order_id}", f"bucket={order['bucket']}")
    return order


@router.post("/acute-orders/{order_id}/assign-rider")
def assign_rider(
    order_id: str,
    body: AssignRiderBody,
    current_user: dict = Depends(require_roles(*CLINICAL)),
):
    """Assign a rider → order moves to Awaiting Claim (held until Submit or Unpack)."""
    order = next((o for o in ACUTE_ORDERS if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    if order["bucket"] not in ("Pending", "Processing"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot assign a rider to an order in '{order['bucket']}' status.",
        )

    rider = next((r for r in RIDERS if r["id"] == body.rider_id), None)
    if not rider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rider not found.")
    if rider["status"] == "Off Duty":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Rider is off duty.")

    now = datetime.now(timezone.utc).isoformat()
    order["rider_id"]   = rider["id"]
    order["rider_name"] = rider["name"]
    order["assigned_at"] = now
    order["bucket"]     = "Awaiting Claim"
    rider["status"]     = "On Delivery"

    log_event(
        "ASSIGN_RIDER", current_user, f"order/{order_id}",
        f"Rider {rider['name']} assigned → Awaiting Claim",
    )
    return order


@router.post("/acute-orders/{order_id}/unpack")
def unpack_order(
    order_id: str,
    current_user: dict = Depends(require_roles(*CLINICAL)),
):
    """Return an Awaiting Claim order to Pending and release the rider."""
    order = next((o for o in ACUTE_ORDERS if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    if order["bucket"] != "Awaiting Claim":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only 'Awaiting Claim' orders can be unpacked (current: '{order['bucket']}').",
        )

    # Release rider
    if order["rider_id"]:
        rider = next((r for r in RIDERS if r["id"] == order["rider_id"]), None)
        if rider:
            rider["status"] = "Available"

    order["bucket"]      = "Pending"
    order["rider_id"]    = None
    order["rider_name"]  = None
    order["assigned_at"] = None

    log_event("UNPACK_ORDER", current_user, f"order/{order_id}", "Returned to Pending; rider released")
    return order


@router.post("/acute-orders/{order_id}/submit-claim")
def submit_claim(
    order_id: str,
    body: SubmitClaimBody,
    current_user: dict = Depends(require_roles(*CLINICAL)),
):
    """Submit the claim for an Awaiting Claim order → creates CLAIMS entry, marks Delivered."""
    order = next((o for o in ACUTE_ORDERS if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    if order["bucket"] != "Awaiting Claim":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only 'Awaiting Claim' orders can be submitted (current: '{order['bucket']}').",
        )

    # Auto-price if not supplied: drug unit price × quantity
    amount = body.amount_ngn
    if amount is None:
        drug_rec = next((d for d in DRUGS if d["name"] == order["drug"]), None)
        amount = round((drug_rec["price_ngn"] if drug_rec else 0) * order["quantity"], 2)

    # Find enrollee scheme for the claim record
    enrollee = next((e for e in ENROLLEES if e["id"] == order["enrollee_id"]), None)
    scheme = enrollee["scheme"] if enrollee else "Unknown"

    now = datetime.now(timezone.utc)
    claim_id = f"c{len(CLAIMS) + 1:03d}"
    claim = {
        "id":            claim_id,
        "enrollee_id":   order["enrollee_id"],
        "enrollee_name": order["enrollee_name"],
        "partner_id":    body.partner_id,
        "amount_ngn":    amount,
        "status":        "Pending",
        "drug":          order["drug"],
        "date":          now.date().isoformat(),
        "scheme":        scheme,
        "source_order":  order_id,          # traceability back to the acute order
    }
    CLAIMS.append(claim)

    # Stamp the order and close it
    order["bucket"]     = "Delivered"
    order["claim_id"]   = claim_id
    order["partner_id"] = body.partner_id
    order["amount_ngn"] = amount

    log_event(
        "SUBMIT_CLAIM", current_user, f"order/{order_id}",
        f"Claim {claim_id} created for {order['drug']} — ₦{amount:,.2f}",
    )
    return {"order": order, "claim": claim}
