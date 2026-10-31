import os
import sys
import time
import uuid
from decimal import Decimal
from datetime import date, timedelta
from threading import Thread, Barrier

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, SessionLocal
from app.jobs.scheduler import with_advisory_lock, LOCK_BILLING, send_overdue_reminders
from app.models.all_models import Invoice, Notification, Customer, Subscription, Plan, Product, TaxRule
from app.core.clock import today_ist
from sqlalchemy import select, func

def test_advisory_lock_blocking():
    print("\n--- Test 1: Advisory Lock Concurrent Blocking ---")
    outcomes = []
    barrier = Barrier(2)

    def worker(worker_id):
        barrier.wait()
        def heavy_job():
            outcomes.append(f"Worker {worker_id} acquired lock and executed")
            time.sleep(1.0)

        with_advisory_lock(LOCK_BILLING, heavy_job)

    t1 = Thread(target=worker, args=(1,))
    t2 = Thread(target=worker, args=(2,))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    print("Job Execution Outcomes:", outcomes)
    assert len(outcomes) == 1, f"Expected exactly 1 worker to execute, got {len(outcomes)}"
    print("[PASS] Advisory lock successfully blocked the second concurrent instance!")

def test_notification_uniqueness():
    print("\n--- Test 2: Notification (invoice_id, kind) Uniqueness ---")
    today = today_ist()
    due_1_day_ago = today - timedelta(days=1)

    with SessionLocal() as db:
        cust = Customer(company_name="Reminder Test Cust")
        prod = Product(name="Service", product_type="service", sales_price=Decimal("500.00"), cost_price=Decimal("100.00"))
        db.add_all([cust, prod])
        db.flush()

        plan = Plan(product_id=prod.id, name="Plan", price=Decimal("500.00"), billing_cycle="monthly")
        db.add(plan)
        db.flush()

        sub = Subscription(
            subscription_number=f"SUB-REMIND-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            plan_id=plan.id,
            status="active",
            start_date=due_1_day_ago,
        )
        db.add(sub)
        db.flush()

        inv = Invoice(
            invoice_number=f"INV-REMIND-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            subscription_id=sub.id,
            billing_period_start=due_1_day_ago - timedelta(days=30),
            billing_period_end=due_1_day_ago,
            issue_date=due_1_day_ago - timedelta(days=15),
            due_date=due_1_day_ago,
            grand_total=Decimal("500.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("500.00"),
            status="confirmed",
        )
        db.add(inv)
        db.commit()
        inv_id = inv.id

    print(f"Created overdue invoice {inv_id} with due_date = {due_1_day_ago}")

    print("Running send_overdue_reminders() [Run 1]...")
    send_overdue_reminders()

    with SessionLocal() as db:
        count1 = db.scalar(select(func.count()).select_from(Notification).where(Notification.invoice_id == inv_id))
        print(f"Notification count after Run 1: {count1}")
        assert count1 == 1

    print("Running send_overdue_reminders() [Run 2 - Rerun]...")
    send_overdue_reminders()

    with SessionLocal() as db:
        count2 = db.scalar(select(func.count()).select_from(Notification).where(Notification.invoice_id == inv_id))
        print(f"Notification count after Run 2: {count2}")
        assert count2 == 1, f"Expected 1 notification, but got {count2} (duplicate detected!)"

    print("[PASS] Notification (invoice_id, kind) uniqueness holds and prevents duplicate reminders!\n")

if __name__ == "__main__":
    test_advisory_lock_blocking()
    test_notification_uniqueness()
