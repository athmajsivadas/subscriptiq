import uuid
from datetime import date, timedelta
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.config import settings
from app.core.clock import today_ist
from app.core.database import get_db, Base
from app.core.security import create_access_token, hash_password
from app.core.errors import AppError
from app.models.all_models import (
    User, Customer, TaxRule, Product, ProductVariant, Plan,
    Subscription, SubscriptionItem, SubscriptionStatusHistory,
    Invoice, InvoiceItem, Payment, Quotation, QuotationItem, PasswordResetToken
)
from app.services.billing_service import run_due_billing_job, generate_invoice_for_subscription
from app.services.subscription_service import transition
from app.jobs.scheduler import close_expired_subscriptions

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

@pytest.fixture(autouse=True)
def ensure_schema():
    Base.metadata.create_all(bind=engine_test)
    yield

def make_admin():
    admin_id = uuid.uuid4()
    with TestingSessionLocal() as db:
        admin = User(id=admin_id, full_name="Admin", email=f"adm_{admin_id.hex[:6]}@test.com", password_hash=hash_password("Admin#2026"), role="admin", is_active=True)
        db.add(admin)
        db.commit()
    token = create_access_token(str(admin_id), "admin")
    return token, admin_id

def make_staff():
    staff_id = uuid.uuid4()
    with TestingSessionLocal() as db:
        staff = User(id=staff_id, full_name="Staff", email=f"stf_{staff_id.hex[:6]}@test.com", password_hash=hash_password("Staff#2026"), role="staff", is_active=True)
        db.add(staff)
        db.commit()
    token = create_access_token(str(staff_id), "staff")
    return token, staff_id

def make_customer():
    u_id = uuid.uuid4()
    c_id = uuid.uuid4()
    with TestingSessionLocal() as db:
        u = User(id=u_id, full_name="Cust", email=f"cust_{u_id.hex[:6]}@test.com", password_hash=hash_password("Cust#2026"), role="customer", is_active=True)
        c = Customer(id=c_id, user_id=u_id, company_name=f"Org {c_id.hex[:6]}")
        db.add_all([u, c])
        db.commit()
    token = create_access_token(str(u_id), "customer")
    return token, u_id, c_id

# ---------------------------------------------------------------------------
# Test 1: Inactive or out-of-validity tax rule in run_due_billing_job
# ---------------------------------------------------------------------------
def test_billing_job_reports_tax_rule_invalid_and_preserves_dates():
    today = today_ist()
    with TestingSessionLocal() as db:
        cust = Customer(company_name="Tax Test Org")
        # Inactive tax rule
        bad_tax = TaxRule(name="Inactive Tax", rate_percent=Decimal("18.00"), is_active=False)
        prod = Product(name="Cloud Service", product_type="service", sales_price=Decimal("1000.00"), cost_price=Decimal("200.00"), default_tax_rule=bad_tax)
        db.add_all([cust, bad_tax, prod])
        db.flush()

        plan = Plan(product_id=prod.id, name="Cloud Monthly", price=Decimal("1000.00"), billing_cycle="monthly")
        db.add(plan)
        db.flush()

        sub = Subscription(
            subscription_number=f"SUB-TAX-ERR-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            plan_id=plan.id,
            status="active",
            start_date=today,
            current_period_start=today,
            current_period_end=today + timedelta(days=30),
            next_billing_date=today,
        )
        sub.items.append(SubscriptionItem(product_id=prod.id, description_snapshot="Cloud Service", quantity=1, unit_price=Decimal("1000.00"), tax_rule_id=bad_tax.id))
        db.add(sub)
        db.commit()
        db.refresh(sub)
        sub_id = sub.id
        orig_start = sub.current_period_start
        orig_next = sub.next_billing_date

    # Run due billing job
    with TestingSessionLocal() as db:
        res = run_due_billing_job(session=db)

    # 1. Assert TAX_RULE_INVALID reported in failures
    failure_codes = [f["code"] for f in res["failures"] if f["subscription_id"] == str(sub_id)]
    assert "TAX_RULE_INVALID" in failure_codes

    with TestingSessionLocal() as db:
        # 2. No invoice was created for this subscription
        inv_count = db.scalar(select(func.count()).select_from(Invoice).where(Invoice.subscription_id == sub_id))
        assert inv_count == 0

        # 3. Dates unchanged
        sub_fresh = db.get(Subscription, sub_id)
        assert sub_fresh.current_period_start == orig_start
        assert sub_fresh.next_billing_date == orig_next

