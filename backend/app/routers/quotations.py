from datetime import timedelta
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.permissions import get_current_user, admin_only, staff_plus
from app.core.errors import AppError
from app.core.clock import today_ist
from app.core.money import money, ZERO
from app.services.numbering import next_number
from app.services.pricing import line_unit_price, assert_plan_available
from app.models.all_models import (
    QuotationTemplate,
    QuotationTemplateLine,
    Quotation,
    QuotationItem,
    Subscription,
    SubscriptionItem,
    SubscriptionStatusHistory,
    Plan,
    Product,
    ProductVariant,
    Customer,
    TaxRule,
    User,
)
from app.schemas.catalog import (
    QuotationTemplateCreate,
    QuotationTemplateResponse,
    QuotationFromTemplateRequest,
    QuotationResponse,
    ConvertBody,
    SubscriptionResponse,
)

router = APIRouter(tags=["quotations"])

# --- TEMPLATES ---
@router.post("/quotation-templates", status_code=201, response_model=QuotationTemplateResponse)
def create_template(body: QuotationTemplateCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    plan = db.get(Plan, body.plan_id)
    if not plan:
        raise AppError("PLAN_NOT_FOUND", "Plan not found", 404)

    tmpl = QuotationTemplate(
        name=body.name.strip(),
        plan_id=body.plan_id,
        validity_days=body.validity_days,
        payment_terms_days=body.payment_terms_days,
        description=body.description,
        created_by=admin.id,
    )
    for l in body.lines:
        tmpl.lines.append(
            QuotationTemplateLine(
                product_id=l.product_id,
                variant_id=l.variant_id,
                quantity=l.quantity,
                tax_rule_id=l.tax_rule_id,
            )
        )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl

@router.get("/quotation-templates", response_model=List[QuotationTemplateResponse])
def list_templates(db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    return db.execute(select(QuotationTemplate).where(QuotationTemplate.is_active.is_(True))).scalars().all()

# --- QUOTATIONS ---
@router.post("/quotations/from-template", status_code=201, response_model=QuotationResponse)
def create_from_template(body: QuotationFromTemplateRequest, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    tmpl = db.get(QuotationTemplate, body.template_id)
    if not tmpl or not tmpl.is_active:
        raise AppError("TEMPLATE_NOT_FOUND", "Quotation template not found or inactive", 404)

    customer = db.get(Customer, body.customer_id)
    if not customer:
        raise AppError("CUSTOMER_NOT_FOUND", "Customer not found", 404)

    plan = tmpl.plan
    today = today_ist()
    assert_plan_available(plan, today)

    q = Quotation(
        quotation_number=next_number(db, "QUO"),
        customer_id=customer.id,
        template_id=tmpl.id,
        plan_id=tmpl.plan_id,
        issue_date=today,
        valid_until=today + timedelta(days=tmpl.validity_days),
        status="draft",
        payment_terms_days=tmpl.payment_terms_days,
        created_by=user.id,
    )

    subtotal = ZERO
    tax_total = ZERO

    for line in tmpl.lines:
        prod = line.product
        variant = line.variant
        price = line_unit_price(plan, prod, variant)
        line_sub = money(price * line.quantity)

        # Tax resolution: line tax_rule or product default
        tax_rule = line.tax_rule or prod.default_tax_rule
        rate = tax_rule.rate_percent if tax_rule and tax_rule.is_active else ZERO
        line_tax = money(line_sub * rate / 100)
        line_tot = line_sub + line_tax

        subtotal += line_sub
        tax_total += line_tax

        desc = f"{prod.name} ({variant.variant_name})" if variant else prod.name
        q.items.append(
            QuotationItem(
                product_id=line.product_id,
                variant_id=line.variant_id,
                description_snapshot=desc,
                quantity=line.quantity,
                unit_price=price,
                tax_rule_id=tax_rule.id if tax_rule else None,
                line_total=line_tot,
            )
        )

    q.subtotal = money(subtotal)
    q.tax_total = money(tax_total)
    q.grand_total = money(subtotal + tax_total)

    db.add(q)
    db.commit()
    db.refresh(q)
    return q

@router.get("/quotations", response_model=List[QuotationResponse])
def list_quotations(db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    today = today_ist()
    quotes = db.execute(select(Quotation).order_by(Quotation.issue_date.desc())).scalars().all()
    # Check expiry on read
    for q in quotes:
        if q.status in ("draft", "sent") and q.valid_until and q.valid_until < today:
            q.status = "expired"
    db.commit()
    return quotes

@router.get("/quotations/{id}", response_model=QuotationResponse)
def get_quotation(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    q = db.get(Quotation, id)
    if not q:
        raise AppError("QUOTATION_NOT_FOUND", "Quotation not found", 404)
    if q.status in ("draft", "sent") and q.valid_until and q.valid_until < today_ist():
        q.status = "expired"
        db.commit()
    return q

@router.post("/quotations/{id}/send", response_model=QuotationResponse)
def send_quotation(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    q = db.get(Quotation, id)
    if not q:
        raise AppError("QUOTATION_NOT_FOUND", "Quotation not found", 404)
    if q.status != "draft":
        raise AppError("INVALID_STATUS", f"Cannot send quotation with status {q.status}", 409)
    q.status = "sent"
    db.commit()
    db.refresh(q)
    return q

@router.post("/quotations/{id}/accept", response_model=QuotationResponse)
def accept_quotation(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    q = db.get(Quotation, id)
    if not q:
        raise AppError("QUOTATION_NOT_FOUND", "Quotation not found", 404)
    if q.valid_until and q.valid_until < today_ist():
        q.status = "expired"
        db.commit()
        raise AppError("QUOTATION_EXPIRED", "Quotation has expired", 409)
    if q.status not in ("draft", "sent"):
        raise AppError("INVALID_STATUS", f"Cannot accept quotation with status {q.status}", 409)
    q.status = "accepted"
    db.commit()
    db.refresh(q)
    return q

@router.post("/quotations/{id}/reject", response_model=QuotationResponse)
def reject_quotation(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    q = db.get(Quotation, id)
    if not q:
        raise AppError("QUOTATION_NOT_FOUND", "Quotation not found", 404)
    if q.status not in ("draft", "sent"):
        raise AppError("INVALID_STATUS", f"Cannot reject quotation with status {q.status}", 409)
    q.status = "rejected"
    db.commit()
    db.refresh(q)
    return q

# Section 9.2: Convert Quotation to Subscription
@router.post("/quotations/{quotation_id}/convert", response_model=SubscriptionResponse)
def convert_quotation(
    quotation_id: UUID,
    body: ConvertBody,
    db: Session = Depends(get_db),
    user: User = Depends(staff_plus),
):
    q = db.execute(
        select(Quotation)
        .where(Quotation.id == quotation_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()

    if q is None:
        raise AppError("QUOTATION_NOT_FOUND", "Quotation not found", 404)
    if q.status == "converted" or db.execute(select(Subscription.id).where(Subscription.quotation_id == q.id)).first():
        raise AppError("QUOTATION_ALREADY_CONVERTED", "Already converted", 409)
    if q.status != "accepted":
        raise AppError("QUOTATION_NOT_ACCEPTED", "Only accepted quotations can be converted", 409)
    if q.valid_until and q.valid_until < today_ist():
        raise AppError("QUOTATION_EXPIRED", "Quotation validity has ended", 409)

    plan = q.plan
    assert_plan_available(plan, today_ist())

    start = body.start_date or today_ist()
    expiry = body.expiry_date or plan.available_until
    if plan.auto_close_on_end and expiry is None:
        raise AppError("EXPIRY_REQUIRED", "This plan auto-closes, so an expiry date is required", 422)

    sub = Subscription(
        subscription_number=next_number(db, "SUB"),
        customer_id=q.customer_id,
        plan_id=q.plan_id,
        quotation_id=q.id,
        status="confirmed",  # customer already accepted the quote
        start_date=start,
        expiry_date=expiry,
        payment_terms_days=q.payment_terms_days,
        created_by=user.id,
    )
    for it in q.items:
        sub.items.append(
            SubscriptionItem(
                product_id=it.product_id,
                variant_id=it.variant_id,
                description_snapshot=it.description_snapshot,
                quantity=it.quantity,
                unit_price=it.unit_price,
                tax_rule_id=it.tax_rule_id,
            )
        )
    sub.history.append(
        SubscriptionStatusHistory(
            from_status=None,
            to_status="confirmed",
            changed_by=user.id,
            note=f"Converted from {q.quotation_number}",
        )
    )
    q.status = "converted"
    db.add(sub)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # ux_subscriptions_quotation fired
        raise AppError("QUOTATION_ALREADY_CONVERTED", "Converted by another request", 409)

    db.refresh(sub)
    return sub
