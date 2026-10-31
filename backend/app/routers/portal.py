from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import customer_only, current_customer
from app.models.all_models import Plan, User
from app.schemas.reports import PortalPlanResponse, PortalProfileResponse

router = APIRouter(prefix="/portal", tags=["portal"])

@router.get("/plans", response_model=List[PortalPlanResponse])
def get_portal_plans(
    db: Session = Depends(get_db),
    user: User = Depends(customer_only),
):
    """List available active plans for customer."""
    plans = db.execute(
        select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.price.asc())
    ).scalars().all()
    return plans

@router.get("/profile", response_model=PortalProfileResponse)
def get_portal_profile(
    db: Session = Depends(get_db),
    user: User = Depends(customer_only),
):
    """Get current customer's profile info."""
    cust = current_customer(db, user)
    return PortalProfileResponse(
        customer_id=cust.id,
        company_name=cust.company_name,
        phone=cust.phone,
        billing_address=cust.billing_address,
        tax_identifier=cust.tax_identifier,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        created_at=cust.created_at,
    )
