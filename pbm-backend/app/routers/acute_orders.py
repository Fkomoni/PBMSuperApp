from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from typing import Optional

from app.core.security import get_current_user
from app.seed import ACUTE_ORDERS

router = APIRouter(tags=["acute_orders"])


class OrderPatch(BaseModel):
    bucket: Optional[str] = None
    notes: Optional[str] = None


@router.get("/acute-orders")
def list_acute_orders(
    bucket: Optional[str] = Query(None, description="Filter by bucket/status"),
    current_user: dict = Depends(get_current_user),
):
    data = ACUTE_ORDERS
    if bucket:
        data = [o for o in data if o["bucket"].lower() == bucket.lower()]
    return data


@router.patch("/acute-orders/{order_id}")
def patch_acute_order(
    order_id: str,
    body: OrderPatch,
    current_user: dict = Depends(get_current_user),
):
    order = next((o for o in ACUTE_ORDERS if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    if body.bucket is not None:
        order["bucket"] = body.bucket
    if body.notes is not None:
        order["notes"] = body.notes
    return order
