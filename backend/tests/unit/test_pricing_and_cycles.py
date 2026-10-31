from datetime import date
from decimal import Decimal
import pytest
from app.services.billing_service import add_cycle, cycle_end
from app.services.pricing import line_unit_price, assert_plan_available
from app.core.errors import AppError
from app.models.all_models import Plan, Product, ProductVariant
import uuid

def test_month_end_arithmetic_all_cycles():
    # Jan 31 -> Feb 28 (non-leap) or Feb 29 (leap)
    jan_31_2026 = date(2026, 1, 31)

    # daily
    assert add_cycle(jan_31_2026, "daily") == date(2026, 2, 1)
    assert cycle_end(jan_31_2026, "daily") == date(2026, 1, 31)

    # weekly
    assert add_cycle(jan_31_2026, "weekly") == date(2026, 2, 7)
    assert cycle_end(jan_31_2026, "weekly") == date(2026, 2, 6)

    # monthly: Jan 31 -> Feb 28 in 2026 (clamped)
    assert add_cycle(jan_31_2026, "monthly") == date(2026, 2, 28)
    assert cycle_end(jan_31_2026, "monthly") == date(2026, 2, 27)

    # yearly: Feb 29, 2024 (leap) -> Feb 28, 2025
    feb_29_2024 = date(2024, 2, 29)
    assert add_cycle(feb_29_2024, "yearly") == date(2025, 2, 28)

def test_line_unit_price_variant_counted_once():
    prod_id = uuid.uuid4()
    plan = Plan(id=uuid.uuid4(), product_id=prod_id, price=Decimal("1000.00"), billing_cycle="monthly")
    product = Product(id=prod_id, name="Software Subscription", product_type="service", sales_price=Decimal("1200.00"), cost_price=Decimal("400.00"))
    variant = ProductVariant(id=uuid.uuid4(), product_id=prod_id, variant_name="Odoo", additional_price=Decimal("560.00"))

    # When product is plan's product: plan.price + variant.additional_price = 1000 + 560 = 1560
    price = line_unit_price(plan, product, variant)
    assert price == Decimal("1560.00")

    # When product is an add-on product: product.sales_price + variant.additional_price
    addon_prod = Product(id=uuid.uuid4(), name="Addon Storage", product_type="service", sales_price=Decimal("200.00"), cost_price=Decimal("50.00"))
    addon_price = line_unit_price(plan, addon_prod, None)
    assert addon_price == Decimal("200.00")

def test_plan_available_assertions():
    plan = Plan(
        id=uuid.uuid4(),
        product_id=uuid.uuid4(),
        name="Limited Plan",
        price=Decimal("500.00"),
        billing_cycle="monthly",
        available_from=date(2026, 5, 1),
        available_until=date(2026, 5, 31),
        is_active=True,
    )
    # Before available_from
    with pytest.raises(AppError) as e1:
        assert_plan_available(plan, date(2026, 4, 30))
    assert e1.value.code == "PLAN_UNAVAILABLE"

    # Within range
    assert_plan_available(plan, date(2026, 5, 15))

    # After available_until
    with pytest.raises(AppError) as e2:
        assert_plan_available(plan, date(2026, 6, 1))
    assert e2.value.code == "PLAN_UNAVAILABLE"
