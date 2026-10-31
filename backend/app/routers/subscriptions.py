from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.permissions import get_current_user, staff_plus, customer_only, current_customer
from app.core.errors import AppError
from app.core.clock import today_ist
from app.services.numbering import next_number
from app.services.pricing import line_unit_price, assert_plan_available
from app.services.subscription_service import (
    transition,
    activate_subscription,
    renew_subscription,
)
from app.models.all_models import (
    Subscription,
    SubscriptionItem,
    SubscriptionStatusHistory,
    Plan,
    Product,
    ProductVariant,
    Customer,
    User,
)
from app.schemas.catalog import (
    SubscriptionCreate,
    SubscriptionResponse,
    PaginatedSubscriptions,
)

router = APIRouter(tags=["subscriptions"])

# --- STAFF SUBSCRIPTION MANAGEMENT ---
@router.post("/subscriptions", status_code=201, response_model=SubscriptionResponse)
def create_subscription(
    body: SubscriptionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(staff_plus),
):
    plan = db.get(Plan, body.plan_id)
    if not plan:
        raise AppError("PLAN_NOT_FOUND", "Plan not found", 404)
    customer = db.get(Customer, body.customer_id)
    if not customer:
        raise AppError("CUSTOMER_NOT_FOUND", "Customer not found", 404)

    start = body.start_date or today_ist()
    assert_plan_available(plan, start)

    expiry = body.expiry_date or plan.available_until
    if plan.auto_close_on_end and expiry is None:
        raise AppError("EXPIRY_REQUIRED", "This plan auto-closes, so an expiry date is required", 422)

    sub = Subscription(
        subscription_number=next_number(db, "SUB"),
        customer_id=body.customer_id,
        plan_id=body.plan_id,
        status="draft",  # Manual creation starts draft
        start_date=start,
        expiry_date=expiry,
        payment_terms_days=body.payment_terms_days,
        auto_renew=body.auto_renew,
        created_by=user.id,
    )

    for it in body.items:
        prod = db.get(Product, it.product_id)
        if not prod:
            raise AppError("PRODUCT_NOT_FOUND", "Product not found", 404)
        variant = db.get(ProductVariant, it.variant_id) if it.variant_id else None
        price = it.unit_price if it.unit_price is not None else line_unit_price(plan, prod, variant)
        desc = f"{prod.name} ({variant.variant_name})" if variant else prod.name

        sub.items.append(
            SubscriptionItem(
                product_id=it.product_id,
                variant_id=it.variant_id,
                description_snapshot=desc,
                quantity=it.quantity,
                unit_price=price,
                tax_rule_id=it.tax_rule_id or prod.default_tax_rule_id,
            )
        )

    sub.history.append(
        SubscriptionStatusHistory(
            from_status=None,
            to_status="draft",
            changed_by=user.id,
            note="Created subscription manually",
        )
    )

    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

