"""
Financing application endpoints: suppliers apply for financing against a
PO (capped at max_financing_pct_of_po, default 80%); admins manually
review and update status. All underwriting decisions are manual — there
is no automated scoring or approval logic here by design.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user, require_admin, require_supplier
from app.config import get_settings
from app.database import get_db
from app.models import ApplicationStatus, FinancingApplication, PurchaseOrder, User, UserRole
from app.schemas import ApplicationStatusUpdate, FinancingApplicationCreate, FinancingApplicationOut

router = APIRouter(tags=["applications"])
settings = get_settings()


def _to_out(app: FinancingApplication) -> FinancingApplicationOut:
    """Flattens related PO/supplier fields and computes 60% / 40% capital tranches."""
    req_amt = Decimal(str(app.requested_amount))
    initial_pct = Decimal(str(settings.initial_disbursement_pct))
    remaining_pct = Decimal(str(settings.remaining_disbursement_pct))

    initial_amt = (req_amt * initial_pct).quantize(Decimal("0.01"))
    remaining_amt = (req_amt * remaining_pct).quantize(Decimal("0.01"))

    if app.status == ApplicationStatus.FUNDED:
        disbursed = req_amt
    elif app.status == ApplicationStatus.PARTIALLY_FUNDED:
        disbursed = initial_amt
    else:
        disbursed = Decimal("0.00")

    return FinancingApplicationOut(
        id=app.id,
        po_id=app.po_id,
        supplier_id=app.supplier_id,
        requested_amount=app.requested_amount,
        status=app.status,
        admin_notes=app.admin_notes,
        reviewed_by=app.reviewed_by,
        reviewed_at=app.reviewed_at,
        created_at=app.created_at,
        initial_disbursement_amount=initial_amt,
        remaining_disbursement_amount=remaining_amt,
        disbursed_amount=disbursed,
        initial_disbursement_pct=float(initial_pct * 100),
        remaining_disbursement_pct=float(remaining_pct * 100),
        po_number=app.purchase_order.po_number if app.purchase_order else None,
        buyer_name=app.purchase_order.buyer_name if app.purchase_order else None,
        po_total_value=app.purchase_order.total_value if app.purchase_order else None,
        document_s3_key=app.purchase_order.document_s3_key if app.purchase_order else None,
        supplier_company_name=app.supplier.company_name if app.supplier else None,
        supplier_email=app.supplier.email if app.supplier else None,
    )


@router.post("/api/purchase-orders/{po_id}/finance", response_model=FinancingApplicationOut, status_code=201)
async def create_financing_application(
    po_id: uuid.UUID,
    payload: FinancingApplicationCreate,
    user: User = Depends(require_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))
    po = result.scalar_one_or_none()
    if po is None:
        raise HTTPException(status_code=404, detail="Purchase order not found.")
    if po.supplier_id != user.id:
        raise HTTPException(status_code=403, detail="You can only request financing on your own purchase orders.")

    max_allowed = float(po.total_value) * float(settings.max_financing_pct_of_po)
    if float(payload.requested_amount) > max_allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Requested amount cannot exceed total PO value ({max_allowed:.2f}).",
        )


    application = FinancingApplication(
        po_id=po.id,
        supplier_id=user.id,
        requested_amount=payload.requested_amount,
        status=ApplicationStatus.PENDING,
    )
    db.add(application)
    po.status = "FINANCING_REQUESTED"
    await db.commit()

    result = await db.execute(
        select(FinancingApplication)
        .options(selectinload(FinancingApplication.purchase_order), selectinload(FinancingApplication.supplier))
        .where(FinancingApplication.id == application.id)
    )
    return _to_out(result.scalar_one())


@router.get("/api/applications", response_model=list[FinancingApplicationOut])
async def list_applications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(FinancingApplication)
        .options(selectinload(FinancingApplication.purchase_order), selectinload(FinancingApplication.supplier))
        .order_by(FinancingApplication.created_at.desc())
    )
    if user.role == UserRole.SUPPLIER:
        stmt = stmt.where(FinancingApplication.supplier_id == user.id)

    result = await db.execute(stmt)
    return [_to_out(a) for a in result.scalars().all()]


@router.get("/api/applications/{application_id}", response_model=FinancingApplicationOut)
async def get_application(
    application_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FinancingApplication)
        .options(selectinload(FinancingApplication.purchase_order), selectinload(FinancingApplication.supplier))
        .where(FinancingApplication.id == application_id)
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    if user.role == UserRole.SUPPLIER and app.supplier_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this application.")
    return _to_out(app)


@router.patch("/api/applications/{application_id}/status", response_model=FinancingApplicationOut)
async def update_application_status(
    application_id: uuid.UUID,
    payload: ApplicationStatusUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only manual status transition with optional underwriting
    notes. No automated scoring is involved — this simply records the
    admin's decision."""
    result = await db.execute(
        select(FinancingApplication)
        .options(selectinload(FinancingApplication.purchase_order), selectinload(FinancingApplication.supplier))
        .where(FinancingApplication.id == application_id)
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    app.status = payload.status
    if payload.admin_notes is not None:
        app.admin_notes = payload.admin_notes
    app.reviewed_by = admin.id
    app.reviewed_at = datetime.now(timezone.utc)

    if payload.status == ApplicationStatus.FUNDED:
        app.purchase_order.status = "CLOSED"
    elif payload.status == ApplicationStatus.PARTIALLY_FUNDED:
        app.purchase_order.status = "FINANCING_REQUESTED"

    await db.commit()
    await db.refresh(app)
    return _to_out(app)
