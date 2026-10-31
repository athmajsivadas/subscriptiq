import uuid
from datetime import date, timedelta
from decimal import Decimal
from threading import Thread
import pytest
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.clock import today_ist
from app.core.errors import AppError
from app.core.database import get_db, Base
from app.core.security import create_access_token, hash_password
from app.models.all_models import (
    Base, User, Customer, TaxRule, Product, Plan,
    Subscription, SubscriptionItem, Invoice, InvoiceItem,
    Discount, Payment
)
from app.services.billing_service import (
    generate_invoice_for_subscription,
    run_due_billing_job,
)
from app.services.discount_service import pick_best_discount

engine_test = create_engine(settings.TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

from app.main import app
app.dependency_overrides[get_db] = override_get_db

def create_active_due_subscription(db, sub_num, start_d=None, cycle="monthly", price=Decimal("1000.00"), tax_rate=Decimal("18.00")):
    today = start_d or today_ist()
    cust = Customer(company_name=f"Org-{uuid.uuid4().hex[:6]}")
    tax = TaxRule(name=f"Tax-{uuid.uuid4().hex[:6]}", rate_percent=tax_rate)
    prod = Product(name="Cloud SaaS", product_type="service", sales_price=price, cost_price=Decimal("200.00"), default_tax_rule=tax)
    db.add_all([cust, tax, prod])
    db.flush()

    plan = Plan(product_id=prod.id, name="SaaS Monthly", price=price, billing_cycle=cycle, allow_pause=True)
    db.add(plan)
    db.flush()

    sub = Subscription(
        subscription_number=sub_num,
        customer_id=cust.id,
        plan_id=plan.id,
        status="active",
        start_date=today,
        current_period_start=today,
        current_period_end=today + timedelta(days=30),
        next_billing_date=today,
    )
    sub.items.append(SubscriptionItem(product_id=prod.id, description_snapshot="Cloud SaaS", quantity=1, unit_price=price, tax_rule_id=tax.id))
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

# GATE TEST 1: Two simultaneous workers -> exactly one invoice per subscription period
def test_gate_concurrent_billing_creates_one_invoice():
    today = today_ist()
    with TestingSessionLocal() as db:
        sub = create_active_due_subscription(db, f"SUB-GATE-CONC-{uuid.uuid4().hex[:6]}", today)
        sub_id = sub.id

    results = []
    def worker():
        with TestingSessionLocal() as s:
            inv = generate_invoice_for_subscription(s, sub_id, today)
            results.append(inv)

    threads = [Thread(target=worker) for _ in range(2)]
    for t in threads: t.start()
    for t in threads: t.join()

    # Exactly one produced an invoice, the other skipped and returned None
    assert sum(r is not None for r in results) == 1
    with TestingSessionLocal() as s:
        inv_count = s.scalar(select(func.count()).select_from(Invoice).where(Invoice.subscription_id == sub_id))
        assert inv_count == 1

# GATE TEST 2: Rerun after success -> no duplicate; the period is not advanced twice
def test_gate_rerun_after_success_no_duplicate():
    today = today_ist()
    with TestingSessionLocal() as db:
        sub = create_active_due_subscription(db, f"SUB-GATE-RERUN-{uuid.uuid4().hex[:6]}", today)
        sub_id = sub.id

        # First run creates invoice
        inv1 = generate_invoice_for_subscription(db, sub_id, today)
        assert inv1 is not None

        # Re-query subscription: next_billing_date should have advanced to next month
        db.refresh(sub)
        advanced_date = sub.next_billing_date
        assert advanced_date > today

        # Second run immediately on same day -> returns None
        inv2 = generate_invoice_for_subscription(db, sub_id, today)
        assert inv2 is None

        # Period was NOT advanced again
        db.refresh(sub)
        assert sub.next_billing_date == advanced_date

        inv_count = db.scalar(select(func.count()).select_from(Invoice).where(Invoice.subscription_id == sub_id))
        assert inv_count == 1

# GATE TEST 3: A failed invoice transaction leaves the subscription's billing dates unchanged
def test_gate_failed_transaction_leaves_dates_unchanged():
    today = today_ist()
    with TestingSessionLocal() as db:
        # Create subscription with invalid tax rule that fails loudly
        cust = Customer(company_name="Fail Test Org")
        invalid_tax = TaxRule(name="Expired Tax", rate_percent=Decimal("18.00"), is_active=False)
        prod = Product(name="Service", product_type="service", sales_price=Decimal("500.00"), cost_price=Decimal("100.00"), default_tax_rule=invalid_tax)
        db.add_all([cust, invalid_tax, prod])
        db.flush()

        plan = Plan(product_id=prod.id, name="Plan", price=Decimal("500.00"), billing_cycle="monthly")
        db.add(plan)
        db.flush()

        sub = Subscription(
            subscription_number=f"SUB-FAIL-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            plan_id=plan.id,
            status="active",
            start_date=today,
            current_period_start=today,
            current_period_end=today + timedelta(days=30),
            next_billing_date=today,
        )
        sub.items.append(SubscriptionItem(product_id=prod.id, description_snapshot="Service", quantity=1, unit_price=Decimal("500.00"), tax_rule_id=invalid_tax.id))
        db.add(sub)
        db.commit()
        db.refresh(sub)
        sub_id = sub.id
        orig_next_date = sub.next_billing_date
        orig_start = sub.current_period_start

        # Attempt to bill -> raises TAX_RULE_INVALID
        with pytest.raises(AppError) as exc_info:
            generate_invoice_for_subscription(db, sub_id, today)
        assert exc_info.value.code == "TAX_RULE_INVALID"

        # Verify dates in DB are strictly unchanged
        db.refresh(sub)
        assert sub.next_billing_date == orig_next_date
        assert sub.current_period_start == orig_start
        assert db.scalar(select(func.count()).select_from(Invoice).where(Invoice.subscription_id == sub_id)) == 0

# GATE TEST 4: Two simultaneous payments cannot overpay an invoice
def test_gate_concurrent_payments_cannot_overpay():
    staff_id = uuid.uuid4()
    with TestingSessionLocal() as db:
        staff = User(id=staff_id, full_name="Staff", email=f"stf_{staff_id.hex[:6]}@test.com", password_hash="hash", role="staff", is_active=True)
        db.add(staff)
        sub = create_active_due_subscription(db, f"SUB-PAY-CONC-{uuid.uuid4().hex[:6]}")
        # Insert confirmed invoice with balance 100.00
        inv = Invoice(
            invoice_number=f"INV-CONC-{uuid.uuid4().hex[:6]}",
            customer_id=sub.customer_id,
            subscription_id=sub.id,
            billing_period_start=today_ist(),
            billing_period_end=today_ist() + timedelta(days=30),
            issue_date=today_ist(),
            due_date=today_ist() + timedelta(days=15),
            grand_total=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("100.00"),
            status="confirmed",
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
        inv_id = inv.id

    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import create_access_token

    client = TestClient(app)
    staff_token = create_access_token(str(staff_id), "staff")
    headers = {"Authorization": f"Bearer {staff_token}"}

    statuses = []
    # Both try to pay 80.00 (Total = 160.00 > 100.00)
    def pay_worker():
        res = client.post(
            "/api/payments",
            headers=headers,
            json={"invoice_id": str(inv_id), "amount": 80.00, "method": "card"},
        )
        statuses.append(res.status_code)

    t1 = Thread(target=pay_worker)
    t2 = Thread(target=pay_worker)
    t1.start(); t2.start()
    t1.join(); t2.join()

    # One succeeds (201), the other fails with OVERPAYMENT (422)
    assert 201 in statuses
    assert 422 in statuses

    with TestingSessionLocal() as db:
        db.expire_all()
        check_inv = db.get(Invoice, inv_id)
        assert check_inv.amount_paid == Decimal("80.00")
        assert check_inv.balance_due == Decimal("20.00")
        assert check_inv.status == "confirmed"

# GATE TEST 5: Idempotency replay and mismatch
def test_gate_payment_idempotency():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import create_access_token

    staff_id = uuid.uuid4()
    client = TestClient(app)
    with TestingSessionLocal() as db:
        staff = User(id=staff_id, full_name="Staff", email=f"stf_{staff_id.hex[:6]}@test.com", password_hash="hash", role="staff", is_active=True)
        db.add(staff)
        sub = create_active_due_subscription(db, f"SUB-IDEMP-{uuid.uuid4().hex[:6]}")
        inv = Invoice(
            invoice_number=f"INV-IDEMP-{uuid.uuid4().hex[:6]}",
            customer_id=sub.customer_id,
            subscription_id=sub.id,
            billing_period_start=today_ist(),
            billing_period_end=today_ist() + timedelta(days=30),
            issue_date=today_ist(),
            due_date=today_ist() + timedelta(days=15),
            grand_total=Decimal("200.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("200.00"),
            status="confirmed",
        )
        db.add(inv)
        db.commit()
        inv_id = inv.id

    staff_token = create_access_token(str(staff_id), "staff")
    headers = {"Authorization": f"Bearer {staff_token}"}

    key = f"key-{uuid.uuid4().hex}"
    # 1. Initial payment of 50.00
    res1 = client.post(
        "/api/payments",
        headers=headers,
        json={"invoice_id": str(inv_id), "amount": 50.00, "method": "cash", "idempotency_key": key},
    )
    assert res1.status_code == 201
    p1_id = res1.json()["id"]

    # 2. Replay with identical params -> returns original payment
    res2 = client.post(
        "/api/payments",
        headers=headers,
        json={"invoice_id": str(inv_id), "amount": 50.00, "method": "cash", "idempotency_key": key},
    )
    assert res2.status_code == 201 or res2.status_code == 200
    assert res2.json()["id"] == p1_id

    # 3. Mismatched replay with different amount -> 409 IDEMPOTENCY_MISMATCH
    res3 = client.post(
        "/api/payments",
        headers=headers,
        json={"invoice_id": str(inv_id), "amount": 60.00, "method": "cash", "idempotency_key": key},
    )
    assert res3.status_code == 409
    assert res3.json()["error"]["code"] == "IDEMPOTENCY_MISMATCH"

# GATE TEST 6: Discount usage_limit cannot be exceeded under concurrent billing
def test_gate_discount_usage_limit_not_exceeded_concurrent():
    today = today_ist()
    with TestingSessionLocal() as db:
        # Deactivate ALL other discounts so only our limited one can be picked
        from sqlalchemy import update
        db.execute(update(Discount).values(is_active=False))
        db.commit()

        # Create a discount with usage_limit = 1 and a large value so it always wins
        d = Discount(
            name=f"Limited Discount {uuid.uuid4().hex[:6]}",
            discount_type="fixed",
            value=Decimal("500.00"),
            scope="subscription",
            usage_limit=1,
            usage_count=0,
            is_active=True,
        )
        db.add(d)
        db.commit()
        db.refresh(d)
        disc_id = d.id

        # Create two subscriptions eligible for this discount
        sub1 = create_active_due_subscription(db, f"SUB-DISC-1-{uuid.uuid4().hex[:6]}", today)
        sub2 = create_active_due_subscription(db, f"SUB-DISC-2-{uuid.uuid4().hex[:6]}", today)
        sub1_id, sub2_id = sub1.id, sub2.id

    def bill_worker(s_id):
        with TestingSessionLocal() as session:
            generate_invoice_for_subscription(session, s_id, today)

    t1 = Thread(target=bill_worker, args=(sub1_id,))
    t2 = Thread(target=bill_worker, args=(sub2_id,))
    t1.start(); t2.start()
    t1.join(); t2.join()

    with TestingSessionLocal() as db:
        db.expire_all()
        d_fresh = db.get(Discount, disc_id)
        # Usage count cannot exceed limit 1
        assert d_fresh.usage_count == 1
        # Exactly one invoice got the discount of 500.00
        inv1 = db.execute(select(Invoice).where(Invoice.subscription_id == sub1_id)).scalar_one_or_none()
        inv2 = db.execute(select(Invoice).where(Invoice.subscription_id == sub2_id)).scalar_one_or_none()
        disc_totals = [inv1.discount_total if inv1 else Decimal(0), inv2.discount_total if inv2 else Decimal(0)]
        assert Decimal("500.00") in disc_totals
        assert Decimal("0.00") in disc_totals

# GATE TEST 7: Draft and Cancelled invoices reject payments
def test_gate_draft_and_cancelled_invoices_reject_payments():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import create_access_token

    staff_id = uuid.uuid4()
    client = TestClient(app)
    with TestingSessionLocal() as db:
        staff = User(id=staff_id, full_name="Staff", email=f"stf_{staff_id.hex[:6]}@test.com", password_hash="hash", role="staff", is_active=True)
        db.add(staff)
        sub1 = create_active_due_subscription(db, f"SUB-REJ1-{uuid.uuid4().hex[:6]}")
        sub2 = create_active_due_subscription(db, f"SUB-REJ2-{uuid.uuid4().hex[:6]}")
        draft_inv = Invoice(
            invoice_number=f"INV-DRAFT-{uuid.uuid4().hex[:6]}",
            customer_id=sub1.customer_id,
            subscription_id=sub1.id,
            billing_period_start=today_ist(),
            billing_period_end=today_ist() + timedelta(days=30),
            issue_date=today_ist(),
            due_date=today_ist() + timedelta(days=15),
            grand_total=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("100.00"),
            status="draft",
        )
        canc_inv = Invoice(
            invoice_number=f"INV-CANC-{uuid.uuid4().hex[:6]}",
            customer_id=sub2.customer_id,
            subscription_id=sub2.id,
            billing_period_start=today_ist(),
            billing_period_end=today_ist() + timedelta(days=30),
            issue_date=today_ist(),
            due_date=today_ist() + timedelta(days=15),
            grand_total=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("100.00"),
            status="cancelled",
        )
        db.add_all([draft_inv, canc_inv])
        db.commit()
        draft_id, canc_id = draft_inv.id, canc_inv.id

    staff_token = create_access_token(str(staff_id), "staff")
    headers = {"Authorization": f"Bearer {staff_token}"}

    # Payment on Draft -> 409 INVOICE_NOT_PAYABLE
    res_draft = client.post("/api/payments", headers=headers, json={"invoice_id": str(draft_id), "amount": 50, "method": "cash"})
    assert res_draft.status_code == 409
    assert res_draft.json()["error"]["code"] == "INVOICE_NOT_PAYABLE"

    # Payment on Cancelled -> 409 INVOICE_NOT_PAYABLE
    res_canc = client.post("/api/payments", headers=headers, json={"invoice_id": str(canc_id), "amount": 50, "method": "cash"})
    assert res_canc.status_code == 409
    assert res_canc.json()["error"]["code"] == "INVOICE_NOT_PAYABLE"

# Additional Invariant Tests: Math exact to the paise & Status restrictions
def test_exact_to_the_paise_math_and_inactive_subs_never_billed():
    today = today_ist()
    with TestingSessionLocal() as db:
        # 1. Math check: unit_price 1560.00, discount 10% (156.00) -> taxable 1404.00, GST 18% (252.72) -> total 1656.72
        disc = Discount(name="10% Off", discount_type="percentage", value=Decimal("10.00"), scope="subscription", is_active=True)
        db.add(disc)
        db.commit()

        sub = create_active_due_subscription(db, f"SUB-MATH-{uuid.uuid4().hex[:6]}", today, price=Decimal("1560.00"), tax_rate=Decimal("18.00"))
        inv = generate_invoice_for_subscription(db, sub.id, today)
        assert inv is not None
        assert inv.status == "draft"
        assert inv.subtotal == Decimal("1560.00")
        assert inv.discount_total == Decimal("156.00")
        assert inv.tax_total == Decimal("252.72")
        assert inv.grand_total == Decimal("1656.72")
        assert inv.balance_due == Decimal("1656.72")
        # Line sum check
        assert sum(it.line_total for it in inv.items) == inv.grand_total

        # 2. Paused subscription is never billed
        sub_paused = create_active_due_subscription(db, f"SUB-PAUSED-{uuid.uuid4().hex[:6]}", today)
        sub_paused.status = "paused"
        db.commit()
        assert generate_invoice_for_subscription(db, sub_paused.id, today) is None

        # 3. Closed subscription is never billed
        sub_closed = create_active_due_subscription(db, f"SUB-CLOSED-{uuid.uuid4().hex[:6]}", today)
        sub_closed.status = "closed"
        db.commit()
        assert generate_invoice_for_subscription(db, sub_closed.id, today) is None

        # 4. Future-dated subscription is never billed
        sub_future = create_active_due_subscription(db, f"SUB-FUTURE-{uuid.uuid4().hex[:6]}", today + timedelta(days=10))
        assert generate_invoice_for_subscription(db, sub_future.id, today) is None

        # 5. Past-expiry subscription is never billed
        sub_exp = create_active_due_subscription(db, f"SUB-EXP-{uuid.uuid4().hex[:6]}", today)
        sub_exp.expiry_date = today - timedelta(days=1)
        db.commit()
        assert generate_invoice_for_subscription(db, sub_exp.id, today) is None
