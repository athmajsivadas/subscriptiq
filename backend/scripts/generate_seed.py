"""
Performance seed per section 19: 50k subscriptions, 150k invoices via Core bulk inserts.
"""
import sys, os
from uuid import uuid4
from datetime import date, timedelta
from decimal import Decimal
import calendar
import time

# Ensure python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import insert, select, func
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.all_models import (
    User, Customer, Product, Plan, Subscription, SubscriptionItem,
    Invoice, InvoiceItem, Payment, TaxRule, SubscriptionStatusHistory
)

def chunks(rows, n=5000):
    for i in range(0, len(rows), n):
        yield rows[i:i + n]

def seed_performance_data(n_customers=5_000, n_subs=50_000):
    with SessionLocal() as db:
        # Check if already seeded
        existing = db.scalar(
            select(func.count()).select_from(Subscription).where(
                Subscription.subscription_number.like("PERF-SUB-%")
            )
        )
        if existing and existing >= n_subs:
            print(f"Performance data already seeded ({existing} subscriptions). Skipping.")
            return

        # Ensure admin exists for benchmark login
        admin = db.execute(select(User).where(User.email == "admin@brightloop.test")).scalar_one_or_none()
        if not admin:
            admin = User(
                full_name="Admin User", email="admin@brightloop.test",
                password_hash=hash_password("Admin#2026"), role="admin"
            )
            db.add(admin)
            db.flush()

        # Ensure a tax rule exists
        tax = db.execute(select(TaxRule).where(TaxRule.name == "Perf GST 18%")).scalar_one_or_none()
        if not tax:
            tax = TaxRule(name="Perf GST 18%", rate_percent=Decimal("18.00"))
            db.add(tax)
            db.flush()
        tax_id = tax.id

        # Products
        products = [
            Product(
                name=f"Perf Product {i}", product_type="service",
                sales_price=Decimal("500.00"), cost_price=Decimal("150.00"),
                default_tax_rule_id=tax_id, is_active=True
            )
            for i in range(4)
        ]
        db.add_all(products)
        db.flush()

        # Plans
        plans = [
            Plan(
                product_id=p.id, name=f"Monthly {p.name}", price=Decimal("500.00"),
                billing_cycle="monthly", minimum_quantity=1, allow_pause=True,
                allow_early_close=True, allow_renewal=True, auto_close_on_end=False,
                is_active=True
            )
            for p in products
        ]
        db.add_all(plans)
        db.flush()

        # Customers via bulk
        customers = [Customer(company_name=f"Perf Customer {i}") for i in range(n_customers)]
        db.add_all(customers)
        db.flush()
        print(f"Created {len(products)} products, {len(plans)} plans, {n_customers} customers")

        # Subscriptions and Invoices via Core bulk insert
        sub_rows = []
        sub_item_rows = []
        sub_history_rows = []
        inv_rows = []

        cust_ids = [c.id for c in customers]
        plan_ids = [p.id for p in plans]
        plan_product_ids = {p.id: p.product_id for p in plans}

        for i in range(n_subs):
            sid = uuid4()
            cust = cust_ids[i % n_customers]
            pid = plan_ids[i % len(plans)]
            status = "closed" if i % 10 == 0 else "active"

            sub_rows.append(dict(
                id=sid,
                subscription_number=f"PERF-SUB-{i:07d}",
                customer_id=cust,
                plan_id=pid,
                status=status,
                start_date=date(2026, 7, 1),
                current_period_start=date(2026, 11, 1),
                current_period_end=date(2026, 11, 30),
                next_billing_date=date(2026, 11, 1),
                payment_terms_days=15,
                auto_renew=False
            ))

            sub_item_rows.append(dict(
                id=uuid4(),
                subscription_id=sid,
                product_id=plan_product_ids[pid],
                description_snapshot="Perf Product Subscription Line",
                quantity=1,
                unit_price=Decimal("500.00"),
                tax_rule_id=tax_id,
            ))

            sub_history_rows.append(dict(
                id=uuid4(),
                subscription_id=sid,
                from_status=None,
                to_status=status,
                note="Performance seed",
            ))

            # 3 invoices each -> 150k total
            for m in (8, 9, 10):
                start = date(2026, m, 1)
                end = date(2026, m, calendar.monthrange(2026, m)[1])
                paid = (i + m) % 3 != 0
                inv_rows.append(dict(
                    id=uuid4(),
                    invoice_number=f"PERF-INV-{i:07d}-{m}",
                    customer_id=cust,
                    subscription_id=sid,
                    billing_period_start=start,
                    billing_period_end=end,
                    issue_date=start,
                    due_date=start + timedelta(days=15),
                    subtotal=Decimal("500.00"),
                    discount_total=Decimal("0.00"),
                    tax_total=Decimal("90.00"),
                    grand_total=Decimal("590.00"),
                    amount_paid=Decimal("590.00") if paid else Decimal("0.00"),
                    balance_due=Decimal("0.00") if paid else Decimal("590.00"),
                    status="paid" if paid else "confirmed"
                ))

        print(f"Inserting {len(sub_rows)} subscriptions...")
        t0 = time.time()
        for batch in chunks(sub_rows):
            db.execute(insert(Subscription), batch)
        print(f"  Subscriptions: {time.time()-t0:.1f}s")

        t0 = time.time()
        for batch in chunks(sub_item_rows):
            db.execute(insert(SubscriptionItem), batch)
        print(f"  Subscription items: {time.time()-t0:.1f}s")

        t0 = time.time()
        for batch in chunks(sub_history_rows):
            db.execute(insert(SubscriptionStatusHistory), batch)
        print(f"  Status history: {time.time()-t0:.1f}s")

        print(f"Inserting {len(inv_rows)} invoices...")
        t0 = time.time()
        for batch in chunks(inv_rows):
            db.execute(insert(Invoice), batch)
        print(f"  Invoices: {time.time()-t0:.1f}s")

        db.commit()
        print(f"[SUCCESS] Performance seed complete: {n_subs} subscriptions, {len(inv_rows)} invoices")

if __name__ == "__main__":
    seed_performance_data()
