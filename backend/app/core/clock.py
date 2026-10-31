from datetime import date, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

def today_ist() -> date:
    """Return the current date in Asia/Kolkata timezone."""
    return datetime.now(IST).date()
