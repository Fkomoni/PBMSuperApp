from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProviderOut(BaseModel):
    provider_id: str
    name: str
    email: EmailStr
    prognosis_id: str | None = None


class LoginOut(BaseModel):
    token: str
    expires_in: int
    provider: ProviderOut


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
    drug_name: str
    generic: str | None = None
    dosage: str
    quantity: int = Field(ge=1)
    duration_days: int | None = None
    classification_hint: Literal["acute", "chronic"] | None = None
    unit_price: float | None = None


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
    alt_phone: str | None = None
    notes: str | None = None


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
