import csv
import io
import uuid
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import get_current_user, staff_plus, customer_only, current_customer
from app.core.errors import AppError
from app.core.clock import today_ist
from app.core.money import money, ZERO
from app.services.audit_service import audit
from app.services.pdf_service import generate_invoice_pdf
from app.models.all_models import Invoice, InvoiceItem, Payment, User
from app.schemas.billing import (
    InvoiceResponse,
    PaginatedInvoices,
    BulkConfirmRequest,
    PaymentResponse,
)

router = APIRouter(tags=["invoices"])

def enrich_invoice(inv: Invoice, today=None) -> InvoiceResponse:
    today = today or today_ist()
    res = InvoiceResponse.model_validate(inv)
    # Section 12 derived overdue: status = 'confirmed' AND balance_due > 0 AND due_date < today
    res.is_overdue = inv.status == "confirmed" and inv.balance_due > 0 and inv.due_date < today
    return res

@router.get("/invoices", response_model=PaginatedInvoices)
def list_invoices(
    status: Optional[str] = None,
    customer_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(staff_plus),
):
    stmt = select(Invoice)
    count_stmt = select(func.count()).select_from(Invoice)
    filters = []
    if status:
        filters.append(Invoice.status == status)
    if customer_id:
        filters.append(Invoice.customer_id == customer_id)
    if filters:
        stmt = stmt.where(and_(*filters))
        count_stmt = count_stmt.where(and_(*filters))

    total = db.scalar(count_stmt) or 0
    invoices = db.execute(
        stmt.order_by(Invoice.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    today = today_ist()
    return PaginatedInvoices(
        items=[enrich_invoice(inv, today) for inv in invoices],
        total=total,
        page=page,
        page_size=page_size,
    )

@router.get("/invoices/export/csv")
def export_invoices_csv(
    status: Optional[str] = None,
    customer_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(staff_plus),
):
    stmt = select(Invoice)
    filters = []
    if status:
        filters.append(Invoice.status == status)
    if customer_id:
        filters.append(Invoice.customer_id == customer_id)
    if filters:
        stmt = stmt.where(and_(*filters))

    invoices = db.execute(stmt.order_by(Invoice.issue_date.desc(), Invoice.created_at.desc())).scalars().all()

    today = today_ist()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Invoice Number",
        "Customer",
        "Status",
        "Issue Date",
        "Due Date",
        "Billing Period Start",
        "Billing Period End",
        "Subtotal",
        "Discount Total",
        "Tax Total",
        "Grand Total",
        "Amount Paid",
        "Balance Due",
        "Is Overdue",
        "Days Overdue",
        "Sent At"
    ])

    for inv in invoices:
        is_overdue = inv.status == "confirmed" and inv.balance_due > 0 and inv.due_date < today
        days_overdue = (today - inv.due_date).days if is_overdue else 0
        customer_name = inv.customer.company_name if inv.customer else ""
        writer.writerow([
            inv.invoice_number,
            customer_name,
            inv.status,
            inv.issue_date.isoformat() if inv.issue_date else "",
            inv.due_date.isoformat() if inv.due_date else "",
            inv.billing_period_start.isoformat() if inv.billing_period_start else "",
            inv.billing_period_end.isoformat() if inv.billing_period_end else "",
            f"{inv.subtotal:.2f}",
            f"{inv.discount_total:.2f}",
            f"{inv.tax_total:.2f}",
            f"{inv.grand_total:.2f}",
            f"{inv.amount_paid:.2f}",
            f"{inv.balance_due:.2f}",
            "Yes" if is_overdue else "No",
            days_overdue,
            inv.sent_at.isoformat() if inv.sent_at else "Not Sent",
        ])

    csv_data = output.getvalue()
    filename = f"invoices_export_{today.isoformat()}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/invoices/{id}", response_model=InvoiceResponse)
