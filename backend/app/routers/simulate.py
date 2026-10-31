from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError
from app.core.permissions import admin_only
from app.services.billing_service import run_due_billing_job
from app.models.all_models import User

router = APIRouter(prefix="/simulate", tags=["simulation"])

@router.post("/billing-day")
def simulate_billing_day(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    if not settings.ENABLE_BILLING_SIMULATION:
        raise AppError("SIMULATION_DISABLED", "Simulation is disabled", 403)
    return run_due_billing_job(limit=limit, session=db)
