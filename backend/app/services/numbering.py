import sqlalchemy as sa
from sqlalchemy.orm import Session
from app.core.clock import today_ist

def next_number(db: Session, prefix: str) -> str:
    """
    Section 6.5: Atomic sequence numbering using PostgreSQL ON CONFLICT DO UPDATE.
    Example output: SUB-2026-000001, QUO-2026-000001, INV-2026-000001
    """
    year = today_ist().year
    key = f"{prefix}-{year}"
    value = db.execute(
        sa.text(
            "INSERT INTO sequences(name, value) VALUES (:k, 1) "
            "ON CONFLICT (name) DO UPDATE SET value = sequences.value + 1 RETURNING value"
        ),
        {"k": key},
    ).scalar_one()
    return f"{key}-{value:06d}"