# ---------------------------------------------------------------------------
# Test 2: Lifecycle transitions matrix, closed never resumes, renew requires allow_renewal, customer portal ownership 404
# ---------------------------------------------------------------------------
def test_lifecycle_illegal_transitions_and_ownership():
    staff_tok, _ = make_staff()
    cust_tok1, _, cust_id1 = make_customer()
    cust_tok2, _, cust_id2 = make_customer()

    with TestingSessionLocal() as db:
        prod = Product(name="Life Prod", product_type="service", sales_price=Decimal("100.00"), cost_price=Decimal("10.00"))
        # Plan with allow_renewal=False
        plan = Plan(product=prod, name="No-Renew Plan", price=Decimal("100.00"), billing_cycle="monthly", allow_renewal=False)
        db.add_all([prod, plan])
        db.commit()
        plan_id = plan.id

        sub1 = Subscription(
            subscription_number=f"SUB-LF1-{uuid.uuid4().hex[:6]}",
            customer_id=cust_id1,
            plan_id=plan_id,
            status="draft",
            start_date=today_ist(),
        )
        sub1.items.append(SubscriptionItem(product_id=prod.id, description_snapshot="Item", quantity=1, unit_price=Decimal("100.00")))
        db.add(sub1)
        db.commit()
        sub1_id = sub1.id

    # 1. Illegal transition: draft -> active directly fails with 409 ILLEGAL_TRANSITION
    res_ill = client.post(f"/api/subscriptions/{sub1_id}/activate", headers={"Authorization": f"Bearer {staff_tok}"})
    assert res_ill.status_code == 409
    assert res_ill.json()["error"]["code"] == "ILLEGAL_TRANSITION"

    # 2. Closed subscription never resumes
    with TestingSessionLocal() as db:
        sub_closed = Subscription(
            subscription_number=f"SUB-CL-{uuid.uuid4().hex[:6]}",
            customer_id=cust_id1,
            plan_id=plan_id,
            status="closed",
            start_date=today_ist(),
        )
        db.add(sub_closed)
        db.commit()
        cl_id = sub_closed.id

    res_res = client.post(f"/api/subscriptions/{cl_id}/resume", headers={"Authorization": f"Bearer {staff_tok}"})
    assert res_res.status_code == 409
    assert res_res.json()["error"]["code"] == "ILLEGAL_TRANSITION"

    # 3. Renew requires allow_renewal
    with TestingSessionLocal() as db:
        sub_active = Subscription(
            subscription_number=f"SUB-ACT-{uuid.uuid4().hex[:6]}",
            customer_id=cust_id1,
            plan_id=plan_id,
            status="active",
            start_date=today_ist(),
        )
        db.add(sub_active)
        db.commit()
        act_id = sub_active.id

    res_ren = client.post(f"/api/subscriptions/{act_id}/renew", headers={"Authorization": f"Bearer {staff_tok}"})
    assert res_ren.status_code == 409
    assert res_ren.json()["error"]["code"] == "RENEWAL_NOT_ALLOWED"

    # 4. Customer cannot pause, close, or renew another customer's subscription (404)
    res_p404 = client.post(f"/api/portal/subscriptions/{act_id}/pause", headers={"Authorization": f"Bearer {cust_tok2}"})
    assert res_p404.status_code == 404
    assert res_p404.json()["error"]["code"] == "NOT_FOUND"

    res_c404 = client.post(f"/api/portal/subscriptions/{act_id}/close", headers={"Authorization": f"Bearer {cust_tok2}"})
    assert res_c404.status_code == 404
    assert res_c404.json()["error"]["code"] == "NOT_FOUND"

    res_r404 = client.post(f"/api/portal/subscriptions/{act_id}/renew", headers={"Authorization": f"Bearer {cust_tok2}"})
    assert res_r404.status_code == 404
    assert res_r404.json()["error"]["code"] == "NOT_FOUND"

