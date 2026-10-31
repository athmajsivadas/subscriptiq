from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.core.errors import AppError
from app.models.all_models import User, Customer

bearer = HTTPBearer(auto_error=False)

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise AppError("UNAUTHENTICATED", "Login required", 401)
    payload = decode_token(creds.credentials)
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise AppError("INVALID_TOKEN", "Invalid credentials", 401)
    return user

def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise AppError("FORBIDDEN", "Insufficient permissions", 403)
        return user
    return checker

admin_only = require_roles("admin")
staff_plus = require_roles("admin", "staff")
customer_only = require_roles("customer")

def current_customer(db: Session, user: User) -> Customer:
    c = db.execute(select(Customer).where(Customer.user_id == user.id)).scalar_one_or_none()
    if c is None:
        raise AppError("CUSTOMER_PROFILE_NOT_FOUND", "Customer profile not found", 403)
    return c
