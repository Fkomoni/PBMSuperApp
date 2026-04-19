from fastapi import APIRouter, HTTPException, status

from app.core.security import create_access_token
from app.core.config import settings
from app.schemas.provider import LoginIn, LoginOut, ProviderOut

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn):
    """Provider log-in.

    TODO: proxy to Prognosis `ProviderLogIn` API (see settings.prognosis_base_url)
    and map the response to the ProviderOut shape below. For now, we accept any
    6+ char password so the UI can be exercised end-to-end.
    """
    if len(body.password) < 6:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    provider = ProviderOut(
        provider_id="PRG-" + body.email.split("@")[0].upper(),
        name=body.email.split("@")[0].replace(".", " ").title(),
        email=body.email,
        prognosis_id=None,
    )
    token = create_access_token(subject=provider.provider_id, extra={"role": "provider", "email": body.email})
    return LoginOut(token=token, expires_in=settings.jwt_ttl_hours * 3600, provider=provider)