def get_invoice(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    inv = db.get(Invoice, id)
    if not inv:
        raise AppError("NOT_FOUND", "Invoice not found", 404)
    return enrich_invoice(inv)

@router.post("/invoices/{id}/confirm", response_model=InvoiceResponse)
def confirm_invoice(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    inv = (
        db.execute(
            select(Invoice)
            .where(Invoice.id == id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        .scalar_one_or_none()
    )
    if not inv:
        raise AppError("NOT_FOUND", "Invoice not found", 404)
    if inv.status != "draft":
        raise AppError("INVALID_STATUS", f"Cannot confirm invoice with status {inv.status}", 409)

    inv.status = "confirmed"
    audit(db, user, "invoice.confirmed", "invoice", inv.id, {})
    db.commit()
    db.refresh(inv)
    return enrich_invoice(inv)

@router.post("/invoices/bulk-confirm")
def bulk_confirm_invoices(
    body: BulkConfirmRequest,
    db: Session = Depends(get_db),
    user: User = Depends(staff_plus),
):
    stmt = select(Invoice).where(Invoice.status == "draft").with_for_update()
    if body.ids:
        stmt = stmt.where(Invoice.id.in_(body.ids))
    if body.limit:
        stmt = stmt.limit(body.limit)

    drafts = db.execute(stmt).scalars().all()
    count = 0
    for inv in drafts:
        inv.status = "confirmed"
        audit(db, user, "invoice.bulk_confirmed", "invoice", inv.id, {})
        count += 1

    db.commit()
    return {"confirmed_count": count}

@router.post("/invoices/{id}/cancel", response_model=InvoiceResponse)
def cancel_invoice(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    inv = (
        db.execute(
            select(Invoice)
            .where(Invoice.id == id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        .scalar_one_or_none()
    )
    if not inv:
        raise AppError("NOT_FOUND", "Invoice not found", 404)

    # Cancel allowed only if status in ('draft', 'confirmed') AND amount_paid == 0
    if inv.status not in ("draft", "confirmed") or inv.amount_paid > 0:
        raise AppError("CANNOT_CANCEL", "Invoice cannot be cancelled after payments have been recorded", 409)

    inv.status = "cancelled"
    audit(db, user, "invoice.cancelled", "invoice", inv.id, {})
    db.commit()
    db.refresh(inv)
    return enrich_invoice(inv)

@router.post("/invoices/{id}/send", response_model=InvoiceResponse)
def send_invoice(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    inv = (
        db.execute(
            select(Invoice)
            .where(Invoice.id == id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        .scalar_one_or_none()
    )
    if not inv:
        raise AppError("NOT_FOUND", "Invoice not found", 404)
    if inv.status not in ("confirmed", "paid"):
        raise AppError("INVALID_STATUS", f"Cannot send invoice with status {inv.status}", 409)

    # Generate PDF from snapshots
    pdf_bytes = generate_invoice_pdf(inv)
    inv.sent_at = datetime.now(timezone.utc)
    audit(db, user, "invoice.sent", "invoice", inv.id, {})
    db.commit()

    # Log email to console backend
    print(f"[CONSOLE EMAIL] Invoice {inv.invoice_number} sent to customer {inv.customer_id}. PDF size: {len(pdf_bytes)} bytes")
    db.refresh(inv)
    return enrich_invoice(inv)

@router.get("/invoices/{id}/pdf")
def get_invoice_pdf_endpoint(id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    inv = db.get(Invoice, id)
    if not inv:
        raise AppError("NOT_FOUND", "Invoice not found", 404)

    # Ownership check for customers
    if user.role == "customer":
        cust = current_customer(db, user)
        if inv.customer_id != cust.id or inv.status == "draft":
            raise AppError("NOT_FOUND", "Invoice not found", 404)

    pdf_bytes = generate_invoice_pdf(inv)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{inv.invoice_number}.pdf"'},
    )

# --- PORTAL INVOICE ENDPOINTS ---
portal_invoice_router = APIRouter(prefix="/portal", tags=["portal-invoices"])

@portal_invoice_router.get("/invoices", response_model=PaginatedInvoices)
def list_my_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(customer_only),
):
    cust = current_customer(db, user)
    # Customers never see Draft invoices
    stmt = select(Invoice).where(Invoice.customer_id == cust.id, Invoice.status != "draft")
    count_stmt = select(func.count()).select_from(Invoice).where(Invoice.customer_id == cust.id, Invoice.status != "draft")

    total = db.scalar(count_stmt) or 0
    invoices = db.execute(
        stmt.order_by(Invoice.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    today = today_ist()
    return PaginatedInvoices(
        items=[enrich_invoice(inv, today) for inv in invoices],
        total=total,
        page=page,
        page_size=page_size,
    )

@portal_invoice_router.get("/invoices/{id}", response_model=InvoiceResponse)
def get_my_invoice(id: UUID, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    cust = current_customer(db, user)
    inv = db.execute(
        select(Invoice).where(Invoice.id == id, Invoice.customer_id == cust.id, Invoice.status != "draft")
    ).scalar_one_or_none()
    if not inv:
        raise AppError("NOT_FOUND", "Invoice not found", 404)
    return enrich_invoice(inv)


class PortalPaymentRequest(BaseModel):
    amount: Optional[Decimal] = None
    method: str = "upi"
    idempotency_key: Optional[str] = None
    payment_reference: Optional[str] = None
    note: Optional[str] = None


@portal_invoice_router.post("/invoices/{id}/pay", response_model=PaymentResponse)
def customer_pay_invoice(
    id: UUID,
    body: PortalPaymentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(customer_only),
):
    cust = current_customer(db, user)

    # Replay idempotency
    if body.idempotency_key:
        existing = db.execute(
            select(Payment).where(Payment.idempotency_key == body.idempotency_key)
        ).scalar_one_or_none()
        if existing:
            return existing

    invoice = (
        db.execute(
            select(Invoice)
            .where(Invoice.id == id, Invoice.customer_id == cust.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        .scalar_one_or_none()
    )

    if invoice is None:
        raise AppError("NOT_FOUND", "Invoice not found", 404)

    if invoice.status == "paid":
        raise AppError("ALREADY_PAID", "Invoice is already fully paid", 409)

    if invoice.status != "confirmed":
        raise AppError("INVOICE_NOT_PAYABLE", f"Cannot pay invoice with status {invoice.status}", 409)

    pay_amount = money(body.amount) if body.amount else invoice.balance_due

    if pay_amount <= 0:
        raise AppError("INVALID_AMOUNT", "Payment amount must be positive", 422)

    if pay_amount > invoice.balance_due:
        raise AppError("OVERPAYMENT", "Payment exceeds remaining balance due", 422)

    method = body.method if body.method in ("upi", "card", "bank_transfer", "gateway") else "upi"
    ref = body.payment_reference or f"ONLINE-{uuid.uuid4().hex[:8].upper()}"

    payment = Payment(
        invoice_id=invoice.id,
        idempotency_key=body.idempotency_key,
        payment_reference=ref,
        method=method,
        amount=pay_amount,
        payment_date=today_ist(),
        note=body.note or "Customer online payment via portal",
        recorded_by=user.id,
    )

    invoice.amount_paid = money(invoice.amount_paid + pay_amount)
    invoice.balance_due = money(invoice.grand_total - invoice.amount_paid)
    if invoice.balance_due == ZERO:
        invoice.status = "paid"

    db.add(payment)
    audit(
        db,
        user,
        "customer.payment_made",
        "invoice",
        invoice.id,
        {"amount": str(pay_amount), "method": method, "reference": ref},
    )

    db.commit()
    db.refresh(payment)
    return payment

