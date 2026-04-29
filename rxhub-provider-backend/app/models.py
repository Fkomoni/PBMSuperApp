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

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
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
    enrollee_first_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    enrollee_last_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
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
    pharmacy_code: Mapped[str | None] = mapped_column(String(64), nullable=True)  # WellaHealth pharmacyCode

    # WellaHealth fulfilment tracking. Populated at dispatch time so the admin
    # console can refresh status via GET /public/v1/Fulfilments instead of
    # guessing from event timeline.
    external_ref: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)  # enrollmentId / fulfilmentId
    external_tracking_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)  # trackingCode (e.g. WTR-5864CE2DA0)
    external_pickup_code: Mapped[str | None] = mapped_column(String(32), nullable=True)  # 8-digit OTP shown to member at pickup
    external_status: Mapped[str | None] = mapped_column(String(32), nullable=True)  # last status seen from Wella
    external_pharmacy_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    provider: Mapped[Provider] = relationship(back_populates="requests")
    items: Mapped[list["MedicationRequestItem"]] = relationship(back_populates="request", cascade="all,delete-orphan")
    events: Mapped[list["TrackingEvent"]] = relationship(back_populates="request", cascade="all,delete-orphan", order_by="TrackingEvent.at")
    attachments: Mapped[list["MedicationRequestAttachment"]] = relationship(back_populates="request", cascade="all,delete-orphan", order_by="MedicationRequestAttachment.created_at")


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


class MedicationRequestAttachment(Base):
    """Optional prescription uploads (PDF / image) that providers attach to
    a request. Bytes are stored inline — fine for <10MB files, keeps the
    app runnable on any Postgres/SQLite without external object storage.
    """
    __tablename__ = "medication_request_attachments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    request_id: Mapped[str] = mapped_column(String(16), ForeignKey("medication_requests.id"), index=True, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    uploaded_by: Mapped[str | None] = mapped_column(String(32), ForeignKey("providers.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    request: Mapped[MedicationRequest] = relationship(back_populates="attachments")


class LoginLockout(Base):
    """Tracks consecutive failed login attempts per email address.

    A row is created on the first failure and updated on each subsequent one.
    When failure_count reaches the threshold the account is locked until
    locked_until. A successful login deletes the row entirely.
    """
    __tablename__ = "login_lockouts"

    email: Mapped[str] = mapped_column(String(255), primary_key=True)
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_failure_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
