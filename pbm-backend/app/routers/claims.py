from fastapi import APIRouter, Depends

from app.core.security import require_roles, FINANCE
from app.seed import CLAIMS

router = APIRouter(tags=["claims"])


@router.get("/claims")
def list_claims(current_user: dict = Depends(require_roles(*FINANCE))):
    return CLAIMS