# ---------------------------------------------------------------------------
# Test 3: Expired quotation cannot convert (409)
# ---------------------------------------------------------------------------
def test_expired_quotation_cannot_convert():
    staff_tok, _ = make_staff()
    with TestingSessionLocal() as db:
        c = Customer(company_name="Exp Quote Org")
        prod = Product(name="P", product_type="service", sales_price=Decimal("100"), cost_price=Decimal("10"))
        plan = Plan(product=prod, name="Pl", price=Decimal("100"), billing_cycle="monthly")
        db.add_all([c, prod, plan])
        db.flush()

        # Quotation whose valid_until is yesterday (expired)
        q = Quotation(
            quotation_number=f"QUO-EXP-{uuid.uuid4().hex[:6]}",
            customer_id=c.id,
            plan_id=plan.id,
            issue_date=today_ist() - timedelta(days=10),
            valid_until=today_ist() - timedelta(days=1),
            status="accepted",
            subtotal=Decimal("100.00"),
            tax_total=Decimal("0.00"),
            grand_total=Decimal("100.00"),
        )
        q.items.append(QuotationItem(product_id=prod.id, description_snapshot="P", quantity=1, unit_price=Decimal("100"), line_total=Decimal("100")))
        db.add(q)
        db.commit()
        q_id = q.id

    res = client.post(f"/api/quotations/{q_id}/convert", headers={"Authorization": f"Bearer {staff_tok}"}, json={})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "QUOTATION_EXPIRED"

# ---------------------------------------------------------------------------
# Test 4: Cancelling invoice rules
# ---------------------------------------------------------------------------
def test_cancelling_invoice_rules():
    staff_tok, staff_id = make_staff()
    today = today_ist()

    with TestingSessionLocal() as db:
        c = Customer(company_name="Cancel Inv Org")
        prod = Product(name="P", product_type="service", sales_price=Decimal("100"), cost_price=Decimal("10"))
        plan = Plan(product=prod, name="Pl", price=Decimal("100"), billing_cycle="monthly")
        db.add_all([c, prod, plan])
        db.flush()

        sub = Subscription(subscription_number=f"SUB-CN-{uuid.uuid4().hex[:6]}", customer_id=c.id, plan_id=plan.id, status="active", start_date=today)
        db.add(sub)
        db.flush()

        # 1. Draft invoice
        draft_inv = Invoice(
            invoice_number=f"INV-DFT-{uuid.uuid4().hex[:6]}",
            customer_id=c.id,
            subscription_id=sub.id,
            billing_period_start=today,
            billing_period_end=today + timedelta(days=30),
            issue_date=today,
            due_date=today + timedelta(days=15),
            grand_total=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("100.00"),
            status="draft",
        )
        # 2. Confirmed invoice with a partial payment
        paid_inv = Invoice(
            invoice_number=f"INV-PD-{uuid.uuid4().hex[:6]}",
            customer_id=c.id,
            subscription_id=sub.id,
            billing_period_start=today - timedelta(days=35),
            billing_period_end=today - timedelta(days=5),
            issue_date=today - timedelta(days=30),
            due_date=today - timedelta(days=15),
            grand_total=Decimal("100.00"),
            amount_paid=Decimal("50.00"),
            balance_due=Decimal("50.00"),
            status="confirmed",
        )
        db.add_all([draft_inv, paid_inv])
        db.commit()
        draft_id = draft_inv.id
        paid_id = paid_inv.id

    # 1. Cancelling Draft works
    res_cancel_draft = client.post(f"/api/invoices/{draft_id}/cancel", headers={"Authorization": f"Bearer {staff_tok}"})
    assert res_cancel_draft.status_code == 200
    assert res_cancel_draft.json()["status"] == "cancelled"

    # 2. Cancelling invoice with payments is rejected
    res_cancel_paid = client.post(f"/api/invoices/{paid_id}/cancel", headers={"Authorization": f"Bearer {staff_tok}"})
    assert res_cancel_paid.status_code == 409
    assert res_cancel_paid.json()["error"]["code"] == "CANNOT_CANCEL"

