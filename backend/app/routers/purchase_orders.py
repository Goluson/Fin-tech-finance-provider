"""
Purchase Order endpoints: create PO records (metadata only — the PDF
itself was already uploaded via a signed URL) and list POs.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_supplier
from app.database import get_db
from app.s3 import generate_view_signed_url
from app.models import PurchaseOrder, User, UserRole
from app.schemas import PurchaseOrderCreate, PurchaseOrderOut, ViewUrlResponse

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


@router.post("", response_model=PurchaseOrderOut, status_code=201)
async def create_purchase_order(
    payload: PurchaseOrderCreate,
    user: User = Depends(require_supplier),
    db: AsyncSession = Depends(get_db),
):
    """Saves manually-entered PO data plus the S3 key of the already
    uploaded PDF. Does not re-verify the file exists in S3 in this MVP;
    a production version should HEAD the object before saving."""
    po = PurchaseOrder(
        supplier_id=user.id,
        po_number=payload.po_number,
        buyer_name=payload.buyer_name,
        total_value=payload.total_value,
        currency=payload.currency.upper(),
        document_s3_key=payload.document_s3_key,
    )
    db.add(po)
    await db.commit()
    await db.refresh(po)
    return po


@router.get("", response_model=list[PurchaseOrderOut])
async def list_purchase_orders(
    supplier_id: uuid.UUID | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admins can list all POs or filter by supplier_id. Suppliers may
    only ever see their own POs, regardless of any supplier_id passed."""
    stmt = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())

    if user.role == UserRole.SUPPLIER:
        stmt = stmt.where(PurchaseOrder.supplier_id == user.id)
    elif supplier_id is not None:
        stmt = stmt.where(PurchaseOrder.supplier_id == supplier_id)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{po_id}/document-url", response_model=ViewUrlResponse)
async def get_po_document_view_url(
    po_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mints a short-lived signed GET URL so the admin (or the owning
    supplier) can view the private PDF in an iframe."""
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))
    po = result.scalar_one_or_none()
    if po is None:
        raise HTTPException(status_code=404, detail="Purchase order not found.")

    if user.role == UserRole.SUPPLIER and po.supplier_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this document.")

    from app.config import get_settings

    settings = get_settings()
    url = generate_view_signed_url(po.document_s3_key)
    return ViewUrlResponse(view_url=url, expires_in_minutes=settings.signed_url_expiration_minutes)
