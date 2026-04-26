from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.core.security import get_current_user
from app.seed import ENROLLEES, CLAIMS

router = APIRouter(tags=["reports"])


def _group_by(items: list, key: str) -> dict:
    result: dict = {}
    for item in items:
        val = item.get(key, "Unknown")
        result[val] = result.get(val, 0) + 1
    return result


def _claims_by(key: str) -> dict:
    result: dict = {}
    for c in CLAIMS:
        val = c.get(key, "Unknown")
        if val not in result:
            result[val] = {"count": 0, "total_ngn": 0.0}
        result[val]["count"] += 1
        result[val]["total_ngn"] += c["amount_ngn"]
    return result


@router.get("/reports")
def get_reports(
    dim: Optional[str] = Query("state", description="Dimension: state | company | scheme"),
    current_user: dict = Depends(get_current_user),
):
    if dim == "state":
        return {
            "dimension": "state",
            "enrollees_by_region": _group_by(ENROLLEES, "region"),
            "claims_by_region": _claims_by("scheme"),  # region not on claims; proxy via scheme
        }
    elif dim == "company":
        return {
            "dimension": "company",
            "enrollees_by_company": _group_by(ENROLLEES, "company"),
        }
    elif dim == "scheme":
        return {
            "dimension": "scheme",
            "enrollees_by_scheme": _group_by(ENROLLEES, "scheme"),
            "claims_by_scheme": _claims_by("scheme"),
        }
    else:
        return {
            "dimension": dim,
            "message": "Unsupported dimension. Use state | company | scheme",
        }
