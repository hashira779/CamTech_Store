from decimal import Decimal
from typing import Sequence

def derive_payment_status(payments: Sequence, grand_total: float | Decimal) -> str:
    """Payment status from the ACTUAL amount tendered vs the sale total.

    A sale is only PAID once payments cover the grand total; a smaller amount is
    PARTIAL, and none is PENDING.
    """
    total_paid = sum((Decimal(str(p.amount)) for p in payments), Decimal("0"))
    if total_paid <= 0:
        return "PENDING"
    if total_paid >= Decimal(str(grand_total)):
        return "PAID"
    return "PARTIAL"
