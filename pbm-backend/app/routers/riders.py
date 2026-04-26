from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.seed import RIDERS

router = APIRouter(tags=["riders"])


@router.get("/riders")
def list_riders(current_user: dict = Depends(get_current_user)):
    return RIDERS
