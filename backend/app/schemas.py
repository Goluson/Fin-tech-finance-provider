"""
Pydantic schemas for API request/response bodies.
"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import ApplicationStatus, POStatus, UserRole

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.SUPPLIER


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: UserRole
    company_name: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Documents / Signed URLs
# ---------------------------------------------------------------------------

class UploadUrlRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="application/pdf")


class UploadUrlResponse(BaseModel):
    upload_url: str
    s3_key: str
    expires_in_minutes: int


class ViewUrlResponse(BaseModel):
    view_url: str
    expires_in_minutes: int


# ---------------------------------------------------------------------------
# Purchase Orders
# ---------------------------------------------------------------------------

class PurchaseOrderCreate(BaseModel):
    po_number: str = Field(min_length=1, max_length=100)
    buyer_name: str = Field(min_length=1, max_length=255)
    total_value: Decimal = Field(gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    document_s3_key: str = Field(min_length=1, max_length=512)


class PurchaseOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    supplier_id: uuid.UUID
    po_number: str
    buyer_name: str
    total_value: Decimal
    currency: str
    document_s3_key: str
    status: POStatus
    created_at: datetime


# ---------------------------------------------------------------------------
# Financing Applications
# ---------------------------------------------------------------------------

class FinancingApplicationCreate(BaseModel):
    requested_amount: Decimal = Field(gt=0)


class FinancingApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    po_id: uuid.UUID
    supplier_id: uuid.UUID
    requested_amount: Decimal
    status: ApplicationStatus
    admin_notes: Optional[str] = None
    reviewed_by: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    # Convenience nested fields for the admin review screen
    po_number: Optional[str] = None
    buyer_name: Optional[str] = None
    po_total_value: Optional[Decimal] = None
    document_s3_key: Optional[str] = None
    supplier_company_name: Optional[str] = None
    supplier_email: Optional[str] = None


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    admin_notes: Optional[str] = Field(default=None, max_length=5000)
