"""Reports router – admin/staff analytics endpoints (spec section 15)."""

import csv
import io
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select, func, and_, or_, case, literal
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import admin_only, staff_plus
from app.core.clock import today_ist
from app.core.money import money, ZERO
from app.models.all_models import (
    Subscription,
    SubscriptionItem,
    Invoice,
    Payment,
    Customer,
    Plan,
    User,
)
from app.schemas.reports import (
    AdminOverviewResponse,
    StaffOverviewResponse,
    RevenueRecord,
    PaginatedRevenue,
    SubscriptionReportRecord,
    PaginatedSubscriptionReport,
    OverdueRecord,
    PaginatedOverdue,
    PaymentReportRecord,
    PaginatedPaymentReport,
)


router = APIRouter(prefix="/reports", tags=["reports"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MRR_FACTORS = {
    "daily":   Decimal("365") / Decimal("12"),
    "weekly":  Decimal("52")  / Decimal("12"),
    "monthly": Decimal("1"),
    "yearly":  Decimal("1")   / Decimal("12"),
}


def _paginate(query, count_query, db: Session, page: int, page_size: int):
    """Return (rows, total) after applying offset/limit."""
    total: int = db.execute(count_query).scalar() or 0
    rows = db.execute(
        query.offset((page - 1) * page_size).limit(page_size)
    ).all()
    return rows, total


# ---------------------------------------------------------------------------
# GET /reports/overview  (admin_only)
# ---------------------------------------------------------------------------

@router.get("/overview", response_model=AdminOverviewResponse)
def admin_overview(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    td = today_ist()

    # 1. active_subscriptions
    active_subs_count: int = db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.status == "active",
            Subscription.start_date <= td,
            or_(
                Subscription.expiry_date.is_(None),
                Subscription.expiry_date >= td,
            ),
        )
    ).scalar() or 0

    # 2. MRR – for active (not paused) subscriptions, sum(unit_price × quantity)
    #    per subscription, normalized by billing_cycle via the plan.
    mrr_rows = db.execute(
        select(
            Plan.billing_cycle,
            func.sum(SubscriptionItem.unit_price * SubscriptionItem.quantity),
        )
        .join(Subscription, Subscription.id == SubscriptionItem.subscription_id)
        .join(Plan, Plan.id == Subscription.plan_id)
        .where(
            Subscription.status == "active",
            Subscription.start_date <= td,
            or_(
                Subscription.expiry_date.is_(None),
                Subscription.expiry_date >= td,
            ),
        )
        .group_by(Plan.billing_cycle)
    ).all()

    mrr = ZERO
    for cycle, total in mrr_rows:
        if total and cycle in _MRR_FACTORS:
            mrr += Decimal(str(total)) * _MRR_FACTORS[cycle]
    mrr = money(mrr)

    # 3. revenue_collected – sum of payments.amount in date range
    rev_q = select(func.coalesce(func.sum(Payment.amount), 0))
    if date_from:
        rev_q = rev_q.where(Payment.payment_date >= date_from)
    if date_to:
        rev_q = rev_q.where(Payment.payment_date <= date_to)
    revenue_collected = money(db.execute(rev_q).scalar() or 0)

    # 4. outstanding – sum of balance_due where invoice status='confirmed'
    outstanding = money(
        db.execute(
            select(func.coalesce(func.sum(Invoice.balance_due), 0)).where(
                Invoice.status == "confirmed"
            )
        ).scalar() or 0
    )

    # 5. overdue
    overdue_q = select(
        func.count(Invoice.id),
        func.coalesce(func.sum(Invoice.balance_due), 0),
    ).where(
        Invoice.status == "confirmed",
        Invoice.balance_due > 0,
        Invoice.due_date < td,
    )
    overdue_row = db.execute(overdue_q).one()
    overdue_count: int = overdue_row[0] or 0
    overdue_amount = money(overdue_row[1] or 0)

    # 6. new_customers in date range
    cust_q = select(func.count(Customer.id))
    if date_from:
        cust_q = cust_q.where(Customer.created_at >= date_from)
    if date_to:
        # include entire date_to day
        cust_q = cust_q.where(Customer.created_at < date_to + timedelta(days=1))
    new_customers: int = db.execute(cust_q).scalar() or 0

    # 7. renewals_due_7_days
    renewals_due: int = db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.status == "active",
            Subscription.expiry_date.isnot(None),
            Subscription.expiry_date >= td,
            Subscription.expiry_date <= td + timedelta(days=7),
        )
    ).scalar() or 0

    return AdminOverviewResponse(
        active_subscriptions=active_subs_count,
        mrr=mrr,
        revenue_collected=revenue_collected,
        outstanding=outstanding,
        overdue_count=overdue_count,
        overdue_amount=overdue_amount,
        new_customers=new_customers,
        renewals_due_7_days=renewals_due,
    )