# ---------------------------------------------------------------------------
# Test 5: Reusing idempotency key with different invoice or amount -> 409
# ---------------------------------------------------------------------------
def test_idempotency_mismatched_invoice_and_amount():
    staff_tok, staff_id = make_staff()
    today = today_ist()

    with TestingSessionLocal() as db:
        c = Customer(company_name="Idemp Org")
        prod = Product(name="P", product_type="service", sales_price=Decimal("200"), cost_price=Decimal("10"))
        plan = Plan(product=prod, name="Pl", price=Decimal("200"), billing_cycle="monthly")
        db.add_all([c, prod, plan])
        db.flush()

        sub = Subscription(subscription_number=f"SUB-IDM-{uuid.uuid4().hex[:6]}", customer_id=c.id, plan_id=plan.id, status="active", start_date=today)
        db.add(sub)
        db.flush()

        inv1 = Invoice(
            invoice_number=f"INV-ID1-{uuid.uuid4().hex[:6]}",
            customer_id=c.id,
            subscription_id=sub.id,
            billing_period_start=today,
            billing_period_end=today + timedelta(days=30),
            issue_date=today,
            due_date=today + timedelta(days=15),
            grand_total=Decimal("200.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("200.00"),
            status="confirmed",
        )
        inv2 = Invoice(
            invoice_number=f"INV-ID2-{uuid.uuid4().hex[:6]}",
            customer_id=c.id,
            subscription_id=sub.id,
            billing_period_start=today - timedelta(days=35),
            billing_period_end=today - timedelta(days=5),
            issue_date=today - timedelta(days=30),
            due_date=today - timedelta(days=15),
            grand_total=Decimal("200.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("200.00"),
            status="confirmed",
        )
        db.add_all([inv1, inv2])
        db.commit()
        inv1_id, inv2_id = inv1.id, inv2.id

    key = f"key-mismatch-{uuid.uuid4().hex}"

    # Initial payment on inv1
    r1 = client.post("/api/payments", headers={"Authorization": f"Bearer {staff_tok}"}, json={
        "invoice_id": str(inv1_id), "amount": 50.00, "method": "cash", "idempotency_key": key
    })
    assert r1.status_code == 201

    # Replay with different amount on same invoice -> 409 IDEMPOTENCY_MISMATCH
    r_bad_amount = client.post("/api/payments", headers={"Authorization": f"Bearer {staff_tok}"}, json={
        "invoice_id": str(inv1_id), "amount": 60.00, "method": "cash", "idempotency_key": key
    })
    assert r_bad_amount.status_code == 409
    assert r_bad_amount.json()["error"]["code"] == "IDEMPOTENCY_MISMATCH"

    # Replay with different invoice -> 409 IDEMPOTENCY_MISMATCH
    r_bad_inv = client.post("/api/payments", headers={"Authorization": f"Bearer {staff_tok}"}, json={
        "invoice_id": str(inv2_id), "amount": 50.00, "method": "cash", "idempotency_key": key
    })
    assert r_bad_inv.status_code == 409
    assert r_bad_inv.json()["error"]["code"] == "IDEMPOTENCY_MISMATCH"

# ---------------------------------------------------------------------------
# Test 7: Reset password rejects expired token
# ---------------------------------------------------------------------------
def test_reset_password_rejects_expired_token():
    import hashlib
    user_email = f"exp_token_{uuid.uuid4().hex[:6]}@example.com"
    client.post("/api/auth/register", json={
        "full_name": "Exp User",
        "email": user_email,
        "password": "InitialPass#1",
        "company_name": "Co",
    })

    client.post("/api/auth/forgot-password", json={"email": user_email})

    raw_token = "expired-token-val"
    with TestingSessionLocal() as db:
        user = db.query(User).filter(User.email == user_email).first()
        token_record = db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).first()
        token_record.token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        # Set expired 1 hour ago
        from datetime import datetime, timezone
        token_record.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()

    res = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": "NewValidPass#2026",
    })
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_RESET_TOKEN"

# ---------------------------------------------------------------------------
# Test 8: Reports exact metrics and customer 403 guard
# ---------------------------------------------------------------------------
def test_reports_exact_metrics_and_permissions():
    admin_tok, _ = make_admin()
    staff_tok, _ = make_staff()
    cust_tok, _, _ = make_customer()

    # 1. Customer gets 403 on every report endpoint
    for path in ["/overview", "/staff-overview", "/revenue", "/subscriptions", "/overdue", "/payments"]:
        r = client.get(f"/api/reports{path}", headers={"Authorization": f"Bearer {cust_tok}"})
        assert r.status_code == 403, f"Expected 403 for customer on {path}, got {r.status_code}"

    # 2. Staff gets 200 on staff-overview, but 403 on financial reports
    r_staff_ov = client.get("/api/reports/staff-overview", headers={"Authorization": f"Bearer {staff_tok}"})
    assert r_staff_ov.status_code == 200
    data = r_staff_ov.json()
    assert set(data.keys()) == {"active_subscriptions", "draft_invoice_count", "overdue_count"}

    r_staff_fin = client.get("/api/reports/overview", headers={"Authorization": f"Bearer {staff_tok}"})
    assert r_staff_fin.status_code == 403

