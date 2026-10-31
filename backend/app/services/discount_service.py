from dataclasses import dataclass
from decimal import Decimal
from typing import List, Optional
from datetime import date
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.core.money import money, ZERO
from app.models.all_models import Discount, DiscountProduct, Subscription

def compute_discount_amount(base: Decimal, kind: str, value: Decimal) -> Decimal:
    """Section 13: Discount amount calculation."""
    if base <= 0:
        return ZERO
    if kind == "fixed":
        return money(min(value, base))
    return money(base * min(max(value, Decimal("0")), Decimal("100")) / 100)

@dataclass
class Chosen:
    discount: Discount
    amount: Decimal
    target_lines: list

def pick_best_discount(db: Session, sub: Subscription, lines: list, today: date) -> Optional[Chosen]:
    """
    Section 13: Pick the single best discount for an invoice.
    Locks discount rows with FOR UPDATE ordered by id to prevent deadlocks.
    """
    rows = db.execute(
        select(Discount)
        .where(
            Discount.is_active.is_(True),
            or_(Discount.starts_on.is_(None), Discount.starts_on <= today),
            or_(Discount.ends_on.is_(None), Discount.ends_on >= today),
        )
        .order_by(Discount.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalars().all()

    best: Optional[Chosen] = None
    for d in rows:
        if d.usage_limit is not None and d.usage_count >= d.usage_limit:
            continue
        if d.scope == "subscription":
            target = lines
        else:
            pids = set(
                db.execute(
                    select(DiscountProduct.product_id).where(DiscountProduct.discount_id == d.id)
                ).scalars().all()
            )
            target = [l for l in lines if l.product_id in pids]

        if not target:
            continue

        base = sum((l.subtotal for l in target), ZERO)
        qty = sum(l.quantity for l in target)

        if d.minimum_purchase and base < d.minimum_purchase:
            continue
        if d.minimum_quantity and qty < d.minimum_quantity:
            continue

        amount = compute_discount_amount(base, d.discount_type, d.value)
        if amount > 0 and (best is None or amount > best.amount):
            best = Chosen(d, amount, target)

    return best

def allocate_discount(amount: Decimal, target: list) -> None:
    """
    Section 13: Allocate discount across target lines proportionally.
    Last line absorbs the rounding difference.
    """
    base = sum((l.subtotal for l in target), ZERO)
    remaining = amount
    for i, l in enumerate(target):
        share = remaining if i == len(target) - 1 else money(amount * l.subtotal / base)
        l.discount, remaining = share, remaining - share
