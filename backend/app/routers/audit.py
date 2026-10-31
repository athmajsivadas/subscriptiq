from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import admin_only
from app.models.all_models import AuditLog, User

router = APIRouter(prefix="/audit-logs", tags=["audit"])

class AuditLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_id: Optional[UUID] = None
    actor_email: Optional[str] = None
    actor_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[UUID] = None
    meta: dict
    created_at: datetime

class PaginatedAuditLogs(BaseModel):
    items: List[AuditLogItem]
    total: int
    page: int
    page_size: int

@router.get("", response_model=PaginatedAuditLogs)
def list_audit_logs(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    stmt = select(AuditLog)
    count_stmt = select(func.count(AuditLog.id))

    filters = []
    if action:
        filters.append(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)

    if filters:
        stmt = stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)

    total = db.scalar(count_stmt) or 0
    logs = db.execute(
        stmt.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    items = []
    for log in logs:
        actor_email = log.actor.email if log.actor else "System"
        actor_name = log.actor.full_name if log.actor else "System Automated"
        items.append(
            AuditLogItem(
                id=log.id,
                actor_id=log.actor_id,
                actor_email=actor_email,
                actor_name=actor_name,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                meta=log.meta or {},
                created_at=log.created_at,
            )
        )

    return PaginatedAuditLogs(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
