from typing import Optional
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.audit_log import log_event
from app.core.security import require_roles, ALL_STAFF, CLINICAL
from app.seed import ACUTE_ORDERS

router = APIRouter(tags=["acute_orders"])


class BucketEnum(str, Enum):
    pending    = "Pending"
    processing = "Processing"
    dispatched = "Dispatched"
    delivered  = "Delivered"
    cancelled  = "Cancelled"


class OrderPatch(BaseModel):
    bucket: Optional[BucketEnum] = None
    notes: Optional[str] = Field(None, max_length=500)


@router.get("/acute-orders")
def list_acute_orders(
    bucket: Optional[str] = Query(None, description="Filter by bucket/status"),
    current_user: dict = Depends(require_roles(*ALL_STAFF)),
):
    data = ACUTE_ORDERS
    if bucket:
        data = [o for o in data if o["bucket"].lower() == bucket.lower()]
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
