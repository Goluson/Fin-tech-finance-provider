"""
SQLAlchemy ORM models mirroring schema.sql (compatible with both PostgreSQL and SQLite).
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UUID,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    SUPPLIER = "SUPPLIER"
    ADMIN = "ADMIN"


class POStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    FINANCING_REQUESTED = "FINANCING_REQUESTED"
    CLOSED = "CLOSED"


class ApplicationStatus(str, enum.Enum):
    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PARTIALLY_FUNDED = "PARTIALLY_FUNDED"
    FUNDED = "FUNDED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cognito_sub: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False), nullable=False, default=UserRole.SUPPLIER)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="supplier")
    applications: Mapped[list["FinancingApplication"]] = relationship(
        back_populates="supplier", foreign_keys="FinancingApplication.supplier_id"
    )


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    po_number: Mapped[str] = mapped_column(String(100), nullable=False)
    buyer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_value: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    document_s3_key: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[POStatus] = mapped_column(Enum(POStatus, native_enum=False), nullable=False, default=POStatus.UPLOADED)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (CheckConstraint("total_value > 0", name="ck_po_total_value_positive"),)

    supplier: Mapped["User"] = relationship(back_populates="purchase_orders")
    applications: Mapped[list["FinancingApplication"]] = relationship(back_populates="purchase_order")


class FinancingApplication(Base):
    __tablename__ = "financing_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    requested_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, native_enum=False), nullable=False, default=ApplicationStatus.PENDING
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (CheckConstraint("requested_amount > 0", name="ck_app_requested_amount_positive"),)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="applications")
    supplier: Mapped["User"] = relationship(back_populates="applications", foreign_keys=[supplier_id])
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by])

