import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.rate_limit import check_and_consume
from app.core.security import current_provider
from app.services import icd10, places, prognosis
from app.services.prognosis import PrognosisAuthError

logger = logging.getLogger(__name__)
phi_audit = logging.getLogger("rxhub.phi-audit")

router = APIRouter(prefix="/lookup", tags=["lookup"], dependencies=[Depends(current_provider)])


def _hash(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()[:12]


@router.get("/enrollee")
async def enrollee(
    enrollee_id: str = Query(..., alias="enrollee_id", min_length=1, max_length=64),
    provider: dict = Depends(current_provider),
):
    """Verify enrollee against Prognosis. Requires PROGNOSIS_USERNAME /
    PASSWORD. Falls back to a stub in dev when those aren't configured so
    the frontend flow can still be clicked through.

    Emits a structured audit log on every call so PHI reads are attributable
    to a specific provider_id. We deliberately do NOT log the raw enrollee
    id — only a short SHA-256 fingerprint — so logs aren't themselves PHI.
    Rate limited per-provider to make bulk enumeration expensive.
    """
    pid = provider.get("sub") or "unknown"
    ok, retry = check_and_consume(f"enrollee:provider:{pid}", limit=60, window_seconds=60)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many enrollee lookups — please slow down",
            headers={"Retry-After": str(retry)},
        )
    phi_audit.info(
        "enrollee_lookup provider=%s enrollee_fp=%s", pid, _hash(enrollee_id)
    )

    if (settings.prognosis_username and settings.prognosis_password) or settings.prognosis_auth_header:
        try:
            data = await prognosis.verify_enrollee(enrollee_id)
        except PrognosisAuthError as e:
            logger.warning("Prognosis verify failed: %s", e)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Prognosis verify failed: {e}")
        if data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Enrollee '{enrollee_id}' not found on Prognosis")
        return data

    # Dev fallback (no Prognosis credentials set).
    return {
        "enrollee_id": enrollee_id,
        "name": "Adaeze Okafor",
        "scheme": "Leadway Premium",
        "company": "Leadway Health",
        "age": 42,
        "phone": "08012345678",
        "email": "adaeze@example.com",
        "state": "Lagos",
        "status": "Active",
        "expiry_date": "2026-12-31",
        "flag": "green",
        "flag_reason": None,
        "vip": False,
        "medications": [
            {"name": "Amlodipine 10mg", "generic": "Amlodipine", "dosage": "10mg OD", "quantity": 30,
             "classification": "chronic", "next_refill": "2026-05-03"},
            {"name": "Metformin 500mg", "generic": "Metformin", "dosage": "500mg BD", "quantity": 60,
             "classification": "chronic", "next_refill": "2026-05-10"},
        ],
    }


@router.get("/diagnoses")
async def diagnoses(q: str = Query(default="", min_length=0), limit: int = Query(default=20, ge=1, le=100)):
    """Standard ICD-10 search backed by the embedded catalog in app.services.icd10."""
    return icd10.search(q, limit=limit)


@router.get("/address-autocomplete")
async def address_autocomplete(
    input: str = Query(..., min_length=1, max_length=200),
    provider: dict = Depends(current_provider),
):
    """Google Places autocomplete (Nigeria-scoped). Falls back to inline stubs
    when GOOGLE_MAPS_API_KEY is unset so the wizard works in dev.
    Rate limited per-provider so a compromised token can't burn the Google
    Places quota or be used as an SSRF-style query amplifier.
    """
    pid = provider.get("sub") or "unknown"
    ok, retry = check_and_consume(f"places-ac:{pid}", limit=120, window_seconds=60)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Address autocomplete rate limit",
            headers={"Retry-After": str(retry)},
        )
    return await places.autocomplete(input)


@router.get("/address-details")
async def address_details(
    place_id: str = Query(..., min_length=1, max_length=200),
    provider: dict = Depends(current_provider),
):
    """Google Place details + geometry. Same fallback behavior as autocomplete."""
    pid = provider.get("sub") or "unknown"
    ok, retry = check_and_consume(f"places-det:{pid}", limit=120, window_seconds=60)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Address details rate limit",
            headers={"Retry-After": str(retry)},
        )
    return await places.details(place_id)
