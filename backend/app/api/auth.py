from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.passwords import hash_password, verify_password
from app.core.security import create_access_token
from app.models import Provider
from app.schemas.provider import LoginIn, LoginOut, ProviderOut, ProviderRegisterIn

router = APIRouter(tags=["auth"])


def _to_out(p: Provider) -> ProviderOut:
    return ProviderOut(
        provider_id=p.id,
        name=p.name,
        email=p.email,
        prognosis_id=p.prognosis_id,
        facility=p.facility,
    )


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn, db: Session = Depends(get_db)):
    p = db.scalar(select(Provider).where(Provider.email == body.email.lower()))
    if not p or not p.is_active or not verify_password(body.password, p.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(
        subject=p.id,
        extra={"role": "provider", "email": p.email, "name": p.name},
    )
    return LoginOut(token=token, expires_in=settings.jwt_ttl_hours * 3600, provider=_to_out(p))


@router.post("/providers/register", response_model=ProviderOut, status_code=status.HTTP_201_CREATED)
async def register(body: ProviderRegisterIn, db: Session = Depends(get_db)):
    """Open registration is fine in staging. In production, gate this behind an
    admin-only API key (add a header check here) or disable and create providers
    via the `seed_provider` CLI below.
    """
    existing = db.scalar(select(Provider).where(Provider.email == body.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    p = Provider(
        email=body.email.lower(),
        name=body.name,
        password_hash=hash_password(body.password),
        prognosis_id=body.prognosis_id,
        facility=body.facility,
        phone=body.phone,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_out(p)
