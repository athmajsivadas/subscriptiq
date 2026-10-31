from decimal import Decimal
from datetime import date
from typing import Optional
from app.core.money import money, ZERO
from app.core.errors import AppError
from app.models.all_models import Plan, Product, ProductVariant

def line_unit_price(plan: Plan, product: Product, variant: Optional[ProductVariant] = None) -> Decimal:
    """
    Section 8.2: Single pricing rule.
    Line unit_price is a final, variant-inclusive snapshot.
    Base price is plan.price if product is the plan's product, else product.sales_price.
    Variant adds additional_price (e.g. Odoo +560).
    """
    base = plan.price if product.id == plan.product_id else product.sales_price
    return money(base + (variant.additional_price if variant else ZERO))

def assert_plan_available(plan: Plan, on_date: date) -> None:
    """Validate that plan is active and within available_from and available_until."""
    if not plan or not plan.is_active:
        raise AppError("PLAN_UNAVAILABLE", "Plan is inactive or does not exist", 409)
    if plan.available_from and plan.available_from > on_date:
        raise AppError("PLAN_UNAVAILABLE", f"Plan is not available until {plan.available_from}", 409)
    if plan.available_until and plan.available_until < on_date:
        raise AppError("PLAN_UNAVAILABLE", f"Plan availability ended on {plan.available_until}", 409)
