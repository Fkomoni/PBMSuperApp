from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProviderOut(BaseModel):
    provider_id: str
    name: str
    email: EmailStr
    prognosis_id: str | None = None
    facility: str | None = None
    role: Literal["provider", "admin"] = "provider"


class LoginOut(BaseModel):
    token: str
    expires_in: int
    provider: ProviderOut


class ProviderRegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=2)
    prognosis_id: str | None = None
    facility: str | None = None
    phone: str | None = None


class EnrolleeOut(BaseModel):
    enrollee_id: str
    name: str
    scheme: str | None = None
    company: str | None = None
    age: int | None = None
    phone: str | None = None
    email: EmailStr | None = None
    state: str | None = None
    status: str | None = None
    expiry_date: str | None = None
    flag: Literal["red", "green", "none"] | None = None
    flag_reason: str | None = None
    vip: bool | None = None
    medications: list[dict] = []


class DiagnosisRef(BaseModel):
    code: str
    name: str


class DiagnosisOut(BaseModel):
    code: str
    name: str


class DrugOut(BaseModel):
    drug_id: str | None = None
    name: str
    generic: str | None = None
    unit_price: float | None = None
    classification: Literal["acute", "chronic"] | None = None


class RequestItemIn(BaseModel):
    drug_id: str | None = None
    drug_name: str = Field(max_length=255)
    generic: str | None = Field(default=None, max_length=255)
    dosage: str | None = Field(default=None, max_length=255)
    quantity: int | None = Field(default=None, ge=1, le=9999)
    duration_days: int | None = Field(default=None, ge=1, le=3650)
    # Widened — drugs can be tagged hormonal/cancer/autoimmune/fertility/
    # telemedicine by the tariff; routing handles the split, so just accept
    # a free-form string here.
    classification_hint: str | None = Field(default=None, max_length=64)
    unit_price: float | None = None

    @field_validator("drug_id", mode="before")
    @classmethod
    def _coerce_drug_id(cls, v):
        # Frontend catalog emits numeric row ids (e.g. 541) — coerce any
        # int/float to string so Wella's fulfilment payload gets a clean
        # identifier and pydantic stops rejecting the body.
        if v is None or isinstance(v, str):
            return v
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            return str(int(v)) if float(v).is_integer() else str(v)
        return str(v)


class DeliveryIn(BaseModel):
    formatted: str
    lat: float | None = None
    lng: float | None = None
    place_id: str | None = None


class MedicationRequestIn(BaseModel):
    enrollee_id: str
    diagnoses: list[DiagnosisRef]
    items: list[RequestItemIn]
    delivery: DeliveryIn | None = None
    # Optional overrides from the provider form — used verbatim when
    # Prognosis returns no phone/email/state for the member.
    member_phone: str | None = Field(default=None, max_length=32)
    member_email: str | None = None
    member_state: str | None = Field(default=None, max_length=64)
    alt_phone: str | None = Field(default=None, max_length=32)
    urgency: Literal["routine", "urgent", "stat"] = "routine"
    treating_doctor: str | None = Field(default=None, max_length=255)
    # Provider-chosen partner pharmacy (WellaHealth pharmacyCode). If blank,
    # WellaHealth auto-assigns. Applies only when the request is routed there.
    pharmacy_code: str | None = Field(default=None, max_length=64)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("enrollee_id", mode="before")
    @classmethod
    def _coerce_enrollee_id(cls, v):
        # Some Prognosis variants return an int for the member id — accept
        # both so a provider form doesn't silently 422.
        return str(v) if v is not None else v


class MedicationRequestOut(BaseModel):
    id: str
    enrollee_id: str
    enrollee_name: str | None = None
    status: str
    classification: Literal["acute", "chronic", "mixed"] | None = None
    route: str | None = None
    channel: str | None = None
    created_at: datetime
    items: list[dict] = []


class TrackingEvent(BaseModel):
    label: str
    at: datetime
    kind: Literal["done", "info", "warn", "err"] = "info"
    icon: str | None = None
    note: str | None = None


class TrackingOut(BaseModel):
    request_id: str
    events: list[TrackingEvent]
