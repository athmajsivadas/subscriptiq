from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.permissions import get_current_user, staff_plus, customer_only, current_customer
from app.core.errors import AppError
from app.core.clock import today_ist
from app.core.money import money, ZERO
from app.services.audit_service import audit
from app.models.all_models import Payment, Invoice, User
from app.schemas.billing import (
    PaymentCreate,
    PaymentResponse,
    PaginatedPayments,
)

router = APIRouter(tags=["payments"])

@router.post("/payments", status_code=201, response_model=PaymentResponse)
def record_payment(
    body: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(staff_plus),
):
    """
    Section 14: Payment processing.
    Idempotent replay handling, invoice row lock, amount validation, balance update,
    status transition to 'paid' when balance reaches zero.
    """
    amount = money(body.amount)
    if amount <= 0:
        raise AppError("INVALID_AMOUNT", "Payment amount must be positive", 422)

    if body.idempotency_key:
        existing = db.execute(
            select(Payment).where(Payment.idempotency_key == body.idempotency_key)
        ).scalar_one_or_none()
        if existing:
            if existing.invoice_id != body.invoice_id or existing.amount != amount:
                raise AppError(
                    "IDEMPOTENCY_MISMATCH",
                    "Key already used for a different payment",
                    409,
                )
            return existing

    invoice = (
        db.execute(
            select(Invoice)
            .where(Invoice.id == body.invoice_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        .scalar_one_or_none()
    )

    if invoice is None:
        raise AppError("INVOICE_NOT_FOUND", "Invoice not found", 404)
    if invoice.status != "confirmed":
        raise AppError(
            "INVOICE_NOT_PAYABLE",
            f"Invoice is {invoice.status}; only confirmed invoices accept payments",
            409,
        )
    if amount > invoice.balance_due:
        raise AppError("OVERPAYMENT", "Payment exceeds balance due", 422)

    payment = Payment(
        invoice_id=invoice.id,
        idempotency_key=body.idempotency_key,
        payment_reference=body.payment_reference,
        method=body.method,
        amount=amount,
        payment_date=body.payment_date or today_ist(),
        note=body.note,
        recorded_by=user.id,
    )
    invoice.amount_paid = money(invoice.amount_paid + amount)
    invoice.balance_due = money(invoice.grand_total - invoice.amount_paid)
    if invoice.balance_due == ZERO:
        invoice.status = "paid"

    db.add(payment)
    audit(db, user, "payment.recorded", "invoice", invoice.id, {"amount": str(amount)})

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if body.idempotency_key:
            again = db.execute(
                select(Payment).where(Payment.idempotency_key == body.idempotency_key)
            ).scalar_one_or_none()
            if again:
                return again
        raise AppError("PAYMENT_CONFLICT", "Payment could not be recorded; retry safely", 409)

    db.refresh(payment)
    return payment

@router.get("/payments", response_model=PaginatedPayments)
def list_payments(
    invoice_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(staff_plus),
):
    stmt = select(Payment)
    count_stmt = select(func.count()).select_from(Payment)
    if invoice_id:
        stmt = stmt.where(Payment.invoice_id == invoice_id)
        count_stmt = count_stmt.where(Payment.invoice_id == invoice_id)

    total = db.scalar(count_stmt) or 0
    payments = db.execute(
        stmt.order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return PaginatedPayments(
        items=payments,
        total=total,
        page=page,
        page_size=page_size,
    )

# Customer payment history
portal_payment_router = APIRouter(prefix="/portal", tags=["portal-payments"])

@portal_payment_router.get("/payments", response_model=PaginatedPayments)
def list_my_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(customer_only),
):
    cust = current_customer(db, user)
    stmt = select(Payment).join(Invoice).where(Invoice.customer_id == cust.id)
    count_stmt = select(func.count()).select_from(Payment).join(Invoice).where(Invoice.customer_id == cust.id)

    total = db.scalar(count_stmt) or 0
    payments = db.execute(
        stmt.order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return PaginatedPayments(
        items=payments,
        total=total,
        page=page,
        page_size=page_size,
    )
