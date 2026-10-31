import logging
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text, select
from app.core.database import engine, SessionLocal
from app.core.config import settings
from app.core.clock import today_ist

logger = logging.getLogger(__name__)

LOCK_BILLING = 710001
LOCK_EXPIRY = 710002

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

def with_advisory_lock(key: int, fn):
    """Advisory lock wrapper so only one instance runs the job."""
    with engine.connect() as conn:
        if not conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": key}).scalar():
            return  # another instance is running it
        try:
            fn()
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key})
            conn.commit()

def close_expired_subscriptions(session_factory=None):
    """
    Section 16: For active subscriptions with expiry_date < today and plan.auto_close_on_end,
    call transition(..., "closed", user=None, system=True, note="Expired"),
    one transaction per subscription.
    """
    from app.models.all_models import Subscription, Plan
    from app.services.subscription_service import transition

    maker = session_factory or SessionLocal
    today = today_ist()
    with maker() as db:
        subs = db.execute(
            select(Subscription)
            .join(Plan)
            .where(
                Subscription.status == "active",
                Subscription.expiry_date.isnot(None),
                Subscription.expiry_date < today,
                Plan.auto_close_on_end.is_(True),
            )
        ).scalars().all()
        sub_ids = [s.id for s in subs]

    for sid in sub_ids:
        try:
            with maker() as db:
                sub = db.get(Subscription, sid)
                if sub and sub.status == "active":
                    transition(db, sub, "closed", user=None, system=True, note="Expired")
                    db.commit()
        except Exception:
            logger.exception("Failed to close expired subscription %s", sid)

def send_overdue_reminders():
    """
    Section 16: Send overdue reminders for invoices overdue by 1, 3, 7 days.
    Insert into notifications with unique (invoice_id, kind) BEFORE emailing
    so reruns never duplicate emails.
    """
    from app.models.all_models import Invoice, Notification
    from sqlalchemy.exc import IntegrityError
    from datetime import timedelta

    today = today_ist()
    thresholds = [
        (1, "overdue_1_day"),
        (3, "overdue_3_days"),
        (7, "overdue_7_days"),
    ]

    with SessionLocal() as db:
        for days, kind in thresholds:
            target_date = today - timedelta(days=days)
            overdue_invoices = db.execute(
                select(Invoice).where(
                    Invoice.status == "confirmed",
                    Invoice.balance_due > 0,
                    Invoice.due_date == target_date,
                )
            ).scalars().all()

            for inv in overdue_invoices:
                notif = Notification(invoice_id=inv.id, kind=kind)
                db.add(notif)
                try:
                    db.flush()
                    print(f"[CONSOLE EMAIL] Overdue reminder ({kind}): Invoice {inv.invoice_number} is {days} day(s) overdue")
                except IntegrityError:
                    db.rollback()
                    continue
            db.commit()

def start():
    """Start the scheduler if ENABLE_SCHEDULER is true."""
    if not settings.ENABLE_SCHEDULER:
        return

    from app.services.billing_service import run_due_billing_job

    scheduler.add_job(
        lambda: with_advisory_lock(LOCK_BILLING, run_due_billing_job),
        "cron", hour=1, minute=0, id="billing", max_instances=1, replace_existing=True
    )
    scheduler.add_job(
        lambda: with_advisory_lock(LOCK_EXPIRY, close_expired_subscriptions),
        "cron", hour=2, minute=0, id="expiry", max_instances=1, replace_existing=True
    )
    scheduler.add_job(
        send_overdue_reminders,
        "cron", hour=8, minute=0, id="reminders", replace_existing=True
    )
    scheduler.start()
