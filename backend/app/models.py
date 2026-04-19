"""ORM models. Kept in one file so the schema is easy to eyeball.

Tables (MVP):
  providers                — provider accounts + bcrypt password
  medication_requests      — one row per prescription submitted
  medication_request_items — drugs on a given request
  tracking_events          — status-change events for a request (provider-visible)
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def _uuid() -> str:
    return uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    prognosis_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    facility: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # provider | admin — admins see every request, providers see only their own
    role: Mapped[str] = mapped_column(String(16), default="provider", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    requests: Mapped[list["MedicationRequest"]] = relationship(back_populates="provider", cascade="all,delete-orphan")


class MedicationRequest(Base):
    __tablename__ = "medication_requests"

    id: Mapped[str] = mapped_column(String(16), primary_key=True, default=lambda: uuid4().hex[:10].upper())
    provider_id: Mapped[str] = mapped_column(String(32), ForeignKey("providers.id"), index=True, nullable=False)
    enrollee_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    enrollee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enrollee_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    enrollee_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enrollee_dob: Mapped[str | None] = mapped_column(String(32), nullable=True)
    enrollee_gender: Mapped[str | None] = mapped_column(String(16), nullable=True)
    enrollee_state: Mapped[str | None] = mapped_column(String(64), nullable=True)

    diagnoses: Mapped[list | None] = mapped_column(JSON, nullable=True)
    delivery: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    alt_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    classification: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # acute/chronic/mixed
    status: Mapped[str] = mapped_column(String(32), default="submitted", index=True, nullable=False)
    channel: Mapped[str | None] = mapped_column(String(64), nullable=True)
    route: Mapped[str | None] = mapped_column(String(255), nullable=True)
    urgency: Mapped[str] = mapped_column(String(16), default="routine", nullable=False)  # routine|urgent|stat
    treating_doctor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ref_code: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)  # RX-YYYYMMDD-XXXXXX

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    provider: Mapped[Provider] = relationship(back_populates="requests")
    items: Mapped[list["MedicationRequestItem"]] = relationship(back_populates="request", cascade="all,delete-orphan")
    events: Mapped[list["TrackingEvent"]] = relationship(back_populates="request", cascade="all,delete-orphan", order_by="TrackingEvent.at")


class MedicationRequestItem(Base):
    __tablename__ = "medication_request_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    request_id: Mapped[str] = mapped_column(String(16), ForeignKey("medication_requests.id"), index=True, nullable=False)
    drug_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    drug_name: Mapped[str] = mapped_column(String(255), nullable=False)
    generic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dosage: Mapped[str] = mapped_column(String(128), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    classification_hint: Mapped[str | None] = mapped_column(String(32), nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Float, nullable=True)

    request: Mapped[MedicationRequest] = relationship(back_populates="items")


class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    request_id: Mapped[str] = mapped_column(String(16), ForeignKey("medication_requests.id"), index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), default="info", nullable=False)  # done|info|warn|err
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    request: Mapped[MedicationRequest] = relationship(back_populates="events")