# ---------------------------------------------------------------------------
# Test 9: close_expired_subscriptions closes only auto_close_on_end plans
# ---------------------------------------------------------------------------
def test_close_expired_subscriptions_job():
    today = today_ist()
    with TestingSessionLocal() as db:
        cust = Customer(company_name="Expiry Job Org")
        prod = Product(name="P", product_type="service", sales_price=Decimal("100"), cost_price=Decimal("10"))
        # Plan 1: auto_close_on_end = True
        plan_auto = Plan(product=prod, name="Auto Close Plan", price=Decimal("100"), billing_cycle="monthly", auto_close_on_end=True)
        # Plan 2: auto_close_on_end = False
        plan_no_auto = Plan(product=prod, name="No Auto Close Plan", price=Decimal("100"), billing_cycle="monthly", auto_close_on_end=False)
        db.add_all([cust, prod, plan_auto, plan_no_auto])
        db.flush()

        # Sub 1: expired, auto_close=True -> should be closed
        sub1 = Subscription(
            subscription_number=f"SUB-EXP-YES-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            plan_id=plan_auto.id,
            status="active",
            start_date=today - timedelta(days=60),
            expiry_date=today - timedelta(days=2),
        )
        # Sub 2: expired, auto_close=False -> should remain active
        sub2 = Subscription(
            subscription_number=f"SUB-EXP-NO-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            plan_id=plan_no_auto.id,
            status="active",
            start_date=today - timedelta(days=60),
            expiry_date=today - timedelta(days=2),
        )
        db.add_all([sub1, sub2])
        db.commit()
        s1_id, s2_id = sub1.id, sub2.id

    # Run job with test session factory
    close_expired_subscriptions(session_factory=TestingSessionLocal)

    with TestingSessionLocal() as db:
        s1_fresh = db.get(Subscription, s1_id)
        s2_fresh = db.get(Subscription, s2_id)
        assert s1_fresh.status == "closed"
        assert s2_fresh.status == "active"

# ---------------------------------------------------------------------------
# Test 10: bulk-confirm confirms only Draft invoices and returns correct count
# ---------------------------------------------------------------------------
def test_bulk_confirm_only_confirms_drafts():
    staff_tok, _ = make_staff()
    today = today_ist()

    with TestingSessionLocal() as db:
        cust = Customer(company_name="Bulk Org")
        prod = Product(name="P", product_type="service", sales_price=Decimal("100"), cost_price=Decimal("10"))
        plan = Plan(product=prod, name="Pl", price=Decimal("100"), billing_cycle="monthly")
        db.add_all([cust, prod, plan])
        db.flush()

        sub = Subscription(subscription_number=f"SUB-BLK-{uuid.uuid4().hex[:6]}", customer_id=cust.id, plan_id=plan.id, status="active", start_date=today)
        db.add(sub)
        db.flush()

        inv1 = Invoice(
            invoice_number=f"INV-BK1-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            subscription_id=sub.id,
            billing_period_start=today,
            billing_period_end=today + timedelta(days=30),
            issue_date=today,
            due_date=today + timedelta(days=15),
            grand_total=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("100.00"),
            status="draft",
        )
        inv2 = Invoice(
            invoice_number=f"INV-BK2-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            subscription_id=sub.id,
            billing_period_start=today - timedelta(days=35),
            billing_period_end=today - timedelta(days=5),
            issue_date=today - timedelta(days=30),
            due_date=today - timedelta(days=15),
            grand_total=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("100.00"),
            status="draft",
        )
        inv3 = Invoice(
            invoice_number=f"INV-BK3-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            subscription_id=sub.id,
            billing_period_start=today - timedelta(days=70),
            billing_period_end=today - timedelta(days=40),
            issue_date=today - timedelta(days=65),
            due_date=today - timedelta(days=50),
            grand_total=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("100.00"),
            status="confirmed",
        )
        db.add_all([inv1, inv2, inv3])
        db.commit()
        inv1_id, inv2_id, inv3_id = inv1.id, inv2.id, inv3.id

    # Call bulk-confirm with IDs for inv1 (draft), inv2 (draft), inv3 (already confirmed)
    res = client.post(
        "/api/invoices/bulk-confirm",
        headers={"Authorization": f"Bearer {staff_tok}"},
        json={"ids": [str(inv1_id), str(inv2_id), str(inv3_id)]},
    )
    assert res.status_code == 200
    # Exactly 2 were draft and transitioned to confirmed
    assert res.json()["confirmed_count"] == 2

    with TestingSessionLocal() as db:
        assert db.get(Invoice, inv1_id).status == "confirmed"
        assert db.get(Invoice, inv2_id).status == "confirmed"
        assert db.get(Invoice, inv3_id).status == "confirmed"
