"""
Demo seed per spec section 17.2:
- Admin admin@brightloop.test / Admin#2026
- Staff staff@brightloop.test / Staff#2026
- 40 customers (3 with logins: cust1@brightloop.test, etc.)
- Tax rule (GST 18%)
- Products with Odoo +560 variant
- Four plans covering every flag combination
- 10% volume discount with usage limit
- Quotation template
- 200 active monthly subscriptions due today (current_period_start = next_billing_date = today)
- Overdue invoices at different ages + partially paid one + paid ones
- Checks that exactly 200 eligible subscriptions exist!
"""
import sys, os
from uuid import uuid4
from datetime import date, timedelta
from decimal import Decimal

# Ensure python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func, delete
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.core.clock import today_ist
from app.services.billing_service import cycle_end
from app.models.all_models import (
    User, Customer, TaxRule, Product, ProductVariant, Plan,
    Discount, QuotationTemplate, QuotationTemplateLine,
    Subscription, SubscriptionItem, SubscriptionStatusHistory,
    Invoice, InvoiceItem, Payment
)

def seed_demo():
    today = today_ist()
    print(f"Seeding demo data for today = {today}...")

    with SessionLocal() as db:
        # Check if already seeded with demo admin
        existing_admin = db.execute(select(User).where(User.email == "admin@brightloop.test")).scalar_one_or_none()
        if existing_admin:
            sub_count = db.scalar(
                select(func.count()).select_from(Subscription)
                .where(Subscription.status == "active", Subscription.next_billing_date <= today)
            )
            print(f"[INFO] Admin exists. Current active due subscriptions: {sub_count}")
            return

        # 1. Users & Customers
        admin = existing_admin or User(
            full_name="Admin User",
            email="admin@brightloop.test",
            password_hash=hash_password("Admin#2026"),
            role="admin",
            is_active=True,
        )
        staff = db.execute(select(User).where(User.email == "staff@brightloop.test")).scalar_one_or_none() or User(
            full_name="Staff User",
            email="staff@brightloop.test",
            password_hash=hash_password("Staff#2026"),
            role="staff",
            is_active=True,
        )
        if not existing_admin:
            db.add(admin)
        if not db.execute(select(User).where(User.email == "staff@brightloop.test")).scalar_one_or_none():
            db.add(staff)
        db.flush()

        customers = []
        for i in range(1, 41):
            user_id = None
            if i <= 3:
                email = f"cust{i}@brightloop.test"
                u = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
                if not u:
                    u = User(
                        full_name=f"Customer User {i}",
                        email=email,
                        password_hash=hash_password(f"Cust{i}#2026"),
                        role="customer",
                        is_active=True,
                    )
                    db.add(u)
                    db.flush()
                user_id = u.id

            c = Customer(
                user_id=user_id,
                company_name=f"Bright Customer {i:02d} Ltd",
                phone=f"+91 98765 432{i:02d}",
                billing_address=f"Building {i}, Tech Park, Bengaluru",
                tax_identifier=f"29AAAAA000{i:02d}1Z5",
            )
            customers.append(c)
        db.add_all(customers)
        db.flush()

        # 2. Tax Rule
        tax = db.execute(select(TaxRule).where(TaxRule.name == "GST 18%")).scalar_one_or_none()
        if not tax:
            tax = TaxRule(name="GST 18%", rate_percent=Decimal("18.00"), is_active=True)
            db.add(tax)
            db.flush()

        # 3. Products & Variants
        p_saas = Product(
            name="Cloud SaaS Platform",
            product_type="service",
            sales_price=Decimal("1000.00"),
            cost_price=Decimal("300.00"),
            default_tax_rule_id=tax.id,
            is_active=True,
        )
        p_support = Product(
            name="Priority Support",
            product_type="service",
            sales_price=Decimal("500.00"),
            cost_price=Decimal("150.00"),
            default_tax_rule_id=tax.id,
            is_active=True,
        )
        db.add_all([p_saas, p_support])
        db.flush()

        # Odoo variant (+560)
        v_premium = ProductVariant(
            product_id=p_saas.id,
            variant_name="Enterprise Dedicated (+560)",
            additional_price=Decimal("560.00"),
            is_active=True,
        )
        db.add(v_premium)
        db.flush()

        # 4. Four Plans covering every flag combination
        # - Monthly: allow_pause=True, allow_early_close=True, allow_renewal=True, auto_close_on_end=False
        plan_monthly = Plan(
            product_id=p_saas.id,
            name="Cloud SaaS Monthly",
            price=Decimal("1000.00"),
            billing_cycle="monthly",
            minimum_quantity=1,
            allow_pause=True,
            allow_early_close=True,
            allow_renewal=True,
            auto_close_on_end=False,
            is_active=True,
        )
        # - Weekly: allow_pause=False, allow_early_close=True, allow_renewal=True, auto_close_on_end=False
        plan_weekly = Plan(
            product_id=p_support.id,
            name="Priority Support Weekly",
            price=Decimal("500.00"),
            billing_cycle="weekly",
            minimum_quantity=1,
            allow_pause=False,
            allow_early_close=True,
            allow_renewal=True,
            auto_close_on_end=False,
            is_active=True,
        )
        # - Daily: allow_pause=True, allow_early_close=False, allow_renewal=True, auto_close_on_end=True
        plan_daily = Plan(
            product_id=p_saas.id,
            name="Cloud SaaS Daily Auto-Close",
            price=Decimal("100.00"),
            billing_cycle="daily",
            minimum_quantity=1,
            allow_pause=True,
            allow_early_close=False,
            allow_renewal=True,
            auto_close_on_end=True,
            is_active=True,
        )
        # - Yearly: allow_pause=True, allow_early_close=True, allow_renewal=False, auto_close_on_end=False
        plan_yearly = Plan(
            product_id=p_support.id,
            name="Priority Support Yearly Fixed",
            price=Decimal("5000.00"),
            billing_cycle="yearly",
            minimum_quantity=1,
            allow_pause=True,
            allow_early_close=True,
            allow_renewal=False,
            auto_close_on_end=False,
            is_active=True,
        )
        db.add_all([plan_monthly, plan_weekly, plan_daily, plan_yearly])
        db.flush()

        # 5. Discount: 10% volume discount with usage limit
        discount = Discount(
            name="10% Volume Promo",
            discount_type="percentage",
            value=Decimal("10.00"),
            scope="subscription",
            usage_limit=100,
            usage_count=0,
            is_active=True,
        )
        db.add(discount)

        # 6. Quotation Template
        template = QuotationTemplate(
            name="Standard SaaS Onboarding",
            plan_id=plan_monthly.id,
            validity_days=30,
            payment_terms_days=15,
            description="Standard monthly plan with Cloud SaaS line",
            is_active=True,
            created_by=admin.id,
        )
        db.add(template)
        db.flush()

        t_line = QuotationTemplateLine(
            template_id=template.id,
            product_id=p_saas.id,
            quantity=1,
            tax_rule_id=tax.id,
        )
        db.add(t_line)
        db.flush()

        # 7. 200 active monthly subscriptions due today
        subs = []
        for i in range(1, 201):
            cust = customers[(i - 1) % len(customers)]
            s = Subscription(
                subscription_number=f"DEMO-SUB-{today.year}-{i:04d}",
                customer_id=cust.id,
                plan_id=plan_monthly.id,
                status="active",
                start_date=today,
                current_period_start=today,
                current_period_end=cycle_end(today, "monthly"),
                next_billing_date=today,
                payment_terms_days=15,
                auto_renew=True,
                created_by=admin.id,
            )
            s.items.append(
                SubscriptionItem(
                    product_id=p_saas.id,
                    description_snapshot="Cloud SaaS Platform",
                    quantity=1,
                    unit_price=Decimal("1000.00"),
                    tax_rule_id=tax.id,
                )
            )
            s.history.append(
                SubscriptionStatusHistory(
                    from_status=None,
                    to_status="active",
                    changed_by=admin.id,
                    note="Initial active demo seed",
                )
            )
            subs.append(s)
        db.add_all(subs)
        db.flush()

        # 8. Extra subscriptions for overdue and paid invoices to prevent ux_invoice_period conflicts
        sub_extra = Subscription(
            subscription_number=f"DEMO-EXTRA-{today.year}-001",
            customer_id=customers[0].id,
            plan_id=plan_monthly.id,
            status="active",
            start_date=today - timedelta(days=90),
            current_period_start=today + timedelta(days=30),
            current_period_end=today + timedelta(days=60),
            next_billing_date=today + timedelta(days=30),
            payment_terms_days=15,
            auto_renew=True,
        )
        db.add(sub_extra)
        db.flush()

        # Overdue invoices: 5 days, 15 days, 45 days
        # 1. 5 days overdue
        inv_5d = Invoice(
            invoice_number=f"DEMO-INV-OVERDUE-5D",
            customer_id=customers[0].id,
            subscription_id=sub_extra.id,
            billing_period_start=today - timedelta(days=25),
            billing_period_end=today - timedelta(days=6),
            issue_date=today - timedelta(days=20),
            due_date=today - timedelta(days=5),
            subtotal=Decimal("1000.00"),
            discount_total=Decimal("0.00"),
            tax_total=Decimal("180.00"),
            grand_total=Decimal("1180.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("1180.00"),
            status="confirmed",
        )
        inv_5d.items.append(
            InvoiceItem(
                product_id=p_saas.id,
                description_snapshot="Cloud SaaS Platform",
                quantity=1,
                unit_price=Decimal("1000.00"),
                tax_rate_percent=Decimal("18.00"),
                tax_amount=Decimal("180.00"),
                line_total=Decimal("1180.00"),
            )
        )

        # 2. 15 days overdue
        inv_15d = Invoice(
            invoice_number=f"DEMO-INV-OVERDUE-15D",
            customer_id=customers[1].id,
            subscription_id=sub_extra.id,
            billing_period_start=today - timedelta(days=55),
            billing_period_end=today - timedelta(days=36),
            issue_date=today - timedelta(days=30),
            due_date=today - timedelta(days=15),
            subtotal=Decimal("1000.00"),
            discount_total=Decimal("0.00"),
            tax_total=Decimal("180.00"),
            grand_total=Decimal("1180.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("1180.00"),
            status="confirmed",
        )

        # 3. 45 days overdue (Bucket: 31-60)
        inv_45d = Invoice(
            invoice_number=f"DEMO-INV-OVERDUE-45D",
            customer_id=customers[2].id,
            subscription_id=sub_extra.id,
            billing_period_start=today - timedelta(days=85),
            billing_period_end=today - timedelta(days=66),
            issue_date=today - timedelta(days=60),
            due_date=today - timedelta(days=45),
            subtotal=Decimal("1000.00"),
            discount_total=Decimal("0.00"),
            tax_total=Decimal("180.00"),
            grand_total=Decimal("1180.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("1180.00"),
            status="confirmed",
        )

        # 4. Partially paid invoice (overdue by 10 days)
        inv_partial = Invoice(
            invoice_number=f"DEMO-INV-OVERDUE-PARTIAL",
            customer_id=customers[3].id,
            subscription_id=sub_extra.id,
            billing_period_start=today - timedelta(days=40),
            billing_period_end=today - timedelta(days=26),
            issue_date=today - timedelta(days=25),
            due_date=today - timedelta(days=10),
            subtotal=Decimal("500.00"),
            discount_total=Decimal("0.00"),
            tax_total=Decimal("90.00"),
            grand_total=Decimal("590.00"),
            amount_paid=Decimal("200.00"),
            balance_due=Decimal("390.00"),
            status="confirmed",
        )
        # 5. Paid invoice
        inv_paid = Invoice(
            invoice_number=f"DEMO-INV-PAID-01",
            customer_id=customers[4].id,
            subscription_id=sub_extra.id,
            billing_period_start=today - timedelta(days=70),
            billing_period_end=today - timedelta(days=56),
            issue_date=today - timedelta(days=50),
            due_date=today - timedelta(days=35),
            subtotal=Decimal("1000.00"),
            discount_total=Decimal("0.00"),
            tax_total=Decimal("180.00"),
            grand_total=Decimal("1180.00"),
            amount_paid=Decimal("1180.00"),
            balance_due=Decimal("0.00"),
            status="paid",
        )

        # Flush invoices first so inv_partial.id and inv_paid.id exist
        db.add_all([inv_5d, inv_15d, inv_45d, inv_partial, inv_paid])
        db.flush()

        pay_part = Payment(
            invoice_id=inv_partial.id,
            payment_reference="PAY-DEMO-PARTIAL-01",
            method="bank_transfer",
            amount=Decimal("200.00"),
            payment_date=today - timedelta(days=12),
            note="Partial advance payment",
            recorded_by=staff.id,
        )

        pay_full = Payment(
            invoice_id=inv_paid.id,
            payment_reference="PAY-DEMO-FULL-01",
            method="upi",
            amount=Decimal("1180.00"),
            payment_date=today - timedelta(days=40),
            note="Full settlement via UPI",
            recorded_by=admin.id,
        )

        db.add_all([pay_part, pay_full])
        db.commit()

        # Verification step
        count = db.scalar(
            select(func.count()).select_from(Subscription)
            .where(Subscription.status == "active", Subscription.next_billing_date <= today)
        )
        if count != 200:
            print(f"ERROR: Expected 200 eligible subscriptions, found {count}")
            sys.exit(1)
        print(f"[SUCCESS] Demo seeded successfully: {count} eligible subscriptions ready for billing!")

if __name__ == "__main__":
    seed_demo()
