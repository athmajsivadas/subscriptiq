import logging
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.clock import today_ist
from app.core.errors import AppError
from app.core.money import money, ZERO
from app.core.database import SessionLocal
from app.models.all_models import (
    Subscription,
    Invoice,
    InvoiceItem,
    DiscountRedemption,
    TaxRule,
)
from app.services.numbering import next_number
from app.services.discount_service import pick_best_discount, allocate_discount

logger = logging.getLogger(__name__)

def add_cycle(d: date, cycle: str) -> date:
    """Cycle arithmetic per section 11.1."""
    return d + {
        "daily": relativedelta(days=1),
        "weekly": relativedelta(weeks=1),
        "monthly": relativedelta(months=1),  # Jan 31 -> Feb 28/29 (clamped)
        "yearly": relativedelta(years=1),    # Feb 29 -> Feb 28
    }[cycle]

def cycle_end(start: date, cycle: str) -> date:
    """Returns the inclusive last day of the billing period."""
    return add_cycle(start, cycle) - relativedelta(days=1)

@dataclass
class BillLine:
    product_id: UUID
    description: str
    quantity: int
    unit_price: Decimal
    tax_rule: Optional[TaxRule]
    subtotal: Decimal = ZERO
    discount: Decimal = ZERO
    tax_rate: Decimal = ZERO
    tax_amount: Decimal = ZERO
    total: Decimal = ZERO

def resolve_tax_rate(rule: Optional[TaxRule], on: date) -> Decimal:
    """
    Section 11.2: Validate tax rule.
    Fails loudly if rule is inactive or outside validity window.
    """
    if rule is None:
        return ZERO
    ok = (
        rule.is_active
        and (rule.valid_from is None or rule.valid_from <= on)
        and (rule.valid_until is None or rule.valid_until >= on)
    )
    if not ok:
        raise AppError("TAX_RULE_INVALID", f"Tax rule '{rule.name}' not valid on {on}", 409)
    return rule.rate_percent

def generate_invoice_for_subscription(
    db: Session, subscription_id: UUID, today: Optional[date] = None
) -> Optional[Invoice]:
    """
    Section 11.2: Returns the new Draft invoice, or None if nothing to do (not due / already billed).
    One subscription, one transaction.
    Advances the billing clock in the SAME transaction.
    """
    today = today or today_ist()
    sub = (
        db.execute(
            select(Subscription)
            .where(Subscription.id == subscription_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        .scalar_one_or_none()
    )

    if (
        sub is None
        or sub.status != "active"
        or sub.next_billing_date is None
        or sub.next_billing_date > today
    ):
        db.rollback()
        return None

    plan = sub.plan
    period_start = sub.current_period_start

    # Expiry check
    if sub.expiry_date and period_start > sub.expiry_date:
        db.rollback()
        return None

    if not sub.items:
        db.rollback()
        raise AppError("SUBSCRIPTION_HAS_NO_LINES", "No lines to bill", 409)

    period_end = cycle_end(period_start, plan.billing_cycle)
    next_start = add_cycle(period_start, plan.billing_cycle)

    lines: List[BillLine] = []
    for it in sub.items:
        ln = BillLine(
            it.product_id,
            it.description_snapshot,
            it.quantity,
            it.unit_price,
            it.tax_rule,
        )
        ln.subtotal = money(ln.unit_price * ln.quantity)  # variant-inclusive snapshot
        lines.append(ln)

    chosen = pick_best_discount(db, sub, lines, today)
    if chosen:
        allocate_discount(chosen.amount, chosen.target_lines)

    for ln in lines:
        ln.tax_rate = resolve_tax_rate(ln.tax_rule, today)
        taxable = ln.subtotal - ln.discount
        ln.tax_amount = money(taxable * ln.tax_rate / 100)
        ln.total = taxable + ln.tax_amount

    subtotal = sum((l.subtotal for l in lines), ZERO)
    discount_total = sum((l.discount for l in lines), ZERO)
    tax_total = sum((l.tax_amount for l in lines), ZERO)
    grand = subtotal - discount_total + tax_total  # sum of line totals

    invoice = Invoice(
        invoice_number=next_number(db, "INV"),
        customer_id=sub.customer_id,
        subscription_id=sub.id,
        billing_period_start=period_start,
        billing_period_end=period_end,
        issue_date=today,
        due_date=today + timedelta(days=sub.payment_terms_days),
        subtotal=subtotal,
        discount_total=discount_total,
        tax_total=tax_total,
        grand_total=grand,
        amount_paid=ZERO,
        balance_due=grand,
        status="draft",
    )
    for l in lines:
        invoice.items.append(
            InvoiceItem(
                product_id=l.product_id,
                description_snapshot=l.description,
                quantity=l.quantity,
                unit_price=l.unit_price,
                discount_amount=l.discount,
                tax_rate_percent=l.tax_rate,
                tax_amount=l.tax_amount,
                line_total=l.total,
            )
        )

    try:
        db.add(invoice)
        db.flush()  # ux_invoice_period fires here if raced
        if chosen:
            chosen.discount.usage_count += 1
            db.add(
                DiscountRedemption(
                    discount_id=chosen.discount.id,
                    customer_id=sub.customer_id,
                    subscription_id=sub.id,
                    invoice_id=invoice.id,
                    discount_amount=chosen.amount,
                )
            )
        # Advance the clock in the SAME transaction
        sub.current_period_start = next_start
        sub.current_period_end = cycle_end(next_start, plan.billing_cycle)
        sub.next_billing_date = next_start
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if "ux_invoice_period" in str(e.orig):
            return None  # another worker already billed this period
        raise  # any other integrity error is a real bug

    return invoice

def run_due_billing_job(limit: Optional[int] = None, today: Optional[date] = None, session: Optional[Session] = None) -> dict:
    """
    Section 11.3: Batch job processing due subscriptions.
    Returns: due_found, invoices_created, skipped, failed, failures.
    """
    today = today or today_ist()
    created, skipped, failures = 0, 0, []

    def _execute(db: Session):
        nonlocal created, skipped, failures
        q = (
            select(Subscription.id)
            .where(Subscription.status == "active", Subscription.next_billing_date <= today)
            .order_by(Subscription.next_billing_date, Subscription.id)
        )
        if limit:
            q = q.limit(limit)
        ids = db.execute(q).scalars().all()
        for sub_id in ids:
            try:
                inv = generate_invoice_for_subscription(db, sub_id, today)
            except AppError as e:
                db.rollback()
                failures.append({"subscription_id": str(sub_id), "code": e.code})
                continue
            except Exception:
                db.rollback()
                logger.exception("billing failed for %s", sub_id)
                failures.append({"subscription_id": str(sub_id), "code": "UNEXPECTED"})
                continue
            created += 1 if inv else 0
            skipped += 0 if inv else 1
        return ids

    if session:
        ids = _execute(session)
    else:
        with SessionLocal() as db:
            ids = _execute(db)

    return {
        "due_found": len(ids),
        "invoices_created": created,
        "skipped": skipped,
        "failed": len(failures),
        "failures": failures[:20],
    }
