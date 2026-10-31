import uuid
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models.all_models import AuditLog, User

def audit(
    db: Session,
    user: Optional[User],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID],
    meta: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """
    Writes an audit_logs row in the caller's transaction.
    Does not commit or begin new transactions.
    """
    log = AuditLog(
        actor_id=user.id if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        meta=meta or {},
    )
    db.add(log)
    return log
