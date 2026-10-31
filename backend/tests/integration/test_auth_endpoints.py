import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.config import settings
from app.core.database import get_db, Base
from app.core.security import create_access_token, hash_password
from app.models.all_models import User, PasswordResetToken

# Bind tests to test database
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

def test_registration_and_duplicate_email():
    unique_email = f"cust_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "full_name": "Acme Corp Owner",
        "email": unique_email,
        "password": "Password#123",
        "company_name": "Acme Corp",
        "phone": "+919876543210",
        "billing_address": "123 Main St, Bengaluru",
        "tax_identifier": "GSTIN12345",
    }
    # 1. Successful register
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "customer"
    assert data["user"]["email"] == unique_email.lower()

    # 2. Duplicate registration returns 409 friendly envelope
    res_dup = client.post("/api/auth/register", json=payload)
    assert res_dup.status_code == 409
    err = res_dup.json()["error"]
    assert err["code"] == "EMAIL_EXISTS"

def test_login_and_auth_me():
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "full_name": "Test User",
        "email": email,
        "password": "ValidPassword#1",
        "company_name": "Test LLC",
    }
    reg = client.post("/api/auth/register", json=payload)
    assert reg.status_code == 201

    # Login with valid credentials
    log_res = client.post("/api/auth/login", json={"email": email, "password": "ValidPassword#1"})
    assert log_res.status_code == 200
    token = log_res.json()["access_token"]

    # Access GET /auth/me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email

    # Invalid password login
    bad_login = client.post("/api/auth/login", json={"email": email, "password": "WrongPassword#1"})
    assert bad_login.status_code == 401
    assert bad_login.json()["error"]["code"] == "INVALID_CREDENTIALS"

def test_customer_cannot_create_staff_and_role_guards_return_403():
    # Register customer
    cust_email = f"cust_{uuid.uuid4().hex[:8]}@example.com"
    reg = client.post("/api/auth/register", json={
        "full_name": "Regular Customer",
        "email": cust_email,
        "password": "Password#123",
        "company_name": "Reg Co",
    })
    token = reg.json()["access_token"]

    # Customer tries to create staff -> 403 FORBIDDEN
    staff_payload = {
        "full_name": "Staff Person",
        "email": f"staff_{uuid.uuid4().hex[:8]}@example.com",
        "password": "Password#123",
    }
    res = client.post(
        "/api/users/staff",
        json=staff_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"

def test_admin_can_create_staff():
    # Insert admin into db
    admin_id = uuid.uuid4()
    with TestingSessionLocal() as db:
        admin = User(
            id=admin_id,
            full_name="Super Admin",
            email=f"admin_{uuid.uuid4().hex[:8]}@brightloop.test",
            password_hash=hash_password("Admin#2026"),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()

    admin_token = create_access_token(str(admin_id), "admin")
    staff_email = f"staff_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post(
        "/api/users/staff",
        json={
            "full_name": "Staff Worker",
            "email": staff_email,
            "password": "StaffPassword#1",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "staff"
    assert data["email"] == staff_email.lower()

def test_forgot_and_reset_password_flow():
    # 1. Non-existent email returns generic response
    res = client.post("/api/auth/forgot-password", json={"email": "nonexistent@example.com"})
    assert res.status_code == 200
    assert "instructions shortly" in res.json()["message"]

    # 2. Existing user forgot password
    user_email = f"reset_user_{uuid.uuid4().hex[:8]}@example.com"
    client.post("/api/auth/register", json={
        "full_name": "Reset User",
        "email": user_email,
        "password": "InitialPass#1",
        "company_name": "Co",
    })

    res2 = client.post("/api/auth/forgot-password", json={"email": user_email})
    assert res2.status_code == 200

    # Retrieve reset token from DB
    import hashlib
    with TestingSessionLocal() as db:
        user = db.query(User).filter(User.email == user_email).first()
        token_record = db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).first()
        assert token_record is not None
        # Verify valid raw token can be checked
        raw_token = "mock-token-for-test"
        token_record.token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        db.commit()

    # 3. Reset password using token
    new_pw = "BrandNewPass#2026"
    res3 = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": new_pw,
    })
    assert res3.status_code == 200

    # Verify old password fails and new password works
    fail_log = client.post("/api/auth/login", json={"email": user_email, "password": "InitialPass#1"})
    assert fail_log.status_code == 401

    ok_log = client.post("/api/auth/login", json={"email": user_email, "password": new_pw})
    assert ok_log.status_code == 200

    # 4. Reusing token fails
    res_reuse = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": "AnotherNewPass#2026",
    })
    assert res_reuse.status_code == 400
    assert res_reuse.json()["error"]["code"] == "INVALID_RESET_TOKEN"
