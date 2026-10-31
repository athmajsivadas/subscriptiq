import os
import sys
import uuid
from decimal import Decimal
from datetime import date, timedelta
import psycopg

# Ensure python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DB_NAME = "subscriptiq_perm_test"
CONN_STR = "postgresql://subscriptiq:subscriptiq@localhost:5432/postgres"
TARGET_URL = f"postgresql+psycopg://subscriptiq:subscriptiq@localhost:5432/{DB_NAME}"

os.environ["DATABASE_URL"] = TARGET_URL

# Recreate DB
with psycopg.connect(CONN_STR, autocommit=True) as conn:
    with conn.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS {DB_NAME};")
        cur.execute(f"CREATE DATABASE {DB_NAME} OWNER subscriptiq;")

# Run Alembic upgrade head
import subprocess
alembic_bin = os.path.join(os.path.dirname(__file__), "..", "venv", "Scripts", "alembic.exe")
if not os.path.exists(alembic_bin):
    alembic_bin = "alembic"
subprocess.run([alembic_bin, "upgrade", "head"], cwd="backend", env=os.environ, check=True)

from sqlalchemy.orm import Session
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.all_models import User, Customer, Subscription, Invoice, Plan, Product, TaxRule
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

# Seed Users and Customers
with SessionLocal() as db:
    tax = TaxRule(name="GST 18%", rate_percent=Decimal("18.00"))
    prod = Product(name="SaaS", product_type="service", sales_price=Decimal("100.00"), cost_price=Decimal("20.00"))
    db.add_all([tax, prod])
    db.flush()
    plan = Plan(product_id=prod.id, name="Plan", price=Decimal("100.00"), billing_cycle="monthly")
    db.add(plan)
    db.flush()

    admin = User(id=uuid.uuid4(), full_name="Admin", email="admin@perm.test", password_hash=hash_password("Admin#2026"), role="admin", is_active=True)
    staff = User(id=uuid.uuid4(), full_name="Staff", email="staff@perm.test", password_hash=hash_password("Staff#2026"), role="staff", is_active=True)
    
    user_a = User(id=uuid.uuid4(), full_name="Cust A", email="a@perm.test", password_hash=hash_password("Cust#2026"), role="customer", is_active=True)
    user_b = User(id=uuid.uuid4(), full_name="Cust B", email="b@perm.test", password_hash=hash_password("Cust#2026"), role="customer", is_active=True)
    db.add_all([admin, staff, user_a, user_b])
    db.flush()

    cust_a = Customer(user_id=user_a.id, company_name="Company A")
    cust_b = Customer(user_id=user_b.id, company_name="Company B")
    db.add_all([cust_a, cust_b])
    db.flush()

    # Sub & Invoice for B (so A can try to access)
    sub_b = Subscription(
        subscription_number="SUB-B-001", customer_id=cust_b.id, plan_id=plan.id, status="active",
        start_date=date(2026, 1, 1), current_period_start=date(2026, 1, 1), current_period_end=date(2026, 1, 31),
        next_billing_date=date(2026, 2, 1)
    )
    db.add(sub_b)
    db.flush()
    inv_b = Invoice(
        invoice_number="INV-B-001", customer_id=cust_b.id, subscription_id=sub_b.id,
        billing_period_start=date(2026, 1, 1), billing_period_end=date(2026, 1, 31),
        issue_date=date(2026, 1, 1), due_date=date(2026, 1, 15),
        grand_total=Decimal("118.00"), amount_paid=Decimal("0.00"), balance_due=Decimal("118.00"),
        status="confirmed"
    )
    db.add(inv_b)
    db.commit()

    admin_token = create_access_token(str(admin.id), "admin")
    staff_token = create_access_token(str(staff.id), "staff")
    cust_a_token = create_access_token(str(user_a.id), "customer")
    sub_b_id = str(sub_b.id)
    inv_b_id = str(inv_b.id)

PUBLIC_PATHS = {"/api/health", "/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password", "/docs", "/openapi.json"}

def run_matrix():
    print("\n" + "="*110)
    print(f"{'METHOD':<7} | {'PATH':<42} | {'NO_TOKEN':<8} | {'CUSTOMER':<8} | {'STAFF':<8} | {'ADMIN':<8} | {'STATUS'}")
    print("="*110)

    # Collect OpenAPI routes
    routes = []
    openapi = app.openapi()
    for path, path_item in openapi["paths"].items():
        for method, operation in path_item.items():
            if method.upper() in ("GET", "POST", "PATCH", "DELETE"):
                routes.append((method.upper(), path))

    routes.sort(key=lambda x: (x[1], x[0]))

    total_checked = 0
    failures = 0

    for method, path in routes:
        total_checked += 1
        
        # Replace sample path params
        test_path = path.replace("{id}", inv_b_id).replace("{quotation_id}", str(uuid.uuid4())).replace("{token}", "sample")

        headers_none = {}
        headers_cust = {"Authorization": f"Bearer {cust_a_token}"}
        headers_staff = {"Authorization": f"Bearer {staff_token}"}
        headers_admin = {"Authorization": f"Bearer {admin_token}"}

        # Issue dummy requests
        def send(h):
            try:
                if method == "GET":
                    return client.get(test_path, headers=h).status_code
                elif method == "POST":
                    return client.post(test_path, headers=h, json={}).status_code
                elif method == "PATCH":
                    return client.patch(test_path, headers=h, json={}).status_code
                elif method == "DELETE":
                    return client.delete(test_path, headers=h).status_code
            except Exception:
                return 500

        s_none = send(headers_none)
        s_cust = send(headers_cust)
        s_staff = send(headers_staff)
        s_admin = send(headers_admin)

        is_public = path in PUBLIC_PATHS

        # Determine pass/fail
        passed = True
        if not is_public and s_none != 401:
            passed = False
        
        status_str = "PASS" if passed else "FAIL"
        if not passed:
            failures += 1

        print(f"{method:<7} | {path:<42} | {s_none:<8} | {s_cust:<8} | {s_staff:<8} | {s_admin:<8} | {status_str}")

    print("="*110)
    print(f"Total Routes Audited: {total_checked} | Total Failures: {failures}")
    print("="*110)

    # Cross-customer isolation check
    print("\n=== Cross-Customer Ownership Gate Test ===")
    res_sub = client.get(f"/api/portal/subscriptions/{sub_b_id}", headers={"Authorization": f"Bearer {cust_a_token}"})
    print(f"Customer A accessing Customer B's Subscription ({sub_b_id}): HTTP {res_sub.status_code} (Expected: 404)")
    assert res_sub.status_code == 404, f"Expected 404, got {res_sub.status_code}"

    res_inv = client.get(f"/api/portal/invoices/{inv_b_id}", headers={"Authorization": f"Bearer {cust_a_token}"})
    print(f"Customer A accessing Customer B's Invoice ({inv_b_id}): HTTP {res_inv.status_code} (Expected: 404)")
    assert res_inv.status_code == 404, f"Expected 404, got {res_inv.status_code}"

    print("[SUCCESS] Cross-customer ownership enforcement verified: 100% returns 404.\n")

if __name__ == "__main__":
    run_matrix()
