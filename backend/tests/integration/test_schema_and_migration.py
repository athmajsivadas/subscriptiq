import pytest
import subprocess
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from app.core.config import settings

def test_alembic_upgrade_downgrade_cycle():
    """Verify on the TEST database: upgrade head, downgrade base, upgrade head."""
    test_db_url = settings.TEST_DATABASE_URL
    env = {
        "DATABASE_URL": test_db_url,
        "PYTHONPATH": "backend",
    }
    import os
    merged_env = os.environ.copy()
    merged_env.update(env)

    # 1. upgrade head
    p1 = subprocess.run(["backend/venv/Scripts/alembic.exe", "upgrade", "head"], cwd="backend", env=merged_env, capture_output=True, text=True)
    assert p1.returncode == 0, f"Upgrade failed: {p1.stderr}"

    # 2. downgrade base
    p2 = subprocess.run(["backend/venv/Scripts/alembic.exe", "downgrade", "base"], cwd="backend", env=merged_env, capture_output=True, text=True)
    assert p2.returncode == 0, f"Downgrade failed: {p2.stderr}"

    # 3. upgrade head again
    p3 = subprocess.run(["backend/venv/Scripts/alembic.exe", "upgrade", "head"], cwd="backend", env=merged_env, capture_output=True, text=True)
    assert p3.returncode == 0, f"Second upgrade failed: {p3.stderr}"

def test_schema_constraints_reject_bad_data():
    """Verify constraint rejections on PostgreSQL: duplicate invoice period, negative price, mismatched balance."""
    engine = create_engine(settings.TEST_DATABASE_URL)
    with engine.connect() as conn:
        # 1. Negative price rejected by CheckConstraint
        with pytest.raises(Exception) as exc_info:
            conn.execute(text("""
                INSERT INTO products (id, name, product_type, sales_price, cost_price, is_active)
                VALUES (gen_random_uuid(), 'Bad Product', 'service', -10.00, 5.00, true);
            """))
            conn.commit()
        assert "ck_products" in str(exc_info.value).lower() or "check constraint" in str(exc_info.value).lower()
        conn.rollback()

        # 2. Mismatched invoice balance formula: amount_paid + balance_due != grand_total
        # Setup prerequisite user, customer, plan, subscription
        conn.execute(text("""
            INSERT INTO users (id, full_name, email, password_hash, role)
            VALUES ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin_test@test.com', 'hash', 'admin')
            ON CONFLICT DO NOTHING;
            INSERT INTO customers (id, company_name)
            VALUES ('22222222-2222-2222-2222-222222222222', 'Test Corp')
            ON CONFLICT DO NOTHING;
            INSERT INTO products (id, name, product_type, sales_price, cost_price)
            VALUES ('33333333-3333-3333-3333-333333333333', 'P1', 'service', 100.00, 50.00)
            ON CONFLICT DO NOTHING;
            INSERT INTO plans (id, product_id, name, price, billing_cycle)
            VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Plan 1', 100.00, 'monthly')
            ON CONFLICT DO NOTHING;
            INSERT INTO subscriptions (id, subscription_number, customer_id, plan_id, status, start_date)
            VALUES ('55555555-5555-5555-5555-555555555555', 'SUB-TEST-001', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'active', '2026-01-01')
            ON CONFLICT DO NOTHING;
        """))
        conn.commit()

        # Try to insert invoice where amount_paid (0) + balance_due (50) != grand_total (100)
        with pytest.raises(Exception) as exc_info:
            conn.execute(text("""
                INSERT INTO invoices (
                    id, invoice_number, customer_id, subscription_id,
                    billing_period_start, billing_period_end, issue_date, due_date,
                    grand_total, amount_paid, balance_due, status
                ) VALUES (
                    gen_random_uuid(), 'INV-BAD-001', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555',
                    '2026-01-01', '2026-01-31', '2026-01-01', '2026-01-15',
                    100.00, 0.00, 50.00, 'draft'
                );
            """))
            conn.commit()
        assert "ck_invoices_ck_invoices_balance_due_formula" in str(exc_info.value) or "check constraint" in str(exc_info.value).lower()
        conn.rollback()

        # 3. Duplicate invoice period on the same subscription
        # First insert valid invoice
        conn.execute(text("""
            INSERT INTO invoices (
                id, invoice_number, customer_id, subscription_id,
                billing_period_start, billing_period_end, issue_date, due_date,
                grand_total, amount_paid, balance_due, status
            ) VALUES (
                gen_random_uuid(), 'INV-PER-001', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555',
                '2026-01-01', '2026-01-31', '2026-01-01', '2026-01-15',
                100.00, 0.00, 100.00, 'draft'
            );
        """))
        conn.commit()

        # Attempt duplicate billing period
        with pytest.raises(Exception) as exc_info:
            conn.execute(text("""
                INSERT INTO invoices (
                    id, invoice_number, customer_id, subscription_id,
                    billing_period_start, billing_period_end, issue_date, due_date,
                    grand_total, amount_paid, balance_due, status
                ) VALUES (
                    gen_random_uuid(), 'INV-PER-002', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555',
                    '2026-01-01', '2026-01-31', '2026-01-01', '2026-01-15',
                    100.00, 0.00, 100.00, 'draft'
                );
            """))
            conn.commit()
        assert "ux_invoice_period" in str(exc_info.value)
        conn.rollback()
