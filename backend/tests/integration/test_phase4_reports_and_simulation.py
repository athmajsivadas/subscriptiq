import uuid
from datetime import date, timedelta
from decimal import Decimal
import pytest
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.clock import today_ist
from app.core.database import get_db, Base
from app.core.security import create_access_token, hash_password
from app.models.all_models import (
    User, Customer, TaxRule, Product, Plan,
    Subscription, SubscriptionItem, Invoice, Payment
)
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

def test_portal_ownership_strict_404():
    """Portal read endpoints return 404 when querying another customer's data."""
    u1_id = uuid.uuid4()
    u2_id = uuid.uuid4()

    with TestingSessionLocal() as db:
        u1 = User(id=u1_id, full_name="User 1", email=f"u1_{u1_id.hex[:6]}@test.com", password_hash=hash_password("Pass#1234"), role="customer", is_active=True)
        u2 = User(id=u2_id, full_name="User 2", email=f"u2_{u2_id.hex[:6]}@test.com", password_hash=hash_password("Pass#1234"), role="customer", is_active=True)
        c1 = Customer(user_id=u1_id, company_name="Org 1")
        c2 = Customer(user_id=u2_id, company_name="Org 2")
        p = Product(name="Prod", product_type="service", sales_price=Decimal("100"), cost_price=Decimal("50"))
        db.add_all([u1, u2, c1, c2, p])
        db.flush()

        plan = Plan(product_id=p.id, name="Plan", price=Decimal("100"), billing_cycle="monthly")
        db.add(plan)
        db.flush()

        # Subscription belonging to Customer 2
        sub2 = Subscription(
            subscription_number=f"SUB-OTHER-{uuid.uuid4().hex[:6]}",
            customer_id=c2.id,
            plan_id=plan.id,
            status="active",
            start_date=today_ist(),
        )
        db.add(sub2)
        db.flush()

        # Confirmed invoice belonging to Customer 2
        inv2 = Invoice(
            invoice_number=f"INV-OTHER-{uuid.uuid4().hex[:6]}",
            customer_id=c2.id,
            subscription_id=sub2.id,
            billing_period_start=today_ist(),
            billing_period_end=today_ist() + timedelta(days=30),
            issue_date=today_ist(),
            due_date=today_ist() + timedelta(days=15),
            grand_total=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("100.00"),
            status="confirmed",
        )
        db.add(inv2)
        db.commit()
        sub2_id = sub2.id
        inv2_id = inv2.id

    token_u1 = create_access_token(str(u1_id), "customer")
    h1 = {"Authorization": f"Bearer {token_u1}"}

    # User 1 tries to access User 2's subscription -> 404
    r_sub = client.get(f"/api/portal/subscriptions/{sub2_id}", headers=h1)
    assert r_sub.status_code == 404

    # User 1 tries to access User 2's invoice -> 404
    r_inv = client.get(f"/api/portal/invoices/{inv2_id}", headers=h1)
    assert r_inv.status_code == 404

def test_billing_day_demo_flow_test_db():
    """
    Test simulating billing day:
    1. Seed due subscriptions
    2. Call /simulate/billing-day -> creates invoices
    3. Call again -> due_found = 0
    """
    admin_id = uuid.uuid4()
    with TestingSessionLocal() as db:
        admin = User(id=admin_id, full_name="Admin", email=f"adm_{admin_id.hex[:6]}@test.com", password_hash=hash_password("Admin#2026"), role="admin", is_active=True)
        tax = TaxRule(name=f"Tax-{uuid.uuid4().hex[:6]}", rate_percent=Decimal("18.00"))
        prod = Product(name="SaaS", product_type="service", sales_price=Decimal("1000.00"), cost_price=Decimal("200.00"), default_tax_rule=tax)
        plan = Plan(product=prod, name="Plan", price=Decimal("1000.00"), billing_cycle="monthly")
        cust = Customer(company_name="Sim Cust")
        db.add_all([admin, tax, prod, plan, cust])
        db.flush()

        # Create 5 due subscriptions for testing
        due_sub_ids = []
        for i in range(5):
            s = Subscription(
                subscription_number=f"SIM-SUB-{uuid.uuid4().hex[:6]}",
                customer_id=cust.id,
                plan_id=plan.id,
                status="active",
                start_date=today_ist(),
                current_period_start=today_ist(),
                current_period_end=today_ist() + timedelta(days=30),
                next_billing_date=today_ist(),
            )
            s.items.append(SubscriptionItem(product_id=prod.id, description_snapshot="SaaS", quantity=1, unit_price=Decimal("1000.00"), tax_rule_id=tax.id))
            db.add(s)
            db.flush()
            due_sub_ids.append(s.id)
        db.commit()

    from app.core.config import settings
    # Enable simulation in settings for the test
    settings.ENABLE_BILLING_SIMULATION = True

    admin_token = create_access_token(str(admin_id), "admin")
    h_admin = {"Authorization": f"Bearer {admin_token}"}

    # 1st run
    res1 = client.post("/api/simulate/billing-day?limit=200", headers=h_admin)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["invoices_created"] >= 5

    # 2nd run for these 5 subscriptions
    with TestingSessionLocal() as db:
        # Check that our 5 subscriptions advanced their next_billing_date
        advanced_count = db.scalar(
            select(func.count()).select_from(Subscription)
            .where(Subscription.id.in_(due_sub_ids), Subscription.next_billing_date > today_ist())
        )
        assert advanced_count == 5

    res2 = client.post("/api/simulate/billing-day?limit=200", headers=h_admin)
    assert res2.status_code == 200
    data2 = res2.json()
    # None of our 5 subscriptions should be created again
    assert data2["invoices_created"] == 0
