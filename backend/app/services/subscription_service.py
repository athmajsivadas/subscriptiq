from typing import Optional
from sqlalchemy.orm import Session
from app.core.clock import today_ist
from app.core.errors import AppError
from app.models.all_models import Subscription, SubscriptionStatusHistory, User
from app.services.billing_service import add_cycle, cycle_end

TRANSITIONS = {
    "draft": {"quotation"},
    "quotation": {"confirmed", "draft"},
    "confirmed": {"active"},
    "active": {"paused", "closed"},
    "paused": {"active", "closed"},
    "closed": set(),  # closed can never resume
}

def transition(
    db: Session,
    sub: Subscription,
    to_status: str,
    user: Optional[User],
    note: Optional[str] = None,
    system: bool = False,
) -> None:
    """
    Section 10.1: Transition state machine.
    Enforces plan flags, writes subscription_status_history row.
    """
    if to_status not in TRANSITIONS.get(sub.status, set()):
        raise AppError("ILLEGAL_TRANSITION", f"{sub.status} -> {to_status} not allowed", 409)

    plan = sub.plan
    if to_status == "paused" and not plan.allow_pause:
        raise AppError("PAUSE_NOT_ALLOWED", "Plan does not allow pausing", 409)
    if to_status == "active" and sub.status == "paused" and sub.expiry_date and sub.expiry_date < today_ist():
        raise AppError("SUBSCRIPTION_EXPIRED", "Expired subscriptions cannot resume", 409)
    if to_status == "closed" and not system and sub.status in ("active", "paused") and not plan.allow_early_close:
        raise AppError("EARLY_CLOSE_NOT_ALLOWED", "Plan does not allow early close", 409)

    sub.history.append(
        SubscriptionStatusHistory(
            from_status=sub.status,
            to_status=to_status,
            changed_by=user.id if user else None,
            note=note,
        )
    )
    sub.status = to_status

def activate_subscription(db: Session, sub: Subscription, user: Optional[User]) -> None:
    """
    Section 10.2: Activation.
    confirmed -> active: require at least one item.
    Sets current_period_start = start_date, current_period_end = cycle_end(start_date, cycle),
    next_billing_date = start_date.
    """
    if not sub.items:
        raise AppError("NO_ITEMS", "Cannot activate subscription without line items", 422)

    transition(db, sub, "active", user, note="Subscription activated")
    sub.current_period_start = sub.start_date
    sub.current_period_end = cycle_end(sub.start_date, sub.plan.billing_cycle)
    sub.next_billing_date = sub.start_date

def renew_subscription(db: Session, sub: Subscription, user: Optional[User]) -> None:
    """
    Section 10.3: Renewal.
    Active subscriptions with plan.allow_renewal: adds one cycle to expiry_date.
    """
    if sub.status != "active":
        raise AppError("RENEWAL_NOT_ALLOWED", f"Cannot renew subscription in {sub.status} status", 409)
    if not sub.plan.allow_renewal:
        raise AppError("RENEWAL_NOT_ALLOWED", "Plan does not allow renewal", 409)

    base_date = sub.expiry_date or today_ist()
    sub.expiry_date = add_cycle(base_date, sub.plan.billing_cycle)
    sub.history.append(
        SubscriptionStatusHistory(
            from_status=sub.status,
            to_status=sub.status,
            changed_by=user.id if user else None,
            note=f"Renewed until {sub.expiry_date}",
        )
    )
