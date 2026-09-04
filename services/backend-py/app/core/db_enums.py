"""Central binding for the database's native Postgres ENUM types.

The schema defines many columns as native `ENUM` types. SQLAlchemy models must
declare those columns as the matching enum (not plain `String`), otherwise
asyncpg sends a bare `varchar` and Postgres rejects the insert with
`DatatypeMismatchError` (a 500 on every create).

`pg_enum("TypeName")` returns a FRESH `postgresql.ENUM` bound to the existing DB
type (`create_type=False`, so it is never (re)created) with the correct labels,
so SQLAlchemy emits the required `::"TypeName"` cast on insert/update.

Labels are the source-of-truth values from `pg_enum` in the live database.
"""
from sqlalchemy.dialects.postgresql import ENUM as _PgEnum

ENUM_LABELS: dict[str, list[str]] = {
    "AccountType": ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
    "AccountingPeriodStatus": ["OPEN", "CLOSED"],
    "AssetStatus": ["ACTIVE", "DISPOSED", "MAINTENANCE"],
    "CustomerType": ["INDIVIDUAL", "COMPANY", "WHOLESALE", "GOVERNMENT", "INTERNAL"],
    "DepreciationMethod": ["STRAIGHT_LINE", "DECLINING_BALANCE"],
    "EmploymentStatus": ["FULL_TIME", "PART_TIME", "CONTRACT", "PROBATION", "TERMINATED"],
    "GoodsReceiptStatus": ["DRAFT", "COMPLETED", "CANCELLED"],
    "JournalEntryStatus": ["DRAFT", "POSTED", "VOID"],
    "JournalSourceType": ["MANUAL", "SALE", "PROCUREMENT", "INVENTORY_ADJUSTMENT", "PAYMENT", "REFUND"],
    "LeaveStatus": ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
    "LeaveType": ["ANNUAL", "SICK", "MATERNITY", "UNPAID", "SPECIAL"],
    "LocationType": ["COMPANY", "BUSINESS_UNIT", "REGION", "BRANCH", "DEPARTMENT", "WAREHOUSE", "POS"],
    "LoyaltyTxType": ["EARN", "REDEEM", "ADJUST", "EXPIRE"],
    "NotificationChannel": ["IN_APP", "TELEGRAM", "EMAIL", "SMS"],
    "NotificationStatus": ["PENDING", "SENT", "FAILED", "READ"],
    "PaymentMethod": ["CASH", "CARD", "QR", "BANK_TRANSFER", "WALLET", "CREDIT", "OTHER"],
    "PaymentStatus": ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
    "PaymentTerm": ["IMMEDIATE", "NET_15", "NET_30", "NET_60", "COD"],
    "PayrollStatus": ["DRAFT", "CALCULATED", "APPROVED", "PAID"],
    "ProductType": ["PHYSICAL", "DIGITAL", "SERVICE", "BUNDLE", "RAW_MATERIAL"],
    "ProjectStatus": ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"],
    "PromotionScope": ["ORDER", "CATEGORY", "PRODUCT"],
    "PromotionType": ["PERCENTAGE", "FIXED_AMOUNT", "BUY_X_GET_Y", "ORDER_THRESHOLD"],
    "PurchaseOrderStatus": ["DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED", "COMPLETED", "CANCELLED"],
    "SaleStatus": ["DRAFT", "COMPLETED", "VOIDED", "REFUNDED", "PARTIALLY_REFUNDED"],
    "StockMovementType": ["SALE", "SALE_VOID", "SALE_REFUND", "PURCHASE_RECEIPT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "TRANSFER_IN", "TRANSFER_OUT", "DAMAGE", "EXPIRED", "COUNT"],
    "StockTransferStatus": ["DRAFT", "REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED", "CANCELLED"],
    "StoreCreditTxType": ["CREDIT", "DEBIT", "REFUND", "ADJUST"],
    "TaskStatus": ["TODO", "IN_PROGRESS", "REVIEW", "DONE"],
    "TicketPriority": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    "TicketStatus": ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"],
    "WarehouseZoneType": ["RECEIVING", "STORAGE", "PICKING", "SHIPPING", "COLD_STORAGE"],
    "WorkflowEntityType": ["PURCHASE_ORDER", "SALE_REFUND", "STOCK_TRANSFER", "JOURNAL_ENTRY", "EXPENSE_CLAIM", "CUSTOM"],
    "WorkflowStatus": ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
    "WorkflowStepStatus": ["PENDING", "APPROVED", "REJECTED", "SKIPPED"],
}


def pg_enum(name: str) -> _PgEnum:
    """A fresh ENUM bound to the existing DB type `name` (never re-created)."""
    return _PgEnum(*ENUM_LABELS[name], name=name, create_type=False)
