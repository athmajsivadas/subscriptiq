from decimal import Decimal
import pytest
from app.core.money import money, ZERO, TWO
from app.core.clock import today_ist
from app.core.errors import AppError, envelope
from datetime import date

def test_money_rounding_half_up():
    # User requirement: money("2.675") == Decimal("2.68")
    assert money("2.675") == Decimal("2.68")
    assert money("2.674") == Decimal("2.67")
    assert money("2.6750") == Decimal("2.68")
    assert money("0.005") == Decimal("0.01")
    assert money("0.004") == Decimal("0.00")
    assert money(0) == Decimal("0.00")
    assert money(10) == Decimal("10.00")

def test_money_types():
    assert money(15) == Decimal("15.00")
    assert money(15.5) == Decimal("15.50")
    assert money("199.99") == Decimal("199.99")
    assert money(Decimal("100.555")) == Decimal("100.56")

def test_clock_today_ist():
    d = today_ist()
    assert isinstance(d, date)
    assert d.year >= 2026

def test_error_envelope():
    env = envelope("INVALID_INPUT", "Bad value", {"field": "amount"})
    assert env == {
        "error": {
            "code": "INVALID_INPUT",
            "message": "Bad value",
            "details": {"field": "amount"},
        }
    }

def test_app_error_exception():
    err = AppError("CODE_1", "Test error", 400, {"key": "val"})
    assert err.code == "CODE_1"
    assert err.message == "Test error"
    assert err.http_status == 400
    assert err.details == {"key": "val"}
