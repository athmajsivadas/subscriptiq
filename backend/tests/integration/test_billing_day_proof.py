import uuid
from datetime import date, timedelta
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.clock import today_ist
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models.all_models import User, Customer, TaxRule, Product, Plan, Subscription, SubscriptionItem
from app.main import app

engine_test = create_engine(settings.TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_billing_day_demo_flow_with_seed():
    """
    Spec 17.2 & 17.3: Prove the demo:
    1. Seed 200 active subscriptions due today
    2. Call POST /simulate/billing-day -> expect invoices_created = 200
    3. Call again -> expect due_found = 0, invoices_created = 0
    """
    settings.ENABLE_BILLING_SIMULATION = True
    today = today_ist()

    admin_id = uuid.uuid4()
    with TestingSessionLocal() as db:
        # Clean up any leftover due subscriptions with invalid tax rules from prior tests
        from sqlalchemy import update
        db.execute(
            update(Subscription)
            .where(Subscription.status == "active", Subscription.next_billing_date <= today)
            .values(status="closed")
        )
        db.commit()

        # Create dedicated admin user in test db
        admin = User(
            id=admin_id,
            full_name="Admin User",
            email=f"admin_{admin_id.hex[:6]}@test.com",
            password_hash=hash_password("Admin#2026"),
            role="admin",
            is_active=True,
        )
        tax = TaxRule(name=f"Tax-{uuid.uuid4().hex[:6]}", rate_percent=Decimal("18.00"))
        prod = Product(name="SaaS", product_type="service", sales_price=Decimal("1000.00"), cost_price=Decimal("200.00"), default_tax_rule=tax)
        db.add_all([admin, tax, prod])
        db.flush()

        plan = Plan(product_id=prod.id, name="Monthly Plan", price=Decimal("1000.00"), billing_cycle="monthly")
        cust = Customer(company_name="Demo Customer Org")
        db.add_all([plan, cust])
        db.flush()

        # Seed exactly 200 due subscriptions
        subs = []
        for i in range(200):
            s = Subscription(
                subscription_number=f"DEMO-PF-{uuid.uuid4().hex[:8]}",
                customer_id=cust.id,
                plan_id=plan.id,
                status="active",
                start_date=today,
                current_period_start=today,
                current_period_end=today + timedelta(days=30),
                next_billing_date=today,
            )
            s.items.append(SubscriptionItem(
                product_id=prod.id,
                description_snapshot="SaaS",
                quantity=1,
                unit_price=Decimal("1000.00"),
                tax_rule_id=tax.id
            ))
            subs.append(s)
        db.add_all(subs)
        db.commit()

    token = create_access_token(str(admin_id), "admin")
    headers = {"Authorization": f"Bearer {token}"}

    # Click 1: Run billing day simulation
    res1 = client.post("/api/simulate/billing-day?limit=200", headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["invoices_created"] == 200, f"Expected 200 created, got {data1}"

    # Click 2: Run again -> nothing due
    res2 = client.post("/api/simulate/billing-day?limit=200", headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["due_found"] == 0
    assert data2["invoices_created"] == 0
