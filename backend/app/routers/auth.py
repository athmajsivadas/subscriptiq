from typing import List, Optional
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import (
    validate_password,
    hash_password,
    verify_password,
    create_access_token,
)
from app.core.permissions import get_current_user, admin_only
from app.services.audit_service import audit
from app.models.all_models import User, Customer, PasswordResetToken
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    StaffCreateRequest,
    UserResponse,
    TokenResponse,
)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
router = APIRouter(tags=["auth"])

@router.post("/auth/register", status_code=201)
@limiter.limit("20/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    if not validate_password(body.password):
        raise AppError(
            "INVALID_PASSWORD",
            "Password must be more than 8 characters and include uppercase, lowercase, and special characters",
            422,
        )

    clean_email = body.email.strip().lower()

    # Public registration always creates role=customer and customers row
    user = User(
        full_name=body.full_name.strip(),
        email=clean_email,
        password_hash=hash_password(body.password),
        role="customer",
        is_active=True,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppError("EMAIL_EXISTS", "A user with this email already exists", 409)

    customer = Customer(
        user_id=user.id,
        company_name=body.company_name.strip(),
        phone=body.phone,
        billing_address=body.billing_address,
        tax_identifier=body.tax_identifier,
    )
    db.add(customer)
    audit(db, user, "user.registered", "user", user.id, {"role": "customer", "email": clean_email})

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError("EMAIL_EXISTS", "A user with this email already exists", 409)

    token = create_access_token(str(user.id), user.role)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )

@router.post("/auth/login")
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    clean_email = body.email.strip().lower()
    user = db.execute(select(User).where(func.lower(User.email) == clean_email)).scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise AppError("INVALID_CREDENTIALS", "Invalid email or password", 401)
    if not user.is_active:
        raise AppError("USER_INACTIVE", "Account is deactivated", 401)

    token = create_access_token(str(user.id), user.role)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )

@router.get("/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)

@router.post("/auth/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    clean_email = body.email.strip().lower()
    user = db.execute(select(User).where(func.lower(User.email) == clean_email)).scalar_one_or_none()

    if user and user.is_active:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

        prt = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(prt)
        db.commit()

        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
        # Console email backend logs the reset link
        print(f"[CONSOLE EMAIL] Password reset requested for {clean_email}: {reset_url}")

    # Section 7.4 rule 1: generic response regardless of whether email exists
    return {
        "message": "If this email is registered, you will receive password reset instructions shortly."
    }

@router.post("/auth/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if not validate_password(body.new_password):
        raise AppError(
            "INVALID_PASSWORD",
            "Password must be more than 8 characters and include uppercase, lowercase, and special characters",
            422,
        )

    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    prt = db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    ).scalar_one_or_none()

    if not prt:
        raise AppError("INVALID_RESET_TOKEN", "Reset token is invalid or has expired", 400)

    user = db.get(User, prt.user_id)
    if not user or not user.is_active:
        raise AppError("USER_INACTIVE", "User account is inactive", 400)

    user.password_hash = hash_password(body.new_password)
    prt.used_at = now
    audit(db, user, "user.password_reset", "user", user.id, {})

    db.commit()
    return {"message": "Password has been successfully reset."}

@router.post("/users/staff", status_code=201)
def create_staff(
    body: StaffCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    if not validate_password(body.password):
        raise AppError(
            "INVALID_PASSWORD",
            "Password must be more than 8 characters and include uppercase, lowercase, and special characters",
            422,
        )

    clean_email = body.email.strip().lower()
    staff = User(
        full_name=body.full_name.strip(),
        email=clean_email,
        password_hash=hash_password(body.password),
        role="staff",
        is_active=True,
    )
    db.add(staff)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppError("EMAIL_EXISTS", "A user with this email already exists", 409)

    audit(db, admin, "user.staff_created", "user", staff.id, {"email": clean_email})
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError("EMAIL_EXISTS", "A user with this email already exists", 409)

    db.refresh(staff)
    return UserResponse.model_validate(staff)

@router.get("/users/staff", response_model=List[UserResponse])
def list_staff(
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    staff_members = db.execute(select(User).where(User.role == "staff").order_by(User.created_at.desc())).scalars().all()
    return [UserResponse.model_validate(s) for s in staff_members]
