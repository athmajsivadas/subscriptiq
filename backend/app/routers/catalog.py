from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import get_current_user, admin_only, staff_plus
from app.core.errors import AppError
from app.core.clock import today_ist
from app.services.audit_service import audit
from app.models.all_models import (
    TaxRule,
    Product,
    ProductVariant,
    Plan,
    Discount,
    DiscountProduct,
    User,
    Customer,
)
from app.schemas.catalog import (
    TaxRuleCreate, TaxRuleUpdate, TaxRuleResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    ProductVariantCreate, ProductVariantUpdate, ProductVariantResponse,
    PlanCreate, PlanUpdate, PlanResponse,
    DiscountCreate, DiscountUpdate, DiscountResponse,
    CustomerCreate, CustomerResponse,
)

router = APIRouter(tags=["catalog"])

# --- TAX RULES ---
@router.post("/tax-rules", status_code=201, response_model=TaxRuleResponse)
def create_tax_rule(body: TaxRuleCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    rule = TaxRule(
        name=body.name.strip(),
        rate_percent=body.rate_percent,
        valid_from=body.valid_from,
        valid_until=body.valid_until,
        description=body.description,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.get("/tax-rules", response_model=List[TaxRuleResponse])
def list_tax_rules(db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    return db.execute(select(TaxRule).order_by(TaxRule.name)).scalars().all()

@router.patch("/tax-rules/{id}", response_model=TaxRuleResponse)
def update_tax_rule(id: UUID, body: TaxRuleUpdate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    rule = db.get(TaxRule, id)
    if not rule:
        raise AppError("NOT_FOUND", "Tax rule not found", 404)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(rule, field, val)
    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/tax-rules/{id}", status_code=204)
def archive_tax_rule(id: UUID, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    rule = db.get(TaxRule, id)
    if not rule:
        raise AppError("NOT_FOUND", "Tax rule not found", 404)
    rule.is_active = False
    db.commit()

# --- PRODUCTS ---
@router.post("/products", status_code=201, response_model=ProductResponse)
def create_product(body: ProductCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if body.default_tax_rule_id:
        tax_rule = db.get(TaxRule, body.default_tax_rule_id)
        if not tax_rule:
            raise AppError("TAX_RULE_NOT_FOUND", "Default tax rule not found", 404)
    prod = Product(
        name=body.name.strip(),
        product_type=body.product_type.strip(),
        sales_price=body.sales_price,
        cost_price=body.cost_price,
        notes=body.notes,
        default_tax_rule_id=body.default_tax_rule_id,
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod

@router.get("/products", response_model=List[ProductResponse])
def list_products(db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    return db.execute(select(Product).order_by(Product.name)).scalars().all()

@router.get("/products/{id}", response_model=ProductResponse)
def get_product(id: UUID, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    prod = db.get(Product, id)
    if not prod:
        raise AppError("NOT_FOUND", "Product not found", 404)
    return prod

@router.patch("/products/{id}", response_model=ProductResponse)
def update_product(id: UUID, body: ProductUpdate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    prod = db.get(Product, id)
    if not prod:
        raise AppError("NOT_FOUND", "Product not found", 404)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(prod, field, val)
    db.commit()
    db.refresh(prod)
    return prod

@router.delete("/products/{id}", status_code=204)
def archive_product(id: UUID, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    prod = db.get(Product, id)
    if not prod:
        raise AppError("NOT_FOUND", "Product not found", 404)
    prod.is_active = False
    db.commit()

# --- VARIANTS ---
@router.post("/products/{product_id}/variants", status_code=201, response_model=ProductVariantResponse)
def create_variant(product_id: UUID, body: ProductVariantCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    prod = db.get(Product, product_id)
    if not prod:
        raise AppError("NOT_FOUND", "Product not found", 404)
    variant = ProductVariant(
        product_id=product_id,
        variant_name=body.variant_name.strip(),
        additional_price=body.additional_price,
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant

@router.patch("/variants/{id}", response_model=ProductVariantResponse)
def update_variant(id: UUID, body: ProductVariantUpdate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    variant = db.get(ProductVariant, id)
    if not variant:
        raise AppError("NOT_FOUND", "Product variant not found", 404)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(variant, field, val)
    db.commit()
    db.refresh(variant)
    return variant

# --- PLANS ---
@router.post("/plans", status_code=201, response_model=PlanResponse)
def create_plan(body: PlanCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    prod = db.get(Product, body.product_id)
    if not prod:
        raise AppError("NOT_FOUND", "Product not found", 404)
    plan = Plan(
        product_id=body.product_id,
        name=body.name.strip(),
        price=body.price,
        billing_cycle=body.billing_cycle,
        minimum_quantity=body.minimum_quantity,
        available_from=body.available_from,
        available_until=body.available_until,
        allow_pause=body.allow_pause,
        allow_early_close=body.allow_early_close,
        allow_renewal=body.allow_renewal,
        auto_close_on_end=body.auto_close_on_end,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/plans", response_model=List[PlanResponse])
def list_plans(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Customers only get available plans
    today = today_ist()
    stmt = select(Plan).where(Plan.is_active.is_(True))
    if user.role == "customer":
        stmt = stmt.where(
            (Plan.available_from.is_(None) | (Plan.available_from <= today)),
            (Plan.available_until.is_(None) | (Plan.available_until >= today)),
        )
    return db.execute(stmt.order_by(Plan.name)).scalars().all()

@router.get("/plans/{id}", response_model=PlanResponse)
def get_plan(id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.get(Plan, id)
    if not plan or (user.role == "customer" and not plan.is_active):
        raise AppError("NOT_FOUND", "Plan not found", 404)
    return plan

@router.patch("/plans/{id}", response_model=PlanResponse)
def update_plan(id: UUID, body: PlanUpdate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    plan = db.get(Plan, id)
    if not plan:
        raise AppError("NOT_FOUND", "Plan not found", 404)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(plan, field, val)
    db.commit()
    db.refresh(plan)
    return plan

@router.delete("/plans/{id}", status_code=204)
def archive_plan(id: UUID, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    plan = db.get(Plan, id)
    if not plan:
        raise AppError("NOT_FOUND", "Plan not found", 404)
    plan.is_active = False
    db.commit()

# --- DISCOUNTS ---
@router.post("/discounts", status_code=201, response_model=DiscountResponse)
def create_discount(body: DiscountCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if body.discount_type == "percentage" and (body.value < 0 or body.value > 100):
        raise AppError("INVALID_DISCOUNT", "Percentage discount must be between 0 and 100", 422)

    discount = Discount(
        name=body.name.strip(),
        discount_type=body.discount_type,
        value=body.value,
        minimum_purchase=body.minimum_purchase,
        minimum_quantity=body.minimum_quantity,
        starts_on=body.starts_on,
        ends_on=body.ends_on,
        usage_limit=body.usage_limit,
        scope=body.scope,
        created_by=admin.id,
    )
    if body.scope == "products" and body.product_ids:
        for pid in body.product_ids:
            discount.products.append(DiscountProduct(discount_id=discount.id, product_id=pid))

    db.add(discount)
    audit(db, admin, "discount.created", "discount", discount.id, {"name": discount.name})
    db.commit()
    db.refresh(discount)
    return discount

@router.get("/discounts", response_model=List[DiscountResponse])
def list_discounts(db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    return db.execute(select(Discount).order_by(Discount.name)).scalars().all()

@router.patch("/discounts/{id}", response_model=DiscountResponse)
def update_discount(id: UUID, body: DiscountUpdate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    discount = db.get(Discount, id)
    if not discount:
        raise AppError("NOT_FOUND", "Discount not found", 404)

    data = body.model_dump(exclude_unset=True)
    product_ids = data.pop("product_ids", None)

    for field, val in data.items():
        setattr(discount, field, val)

    if discount.discount_type == "percentage" and (discount.value < 0 or discount.value > 100):
        raise AppError("INVALID_DISCOUNT", "Percentage discount must be between 0 and 100", 422)

    if product_ids is not None and discount.scope == "products":
        discount.products.clear()
        for pid in product_ids:
            discount.products.append(DiscountProduct(discount_id=discount.id, product_id=pid))

    audit(db, admin, "discount.updated", "discount", discount.id, {"name": discount.name})
    db.commit()
    db.refresh(discount)
    return discount

@router.delete("/discounts/{id}", status_code=204)
def archive_discount(id: UUID, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    discount = db.get(Discount, id)
    if not discount:
        raise AppError("NOT_FOUND", "Discount not found", 404)
    discount.is_active = False
    audit(db, admin, "discount.archived", "discount", discount.id, {})
    db.commit()

# --- CUSTOMERS ---
@router.get("/customers", response_model=List[CustomerResponse])
def list_customers(db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    return db.execute(select(Customer).order_by(Customer.created_at.desc())).scalars().all()

@router.post("/customers", status_code=201, response_model=CustomerResponse)
def create_customer(body: CustomerCreate, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    c = Customer(
        company_name=body.company_name.strip(),
        phone=body.phone,
        billing_address=body.billing_address,
        tax_identifier=body.tax_identifier,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c
