from fastapi import APIRouter, Depends

from app.core.security import require_roles, LOGISTICS
from app.seed import RIDERS

router = APIRouter(tags=["riders"])


@router.get("/riders")
def list_riders(current_user: dict = Depends(require_roles(*LOGISTICS))):
    return RIDERS
