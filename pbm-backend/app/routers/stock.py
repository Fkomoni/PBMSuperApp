from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.seed import DRUGS

router = APIRouter(tags=["stock"])


@router.get("/stock")
def list_stock(current_user: dict = Depends(get_current_user)):
    return DRUGS
