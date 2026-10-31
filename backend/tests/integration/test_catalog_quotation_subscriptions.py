import uuid
from datetime import date, timedelta
from decimal import Decimal
from threading import Thread
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.config import settings
from app.core.database import get_db, Base
from app.core.security import create_access_token, hash_password
from app.core.clock import today_ist
from app.models.all_models import (
    User, Customer, TaxRule, Product, ProductVariant, Plan,
    QuotationTemplate, QuotationTemplateLine, Quotation, QuotationItem,
    Subscription, SubscriptionItem
)

engine_test = create_engine(settings.TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def ensure_schema():
    Base.metadata.create_all(bind=engine_test)
    yield

client = TestClient(app)

def create_admin_and_staff_and_customer():
    with TestingSessionLocal() as db:
        admin_id = uuid.uuid4()
        admin = User(id=admin_id, full_name="Admin", email=f"adm_{admin_id.hex[:6]}@test.com", password_hash=hash_password("Admin#2026"), role="admin", is_active=True)
        staff_id = uuid.uuid4()
        staff = User(id=staff_id, full_name="Staff", email=f"stf_{staff_id.hex[:6]}@test.com", password_hash=hash_password("Staff#2026"), role="staff", is_active=True)
        cust_user_id = uuid.uuid4()
        cust_user = User(id=cust_user_id, full_name="Cust User", email=f"cst_{cust_user_id.hex[:6]}@test.com", password_hash=hash_password("Customer#2026"), role="customer", is_active=True)
        customer_id = uuid.uuid4()
        customer = Customer(id=customer_id, user_id=cust_user_id, company_name="Customer Org")
        db.add_all([admin, staff, cust_user, customer])
        db.commit()

    admin_token = create_access_token(str(admin_id), "admin")
    staff_token = create_access_token(str(staff_id), "staff")
    cust_token = create_access_token(str(cust_user_id), "customer")
    return admin_token, staff_token, cust_token, customer_id

def test_template_copy_and_quotation_conversion_lifecycle():
    admin_tok, staff_tok, cust_tok, cust_id = create_admin_and_staff_and_customer()

    # 1. Admin creates TaxRule, Product with variant, and Plan
    with TestingSessionLocal() as db:
        tax = TaxRule(name="GST 18%", rate_percent=Decimal("18.00"))
        prod = Product(name="Enterprise Suite", product_type="service", sales_price=Decimal("1000.00"), cost_price=Decimal("300.00"), default_tax_rule=tax)
        var = ProductVariant(product=prod, variant_name="Odoo", additional_price=Decimal("560.00"))
        plan = Plan(product=prod, name="Enterprise Monthly", price=Decimal("1000.00"), billing_cycle="monthly", minimum_quantity=1, allow_pause=True, allow_early_close=True, allow_renewal=True)
        db.add_all([tax, prod, var, plan])
        db.commit()
        db.refresh(tax); db.refresh(prod); db.refresh(var); db.refresh(plan)
        tax_id, prod_id, var_id, plan_id = tax.id, prod.id, var.id, plan.id

    # 2. Admin creates template
    res_tmpl = client.post(
        "/api/quotation-templates",
        headers={"Authorization": f"Bearer {admin_tok}"},
        json={
            "name": "Standard Onboarding Template",
            "plan_id": str(plan_id),
            "validity_days": 15,
            "payment_terms_days": 15,
            "lines": [
                {"product_id": str(prod_id), "variant_id": str(var_id), "quantity": 1}
            ],
        },
    )
    assert res_tmpl.status_code == 201
    tmpl_id = res_tmpl.json()["id"]

    # 3. Staff creates quotation from template
    res_q = client.post(
        "/api/quotations/from-template",
        headers={"Authorization": f"Bearer {staff_tok}"},
        json={"template_id": tmpl_id, "customer_id": str(cust_id)},
    )
    assert res_q.status_code == 201
    q_data = res_q.json()
    q_id = q_data["id"]

    # Verify unit_price snapshot: 1000 + 560 = 1560.00
    item = q_data["items"][0]
    assert Decimal(str(item["unit_price"])) == Decimal("1560.00")
    # Subtotal 1560.00, Tax 18% = 280.80, Grand Total = 1840.80
    assert Decimal(str(q_data["subtotal"])) == Decimal("1560.00")
    assert Decimal(str(q_data["tax_total"])) == Decimal("280.80")
    assert Decimal(str(q_data["grand_total"])) == Decimal("1840.80")

    # 4. Conversion before accept fails (QUOTATION_NOT_ACCEPTED)
    res_conv_early = client.post(
        f"/api/quotations/{q_id}/convert",
        headers={"Authorization": f"Bearer {staff_tok}"},
        json={},
    )
    assert res_conv_early.status_code == 409
    assert res_conv_early.json()["error"]["code"] == "QUOTATION_NOT_ACCEPTED"

    # Staff accepts quotation
    res_acc = client.post(f"/api/quotations/{q_id}/accept", headers={"Authorization": f"Bearer {staff_tok}"})
    assert res_acc.status_code == 200
    assert res_acc.json()["status"] == "accepted"

    # 5. Convert quotation to subscription -> creates Confirmed subscription with copied items
    res_conv = client.post(
        f"/api/quotations/{q_id}/convert",
        headers={"Authorization": f"Bearer {staff_tok}"},
        json={},
    )
    assert res_conv.status_code == 200
    sub_data = res_conv.json()
    assert sub_data["status"] == "confirmed"
    assert len(sub_data["items"]) == 1
    assert Decimal(str(sub_data["items"][0]["unit_price"])) == Decimal("1560.00")
    sub_id = sub_data["id"]

    # 6. Converting again is blocked (QUOTATION_ALREADY_CONVERTED)
    res_conv_again = client.post(
        f"/api/quotations/{q_id}/convert",
        headers={"Authorization": f"Bearer {staff_tok}"},
        json={},
    )
    assert res_conv_again.status_code == 409
    assert res_conv_again.json()["error"]["code"] == "QUOTATION_ALREADY_CONVERTED"

    # 7. Lifecycle transitions: confirmed -> active -> paused -> active -> closed
    # confirmed -> active
    res_act = client.post(f"/api/subscriptions/{sub_id}/activate", headers={"Authorization": f"Bearer {staff_tok}"})
    assert res_act.status_code == 200
    assert res_act.json()["status"] == "active"
    assert res_act.json()["current_period_start"] is not None

    # active -> paused (via customer portal)
    res_pause = client.post(f"/api/portal/subscriptions/{sub_id}/pause", headers={"Authorization": f"Bearer {cust_tok}"})
    assert res_pause.status_code == 200
    assert res_pause.json()["status"] == "paused"

    # paused -> active (via customer portal resume)
    res_res = client.post(f"/api/portal/subscriptions/{sub_id}/resume", headers={"Authorization": f"Bearer {cust_tok}"})
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "active"

    # Customer renew
    res_ren = client.post(f"/api/portal/subscriptions/{sub_id}/renew", headers={"Authorization": f"Bearer {cust_tok}"})
    assert res_ren.status_code == 200

    # active -> closed
    res_close = client.post(f"/api/portal/subscriptions/{sub_id}/close", headers={"Authorization": f"Bearer {cust_tok}"})
    assert res_close.status_code == 200
    assert res_close.json()["status"] == "closed"

    # closed can never resume -> ILLEGAL_TRANSITION
    res_reopen = client.post(f"/api/subscriptions/{sub_id}/resume", headers={"Authorization": f"Bearer {staff_tok}"})
    assert res_reopen.status_code == 409
    assert res_reopen.json()["error"]["code"] == "ILLEGAL_TRANSITION"

def test_plan_flags_pause_and_early_close_enforced():
    admin_tok, staff_tok, cust_tok, cust_id = create_admin_and_staff_and_customer()

    # Create plan with allow_pause=False, allow_early_close=False
    with TestingSessionLocal() as db:
        prod = Product(name="Rigid Plan Prod", product_type="service", sales_price=Decimal("500.00"), cost_price=Decimal("100.00"))
        plan = Plan(product=prod, name="Rigid Plan", price=Decimal("500.00"), billing_cycle="monthly", allow_pause=False, allow_early_close=False)
        db.add_all([prod, plan])
        db.commit()
        db.refresh(prod); db.refresh(plan)

        sub = Subscription(
            subscription_number="SUB-RIGID-001", customer_id=cust_id, plan_id=plan.id,
            status="confirmed", start_date=today_ist(),
        )
        sub.items.append(SubscriptionItem(product_id=prod.id, description_snapshot="Rigid Item", quantity=1, unit_price=Decimal("500.00")))
        db.add(sub)
        db.commit()
        db.refresh(sub)
        sub_id = sub.id

    # Activate
    client.post(f"/api/subscriptions/{sub_id}/activate", headers={"Authorization": f"Bearer {staff_tok}"})

    # Pause attempt by staff -> PAUSE_NOT_ALLOWED
    res_pause = client.post(f"/api/subscriptions/{sub_id}/pause", headers={"Authorization": f"Bearer {staff_tok}"})
    assert res_pause.status_code == 409
    assert res_pause.json()["error"]["code"] == "PAUSE_NOT_ALLOWED"

    # Pause attempt by customer -> PAUSE_NOT_ALLOWED
    res_cust_pause = client.post(f"/api/portal/subscriptions/{sub_id}/pause", headers={"Authorization": f"Bearer {cust_tok}"})
    assert res_cust_pause.status_code == 409
    assert res_cust_pause.json()["error"]["code"] == "PAUSE_NOT_ALLOWED"

    # Early close attempt by customer -> EARLY_CLOSE_NOT_ALLOWED
    res_cust_close = client.post(f"/api/portal/subscriptions/{sub_id}/close", headers={"Authorization": f"Bearer {cust_tok}"})
    assert res_cust_close.status_code == 409
    assert res_cust_close.json()["error"]["code"] == "EARLY_CLOSE_NOT_ALLOWED"

def test_portal_ownership_enforcement_returns_404():
    admin_tok, staff_tok, cust_tok1, cust_id1 = create_admin_and_staff_and_customer()
    _, _, cust_tok2, cust_id2 = create_admin_and_staff_and_customer()

    # Customer 1 has a subscription
    with TestingSessionLocal() as db:
        prod = Product(name="Cust1 Prod", product_type="service", sales_price=Decimal("100.00"), cost_price=Decimal("10.00"))
        db.add(prod)
        db.flush()
        plan = Plan(product_id=prod.id, name="Cust1 Plan", price=Decimal("100.00"), billing_cycle="monthly")
        db.add(plan)
        db.flush()
        sub = Subscription(subscription_number=f"SUB-CUST1-{uuid.uuid4().hex[:6]}", customer_id=cust_id1, plan_id=plan.id, status="active", start_date=today_ist())
        sub.items.append(SubscriptionItem(product_id=prod.id, description_snapshot="Cust1 Item", quantity=1, unit_price=Decimal("100.00")))
        db.add(sub)
        db.commit()
        db.refresh(sub)
        sub1_id = sub.id

    # Customer 2 attempts to access Customer 1's subscription -> 404
    res_get = client.get(f"/api/portal/subscriptions/{sub1_id}", headers={"Authorization": f"Bearer {cust_tok2}"})
    assert res_get.status_code == 404
    assert res_get.json()["error"]["code"] == "NOT_FOUND"

    res_pause = client.post(f"/api/portal/subscriptions/{sub1_id}/pause", headers={"Authorization": f"Bearer {cust_tok2}"})
    assert res_pause.status_code == 404
    assert res_pause.json()["error"]["code"] == "NOT_FOUND"

def test_concurrent_quotation_conversion_yields_one_subscription():
    admin_tok, staff_tok, cust_tok, cust_id = create_admin_and_staff_and_customer()

    with TestingSessionLocal() as db:
        prod = Product(name="Concurrency Prod", product_type="service", sales_price=Decimal("200.00"), cost_price=Decimal("50.00"))
        plan = Plan(product=prod, name="Concurrency Plan", price=Decimal("200.00"), billing_cycle="monthly")
        q = Quotation(
            quotation_number=f"QUO-CONC-{uuid.uuid4().hex[:6]}",
            customer_id=cust_id,
            plan=plan,
            issue_date=today_ist(),
            status="accepted",
            subtotal=Decimal("200.00"),
            tax_total=Decimal("0.00"),
            grand_total=Decimal("200.00"),
        )
        q.items.append(QuotationItem(product=prod, description_snapshot="Item", quantity=1, unit_price=Decimal("200.00"), line_total=Decimal("200.00")))
        db.add_all([prod, plan, q])
        db.commit()
        db.refresh(q)
        q_id = q.id

    statuses = []

    def convert_worker():
        c = TestClient(app)
        res = c.post(
            f"/api/quotations/{q_id}/convert",
            headers={"Authorization": f"Bearer {staff_tok}"},
            json={},
        )
        statuses.append(res.status_code)

    t1 = Thread(target=convert_worker)
    t2 = Thread(target=convert_worker)
    t1.start(); t2.start()
    t1.join(); t2.join()

    # Exactly one succeeded with 200, one failed with 409
    assert 200 in statuses
    assert 409 in statuses
    with TestingSessionLocal() as db:
        subs = db.execute(select(Subscription).where(Subscription.quotation_id == q_id)).scalars().all()
        assert len(subs) == 1
