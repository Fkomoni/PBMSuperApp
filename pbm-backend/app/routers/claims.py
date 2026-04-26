from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.seed import CLAIMS

router = APIRouter(tags=["claims"])


@router.get("/claims")
def list_claims(current_user: dict = Depends(get_current_user)):
    return CLAIMS