# ---------------------------------------------------------------------------
# GET /reports/staff-overview  (staff_plus)
# ---------------------------------------------------------------------------

@router.get("/staff-overview", response_model=StaffOverviewResponse)
def staff_overview(
    db: Session = Depends(get_db),
    user: User = Depends(staff_plus),
):
    td = today_ist()

    active_subs_count: int = db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.status == "active",
            Subscription.start_date <= td,
            or_(
                Subscription.expiry_date.is_(None),
                Subscription.expiry_date >= td,
            ),
        )
    ).scalar() or 0

    draft_invoice_count: int = db.execute(
        select(func.count(Invoice.id)).where(Invoice.status == "draft")
    ).scalar() or 0

    overdue_count: int = db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.status == "confirmed",
            Invoice.balance_due > 0,
            Invoice.due_date < td,
        )
    ).scalar() or 0

    return StaffOverviewResponse(
        active_subscriptions=active_subs_count,
        draft_invoice_count=draft_invoice_count,
        overdue_count=overdue_count,
    )


# ---------------------------------------------------------------------------
# GET /reports/revenue  (admin_only, paginated)
# ---------------------------------------------------------------------------

@router.get("/revenue", response_model=PaginatedRevenue)
def revenue_report(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    base = select(Payment).join(Invoice, Invoice.id == Payment.invoice_id)
    count_base = select(func.count(Payment.id)).join(Invoice, Invoice.id == Payment.invoice_id)

    filters = []
    if date_from:
        filters.append(Payment.payment_date >= date_from)
    if date_to:
        filters.append(Payment.payment_date <= date_to)
    if customer_id:
        filters.append(Invoice.customer_id == customer_id)

    if filters:
        base = base.where(*filters)
        count_base = count_base.where(*filters)

    base = base.order_by(Payment.payment_date.desc(), Payment.created_at.desc())

    total: int = db.execute(count_base).scalar() or 0
    rows = db.execute(
        base.offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()

    return PaginatedRevenue(
        items=[RevenueRecord.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /reports/subscriptions  (admin_only, paginated)
# ---------------------------------------------------------------------------

@router.get("/subscriptions", response_model=PaginatedSubscriptionReport)
def subscriptions_report(
    status: Optional[str] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    plan_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    base = select(Subscription)
    count_base = select(func.count(Subscription.id))

    filters = []
    if status:
        filters.append(Subscription.status == status)
    if customer_id:
        filters.append(Subscription.customer_id == customer_id)
    if plan_id:
        filters.append(Subscription.plan_id == plan_id)

    if filters:
        base = base.where(*filters)
        count_base = count_base.where(*filters)

    base = base.order_by(Subscription.created_at.desc())

    total: int = db.execute(count_base).scalar() or 0
    rows = db.execute(
        base.offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()

    return PaginatedSubscriptionReport(
        items=[SubscriptionReportRecord.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /reports/overdue  (admin_only, paginated)
# ---------------------------------------------------------------------------

def _overdue_bucket(days: int) -> str:
    if days <= 30:
        return "1-30"
    elif days <= 60:
        return "31-60"
    return "60+"


@router.get("/overdue", response_model=PaginatedOverdue)
def overdue_report(
    customer_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    td = today_ist()

    filters = [
        Invoice.status == "confirmed",
        Invoice.balance_due > 0,
        Invoice.due_date < td,
    ]
    if customer_id:
        filters.append(Invoice.customer_id == customer_id)

    count_q = select(func.count(Invoice.id)).where(*filters)
    total: int = db.execute(count_q).scalar() or 0

    base = (
        select(Invoice)
        .where(*filters)
        .order_by(Invoice.due_date.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = db.execute(base).scalars().all()

    items = []
    for inv in rows:
        days = (td - inv.due_date).days
        items.append(
            OverdueRecord(
                id=inv.id,
                invoice_number=inv.invoice_number,
                customer_id=inv.customer_id,
                subscription_id=inv.subscription_id,
                due_date=inv.due_date,
                grand_total=inv.grand_total,
                balance_due=inv.balance_due,
                days_overdue=days,
                bucket=_overdue_bucket(days),
            )
        )

    return PaginatedOverdue(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /reports/payments  (admin_only, paginated)
# ---------------------------------------------------------------------------

@router.get("/payments", response_model=PaginatedPaymentReport)
def payments_report(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    method: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    base = select(Payment).join(Invoice, Invoice.id == Payment.invoice_id)
    count_base = select(func.count(Payment.id)).join(Invoice, Invoice.id == Payment.invoice_id)

    filters = []
    if date_from:
        filters.append(Payment.payment_date >= date_from)
    if date_to:
        filters.append(Payment.payment_date <= date_to)
    if customer_id:
        filters.append(Invoice.customer_id == customer_id)
    if method:
        filters.append(Payment.method == method)

    if filters:
        base = base.where(*filters)
        count_base = count_base.where(*filters)

    base = base.order_by(Payment.payment_date.desc(), Payment.created_at.desc())

    total: int = db.execute(count_base).scalar() or 0
    rows = db.execute(
        base.offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()

    return PaginatedPaymentReport(
        items=[PaymentReportRecord.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# CSV EXPORT ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/export/revenue-csv")
def export_revenue_csv(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    base = select(Payment).join(Invoice, Invoice.id == Payment.invoice_id)
    filters = []
    if date_from:
        filters.append(Payment.payment_date >= date_from)
    if date_to:
        filters.append(Payment.payment_date <= date_to)
    if customer_id:
        filters.append(Invoice.customer_id == customer_id)
    if filters:
        base = base.where(*filters)
    base = base.order_by(Payment.payment_date.desc(), Payment.created_at.desc())
    rows = db.execute(base).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Payment ID", "Payment Date", "Payment Reference", "Invoice Number",
        "Customer", "Method", "Amount (INR)", "Note"
    ])
    for p in rows:
        cust_name = p.invoice.customer.company_name if p.invoice and p.invoice.customer else ""
        inv_num = p.invoice.invoice_number if p.invoice else ""
        writer.writerow([
            str(p.id),
            p.payment_date.isoformat() if p.payment_date else "",
            p.payment_reference or "",
            inv_num,
            cust_name,
            p.method,
            f"{p.amount:.2f}",
            p.note or "",
        ])
    today = today_ist()
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="revenue_report_{today.isoformat()}.csv"'},
    )


@router.get("/export/overdue-csv")
def export_overdue_csv(
    customer_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    td = today_ist()
    filters = [
        Invoice.status == "confirmed",
        Invoice.balance_due > 0,
        Invoice.due_date < td,
    ]
    if customer_id:
        filters.append(Invoice.customer_id == customer_id)
    base = select(Invoice).where(*filters).order_by(Invoice.due_date.asc())
    rows = db.execute(base).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Invoice Number", "Customer", "Due Date", "Grand Total (INR)",
        "Balance Due (INR)", "Days Overdue", "Aging Bucket"
    ])
    for inv in rows:
        days = (td - inv.due_date).days
        bucket = _overdue_bucket(days)
        cust_name = inv.customer.company_name if inv.customer else ""
        writer.writerow([
            inv.invoice_number,
            cust_name,
            inv.due_date.isoformat() if inv.due_date else "",
            f"{inv.grand_total:.2f}",
            f"{inv.balance_due:.2f}",
            days,
            bucket,
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="overdue_aging_report_{td.isoformat()}.csv"'},
    )


@router.get("/export/subscriptions-csv")
def export_subscriptions_csv(
    status: Optional[str] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    plan_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    base = select(Subscription)
    filters = []
    if status:
        filters.append(Subscription.status == status)
    if customer_id:
        filters.append(Subscription.customer_id == customer_id)
    if plan_id:
        filters.append(Subscription.plan_id == plan_id)
    if filters:
        base = base.where(*filters)
    base = base.order_by(Subscription.created_at.desc())
    rows = db.execute(base).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Subscription Number", "Customer", "Plan", "Billing Cycle", "Status",
        "Start Date", "Expiry Date", "Next Billing Date", "Payment Terms (Days)", "Auto Renew"
    ])
    for s in rows:
        cust_name = s.customer.company_name if s.customer else ""
        plan_name = s.plan.name if s.plan else ""
        cycle = s.plan.billing_cycle if s.plan else ""
        writer.writerow([
            s.subscription_number,
            cust_name,
            plan_name,
            cycle,
            s.status,
            s.start_date.isoformat() if s.start_date else "",
            s.expiry_date.isoformat() if s.expiry_date else "No Expiry",
            s.next_billing_date.isoformat() if s.next_billing_date else "N/A",
            s.payment_terms_days,
            "Yes" if s.auto_renew else "No",
        ])
    today = today_ist()
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="subscriptions_report_{today.isoformat()}.csv"'},
    )