@router.get("/subscriptions", response_model=PaginatedSubscriptions)
def list_subscriptions(
    status: Optional[str] = None,
    customer_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(staff_plus),
):
    stmt = select(Subscription).options(selectinload(Subscription.items), selectinload(Subscription.history))
    count_stmt = select(func.count(Subscription.id))

    filters = []
    if status:
        filters.append(Subscription.status == status)
    if customer_id:
        filters.append(Subscription.customer_id == customer_id)

    if filters:
        stmt = stmt.where(and_(*filters))
        count_stmt = count_stmt.where(and_(*filters))

    total = db.scalar(count_stmt) or 0
    subs = db.execute(
        stmt.order_by(Subscription.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return PaginatedSubscriptions(
        items=subs,
        total=total,
        page=page,
        page_size=page_size,
    )

@router.get("/subscriptions/{id}", response_model=SubscriptionResponse)
def get_subscription(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    sub = db.get(Subscription, id)
    if not sub:
        raise AppError("NOT_FOUND", "Subscription not found", 404)
    return sub

@router.post("/subscriptions/{id}/to-quotation", response_model=SubscriptionResponse)
def draft_to_quotation(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    sub = db.get(Subscription, id)
    if not sub:
        raise AppError("NOT_FOUND", "Subscription not found", 404)
    transition(db, sub, "quotation", user, note="Moved to quotation")
    db.commit()
    db.refresh(sub)
    return sub

@router.post("/subscriptions/{id}/confirm", response_model=SubscriptionResponse)
def confirm_subscription(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    sub = db.get(Subscription, id)
    if not sub:
        raise AppError("NOT_FOUND", "Subscription not found", 404)
    transition(db, sub, "confirmed", user, note="Confirmed subscription")
    db.commit()
    db.refresh(sub)
    return sub

@router.post("/subscriptions/{id}/activate", response_model=SubscriptionResponse)
def activate(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    sub = db.get(Subscription, id)
    if not sub:
        raise AppError("NOT_FOUND", "Subscription not found", 404)
    activate_subscription(db, sub, user)
    db.commit()
    db.refresh(sub)
    return sub

@router.post("/subscriptions/{id}/pause", response_model=SubscriptionResponse)
def pause_subscription(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    sub = db.get(Subscription, id)
    if not sub:
        raise AppError("NOT_FOUND", "Subscription not found", 404)
    transition(db, sub, "paused", user, note="Paused by staff")
    db.commit()
    db.refresh(sub)
    return sub

@router.post("/subscriptions/{id}/resume", response_model=SubscriptionResponse)
def resume_subscription(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    sub = db.get(Subscription, id)
    if not sub:
        raise AppError("NOT_FOUND", "Subscription not found", 404)
    transition(db, sub, "active", user, note="Resumed by staff")
    db.commit()
    db.refresh(sub)
    return sub

@router.post("/subscriptions/{id}/close", response_model=SubscriptionResponse)
def close_subscription(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    sub = db.get(Subscription, id)
    if not sub:
        raise AppError("NOT_FOUND", "Subscription not found", 404)
    transition(db, sub, "closed", user, note="Closed by staff")
    db.commit()
    db.refresh(sub)
    return sub

@router.post("/subscriptions/{id}/renew", response_model=SubscriptionResponse)
def renew(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    sub = db.get(Subscription, id)
    if not sub:
        raise AppError("NOT_FOUND", "Subscription not found", 404)
    renew_subscription(db, sub, user)
    db.commit()
    db.refresh(sub)
    return sub

# --- CUSTOMER PORTAL ENDPOINTS ---
portal_router = APIRouter(prefix="/portal", tags=["portal"])

def get_customer_subscription(db: Session, sub_id: UUID, user: User) -> Subscription:
    cust = current_customer(db, user)
    sub = db.execute(
        select(Subscription).where(
            Subscription.id == sub_id,
            Subscription.customer_id == cust.id,
        )
    ).scalar_one_or_none()
    if not sub:
        # 404 ownership rule to prevent enumeration
        raise AppError("NOT_FOUND", "Subscription not found", 404)
    return sub

@portal_router.get("/subscriptions", response_model=List[SubscriptionResponse])
def get_my_subscriptions(db: Session = Depends(get_db), user: User = Depends(customer_only)):
    cust = current_customer(db, user)
    return db.execute(
        select(Subscription).where(Subscription.customer_id == cust.id).order_by(Subscription.created_at.desc())
    ).scalars().all()

@portal_router.get("/subscriptions/{id}", response_model=SubscriptionResponse)
def get_my_subscription(id: UUID, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    return get_customer_subscription(db, id, user)

@portal_router.post("/subscriptions/{id}/pause", response_model=SubscriptionResponse)
def customer_pause(id: UUID, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    sub = get_customer_subscription(db, id, user)
    transition(db, sub, "paused", user, note="Paused via customer portal")
    db.commit()
    db.refresh(sub)
    return sub

@portal_router.post("/subscriptions/{id}/resume", response_model=SubscriptionResponse)
def customer_resume(id: UUID, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    sub = get_customer_subscription(db, id, user)
    transition(db, sub, "active", user, note="Resumed via customer portal")
    db.commit()
    db.refresh(sub)
    return sub

@portal_router.post("/subscriptions/{id}/close", response_model=SubscriptionResponse)
def customer_close(id: UUID, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    sub = get_customer_subscription(db, id, user)
    transition(db, sub, "closed", user, note="Closed via customer portal")
    db.commit()
    db.refresh(sub)
    return sub

@portal_router.post("/subscriptions/{id}/renew", response_model=SubscriptionResponse)
def customer_renew(id: UUID, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    sub = get_customer_subscription(db, id, user)
    renew_subscription(db, sub, user)
    db.commit()
    db.refresh(sub)
    return sub
