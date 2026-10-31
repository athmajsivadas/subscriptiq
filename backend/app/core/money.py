from decimal import Decimal, ROUND_HALF_UP
from typing import Union

TWO = Decimal("0.01")
ZERO = Decimal("0.00")

def money(x: Union[str, int, float, Decimal]) -> Decimal:
    """
    Round to two decimal places using ROUND_HALF_UP.
    Accepts str, int, Decimal, or float (converted via Decimal(str(x))).
    """
    if isinstance(x, float):
        d = Decimal(str(x))
    else:
        d = Decimal(x)
    return d.quantize(TWO, rounding=ROUND_HALF_UP)
