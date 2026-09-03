import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Numeric,
    DateTime,
    ForeignKey,
    Integer,
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def gen_id():
    return str(uuid.uuid4())

class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # AccountType enum
    currency = Column(String, default="USD", nullable=False)
    description = Column(String, nullable=True)
    is_system = Column("isSystem", Boolean, default=False, nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class AccountingPeriod(Base):
    __tablename__ = "accounting_periods"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    start_date = Column("startDate", DateTime, nullable=False)
    end_date = Column("endDate", DateTime, nullable=False)
    status = Column(String, default="OPEN", nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    entry_number = Column("entryNumber", String, nullable=False)
    posting_date = Column("postingDate", DateTime, default=datetime.datetime.utcnow, nullable=False)
    source_type = Column("sourceType", String, default="MANUAL", nullable=False)
    source_id = Column("sourceId", String, nullable=True)
    description = Column(String, nullable=False)
    status = Column(String, default="DRAFT", nullable=False)
    period_id = Column("periodId", String, nullable=True)
    created_by_id = Column("createdById", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    lines = relationship("JournalLineItem", back_populates="entry", cascade="all, delete-orphan")

class JournalLineItem(Base):
    __tablename__ = "journal_line_items"

    id = Column(String, primary_key=True, default=gen_id)
    journal_entry_id = Column("journalEntryId", String, ForeignKey("journal_entries.id"), nullable=False)
    account_id = Column("accountId", String, ForeignKey("accounts.id"), nullable=False)
    debit = Column(Numeric(14, 4), default=0.0, nullable=False)
    credit = Column(Numeric(14, 4), default=0.0, nullable=False)
    memo = Column(String, nullable=True)

    entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account")

class FixedAsset(Base):
    __tablename__ = "fixed_assets"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    asset_code = Column("assetCode", String, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    purchase_date = Column("purchaseDate", DateTime, nullable=False)
    purchase_cost = Column("purchaseCost", Numeric(14, 4), nullable=False)
    salvage_value = Column("salvageValue", Numeric(14, 4), default=0.0, nullable=False)
    useful_life_months = Column("usefulLifeMonths", Integer, default=60, nullable=False)
    depreciation_method = Column("depreciationMethod", String, default="STRAIGHT_LINE", nullable=False)
    accumulated_deprec = Column("accumulatedDeprec", Numeric(14, 4), default=0.0, nullable=False)
    current_book_value = Column("currentBookValue", Numeric(14, 4), nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)
    location_id = Column("locationId", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class DepreciationRecord(Base):
    __tablename__ = "depreciation_records"

    id = Column(String, primary_key=True, default=gen_id)
    asset_id = Column("assetId", String, ForeignKey("fixed_assets.id"), nullable=False)
    period_date = Column("periodDate", DateTime, nullable=False)
    amount = Column(Numeric(14, 4), nullable=False)
    book_value_after = Column("bookValueAfter", Numeric(14, 4), nullable=False)
    journal_entry_id = Column("journalEntryId", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
