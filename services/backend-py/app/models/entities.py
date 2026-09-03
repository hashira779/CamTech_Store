import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Numeric,
    Integer,
    DateTime,
    ForeignKey,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from app.core.database import Base

def gen_id():
    return str(uuid.uuid4())

# ==============================================================================
# 1. CORE TENANT & USER
# ==============================================================================

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    currency = Column(String, default="USD", nullable=False)
    timezone = Column(String, default="UTC", nullable=False)
    tax_rate_pct = Column("taxRatePct", Numeric(14, 4), default=10, nullable=False)
    business_type = Column("businessType", String, default="RETAIL", nullable=False)
    settings = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    users = relationship("User", back_populates="organization")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column("passwordHash", String, nullable=False)
    roles = Column(Text, default='["STAFF"]', nullable=False)  # JSON-encoded array string
    location_id = Column("locationId", String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="users")

class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    parent_id = Column("parentId", String, nullable=True)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True)  # Prisma has code as optional
    type = Column(String, default="BRANCH", nullable=False)  # LocationType enum
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Note: Prisma schema does NOT have isActive on Location

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, nullable=True)  # Prisma: nullable
    actor_id = Column("actorId", String, nullable=True)  # Prisma column name
    action = Column(String, nullable=False)
    resource_type = Column("resourceType", String, nullable=False)  # Prisma: NOT NULL
    resource_id = Column("resourceId", String, nullable=True)
    metadata_ = Column("metadata", String, nullable=True)  # JSON-encoded metadata
    ip = Column(String, nullable=True)
    result = Column(String, default="SUCCESS", nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

# ==============================================================================
# 2. CATALOG & INVENTORY
# ==============================================================================

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    parent_id = Column("parentId", String, nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class Brand(Base):
    __tablename__ = "brands"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    category_id = Column("categoryId", String, ForeignKey("categories.id"), nullable=True)
    brand_id = Column("brandId", String, ForeignKey("brands.id"), nullable=True)
    type = Column(String, default="PHYSICAL", nullable=False)  # ProductType enum
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")

class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(String, primary_key=True, default=gen_id)
    product_id = Column("productId", String, ForeignKey("products.id"), nullable=False)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    sku = Column(String, nullable=False)
    name = Column(String, nullable=True)  # Prisma: optional
    barcode = Column(String, nullable=True)
    unit = Column(String, default="piece", nullable=False)
    currency = Column(String, default="USD", nullable=False)
    cost_price = Column("costPrice", Numeric(14, 4), default=0.0, nullable=False)
    sell_price = Column("sellPrice", Numeric(14, 4), default=0.0, nullable=False)
    tax_rate_pct = Column("taxRatePct", Numeric(14, 4), default=0.0, nullable=False)
    tax_rate_id = Column("taxRateId", String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="variants")

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    product_variant_id = Column("productVariantId", String, ForeignKey("product_variants.id"), nullable=False)  # FIXED: was variantId
    location_id = Column("locationId", String, ForeignKey("locations.id"), nullable=False)
    stock_on_hand = Column("stockOnHand", Numeric(14, 4), default=0.0, nullable=False)
    reserved_qty = Column("reservedQty", Numeric(14, 4), default=0.0, nullable=False)
    minimum_stock = Column("minimumStock", Numeric(14, 4), default=0.0, nullable=False)
    maximum_stock = Column("maximumStock", Numeric(14, 4), nullable=True)
    reorder_point = Column("reorderPoint", Numeric(14, 4), nullable=True)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Note: Prisma has NO createdAt on InventoryItem

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    inventory_item_id = Column("inventoryItemId", String, ForeignKey("inventory_items.id"), nullable=False)  # FIXED: was variantId
    type = Column(String, nullable=False)  # StockMovementType enum
    quantity = Column(Numeric(14, 4), nullable=False)
    balance_after = Column("balanceAfter", Numeric(14, 4), nullable=False)  # FIXED: was missing (NOT NULL)
    reference_type = Column("referenceType", String, nullable=True)
    reference_id = Column("referenceId", String, nullable=True)
    notes = Column(String, nullable=True)
    user_id = Column("userId", String, nullable=False)  # FIXED: was missing (NOT NULL)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Removed: locationId, reference (not in Prisma schema)

# ==============================================================================
# 3. CRM & SALES
# ==============================================================================

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    code = Column(String, nullable=True)  # Prisma: optional
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    tax_id = Column("taxId", String, nullable=True)
    type = Column(String, default="INDIVIDUAL", nullable=False)  # CustomerType enum
    price_list_id = Column("priceListId", String, nullable=True)
    loyalty_points = Column("loyaltyPoints", Integer, default=0, nullable=False)
    loyalty_tier = Column("loyaltyTier", String, default="BRONZE", nullable=False)
    store_credit = Column("storeCredit", Numeric(14, 4), default=0.0, nullable=False)
    notes = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Removed: creditBalance (not in Prisma — Prisma uses loyaltyPoints/loyaltyTier/storeCredit)

class CustomerAddress(Base):
    __tablename__ = "customer_addresses"

    id = Column(String, primary_key=True, default=gen_id)
    customer_id = Column("customerId", String, ForeignKey("customers.id"), nullable=False)
    label = Column(String, default="Main", nullable=False)
    line1 = Column(String, nullable=False)
    line2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    province = Column(String, nullable=True)
    postal_code = Column("postalCode", String, nullable=True)
    country = Column(String, default="KH", nullable=False)
    is_default = Column("isDefault", Boolean, default=False, nullable=False)

class Sale(Base):
    __tablename__ = "sales"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    location_id = Column("locationId", String, nullable=True)  # Prisma: optional
    customer_id = Column("customerId", String, nullable=True)
    user_id = Column("userId", String, nullable=False)  # FIXED: was missing (NOT NULL)
    idempotency_key = Column("idempotencyKey", String, unique=True, nullable=True)
    sale_number = Column("saleNumber", String, nullable=False)
    channel = Column(String, default="POS", nullable=False)
    status = Column(String, default="DRAFT", nullable=False)  # SaleStatus enum
    subtotal = Column(Numeric(14, 4), nullable=False)
    discount_total = Column("discountTotal", Numeric(14, 4), default=0.0, nullable=False)
    tax_total = Column("taxTotal", Numeric(14, 4), default=0.0, nullable=False)
    grand_total = Column("grandTotal", Numeric(14, 4), nullable=False)
    currency = Column(String, default="USD", nullable=False)
    notes = Column(String, nullable=True)
    promotion_id = Column("promotionId", String, nullable=True)
    promotion_code = Column("promotionCode", String, nullable=True)
    completed_at = Column("completedAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Removed: itemCount, customerName, paymentStatus (not in Prisma schema)

    line_items = relationship("SaleLineItem", back_populates="sale", cascade="all, delete-orphan")
    payments = relationship("SalePayment", back_populates="sale", cascade="all, delete-orphan")

class SaleLineItem(Base):
    __tablename__ = "sale_line_items"

    id = Column(String, primary_key=True, default=gen_id)
    sale_id = Column("saleId", String, ForeignKey("sales.id"), nullable=False)
    product_variant_id = Column("productVariantId", String, nullable=False)  # FIXED: was variantId
    sku = Column(String, nullable=False)
    product_name = Column("productName", String, nullable=False)  # FIXED: was 'name'
    variant_name = Column("variantName", String, nullable=True)
    quantity = Column(Numeric(14, 4), nullable=False)
    unit_price = Column("unitPrice", Numeric(14, 4), nullable=False)
    discount = Column(Numeric(14, 4), default=0.0, nullable=False)
    tax_rate_pct = Column("taxRatePct", Numeric(14, 4), default=0.0, nullable=False)
    tax_amount = Column("taxAmount", Numeric(14, 4), default=0.0, nullable=False)
    line_total = Column("lineTotal", Numeric(14, 4), nullable=False)

    sale = relationship("Sale", back_populates="line_items")

class SalePayment(Base):
    __tablename__ = "sale_payments"

    id = Column(String, primary_key=True, default=gen_id)
    sale_id = Column("saleId", String, ForeignKey("sales.id"), nullable=False)
    method = Column(String, nullable=False)  # PaymentMethod enum
    status = Column(String, default="COMPLETED", nullable=False)  # PaymentStatus enum
    provider = Column(String, nullable=True)
    amount = Column(Numeric(14, 4), nullable=False)
    reference = Column(String, nullable=True)
    external_id = Column("externalId", String, nullable=True)
    qr_string = Column("qrString", String, nullable=True)
    paid_at = Column("paidAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Removed: createdAt (Prisma uses paidAt instead)

    sale = relationship("Sale", back_populates="payments")

# ==============================================================================
# 4. FINANCE & ACCOUNTING
# ==============================================================================

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

    # Removed: category (not in Prisma schema)

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
    description = Column(String, nullable=False)  # FIXED: was 'date'/'memo' — Prisma uses 'description' (NOT NULL)
    status = Column(String, default="DRAFT", nullable=False)
    period_id = Column("periodId", String, nullable=True)
    created_by_id = Column("createdById", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    lines = relationship("JournalLineItem", back_populates="entry", cascade="all, delete-orphan")

class JournalLineItem(Base):
    __tablename__ = "journal_line_items"  # FIXED: was 'journal_lines'

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
    asset_code = Column("assetCode", String, nullable=False)  # FIXED: was 'assetNumber'
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    purchase_date = Column("purchaseDate", DateTime, nullable=False)
    purchase_cost = Column("purchaseCost", Numeric(14, 4), nullable=False)
    salvage_value = Column("salvageValue", Numeric(14, 4), default=0.0, nullable=False)
    useful_life_months = Column("usefulLifeMonths", Integer, default=60, nullable=False)
    depreciation_method = Column("depreciationMethod", String, default="STRAIGHT_LINE", nullable=False)
    accumulated_deprec = Column("accumulatedDeprec", Numeric(14, 4), default=0.0, nullable=False)  # FIXED: was 'accumulatedDepreciation'
    current_book_value = Column("currentBookValue", Numeric(14, 4), nullable=False)  # FIXED: was 'bookValue'
    status = Column(String, default="ACTIVE", nullable=False)
    location_id = Column("locationId", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class DepreciationRecord(Base):
    __tablename__ = "depreciation_records"

    id = Column(String, primary_key=True, default=gen_id)
    asset_id = Column("assetId", String, ForeignKey("fixed_assets.id"), nullable=False)
    period_date = Column("periodDate", DateTime, nullable=False)
    amount = Column(Numeric(14, 4), nullable=False)  # FIXED: was 'depreciationAmount'
    book_value_after = Column("bookValueAfter", Numeric(14, 4), nullable=False)
    journal_entry_id = Column("journalEntryId", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

# ==============================================================================
# 5. WORKFORCE, TICKETS, APPROVALS
# ==============================================================================

class ServiceTicket(Base):
    __tablename__ = "service_tickets"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    ticket_number = Column("ticketNumber", String, nullable=False)
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String, default="MEDIUM", nullable=False)
    status = Column(String, default="OPEN", nullable=False)
    category = Column(String, default="GENERAL", nullable=False)
    assigned_to_id = Column("assignedToId", String, nullable=True)
    reporter_id = Column("reporterId", String, nullable=True)
    customer_id = Column("customerId", String, nullable=True)
    resolution = Column(String, nullable=True)
    resolved_at = Column("resolvedAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    comments = relationship("TicketComment", back_populates="ticket", cascade="all, delete-orphan")

class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id = Column(String, primary_key=True, default=gen_id)
    ticket_id = Column("ticketId", String, ForeignKey("service_tickets.id"), nullable=False)
    author_id = Column("authorId", String, nullable=True)
    author_name = Column("authorName", String, nullable=False)
    comment = Column(Text, nullable=False)  # FIXED: was 'content'
    is_internal = Column("isInternal", Boolean, default=False, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

    ticket = relationship("ServiceTicket", back_populates="comments")

# ==============================================================================
# 6. INTEGRATIONS & FLOW AUTOMATIONS
# ==============================================================================

class DeveloperApp(Base):
    __tablename__ = "developer_apps"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    homepage_url = Column("homepageUrl", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Removed: status (not in Prisma schema)

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    app_id = Column("appId", String, ForeignKey("developer_apps.id"), nullable=True)
    name = Column(String, nullable=False)
    key_prefix = Column("keyPrefix", String, nullable=False)
    key_hash = Column("keyHash", String, unique=True, nullable=False)
    scopes = Column("scopes", PG_ARRAY(String), nullable=False)  # FIXED: was Text — Prisma uses String[]
    rate_limit = Column("rateLimit", Integer, default=60, nullable=False)
    expires_at = Column("expiresAt", DateTime, nullable=True)
    last_used_at = Column("lastUsedAt", DateTime, nullable=True)
    revoked_at = Column("revokedAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Removed: status, updatedAt (not in Prisma schema)

class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    url = Column(String, nullable=False)
    secret = Column(String, nullable=False)
    description = Column(String, nullable=True)
    events = Column("events", PG_ARRAY(String), nullable=False)  # FIXED: was Text — Prisma uses String[]
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Removed: appId, status (not in Prisma schema)

class TelegramChatBinding(Base):
    __tablename__ = "telegram_chat_bindings"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    chat_id = Column("chatId", String, nullable=False)
    chat_title = Column("chatTitle", String, nullable=True)
    username = Column(String, nullable=True)
    role = Column(String, default="OPERATOR", nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    bound_by_user_id = Column("boundByUserId", String, nullable=True)  # FIXED: was 'boundById'
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class AutomationFlow(Base):
    __tablename__ = "automation_flows"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    trigger_type = Column("triggerType", String, default="MANUAL", nullable=False)
    nodes = Column(JSON, default=list, nullable=False)
    edges = Column(JSON, default=list, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class FlowExecution(Base):
    __tablename__ = "flow_executions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    flow_id = Column("flowId", String, ForeignKey("automation_flows.id"), nullable=False)
    trigger_type = Column("triggerType", String, nullable=False)
    status = Column(String, default="RUNNING", nullable=False)  # FIXED: was 'SUCCESS'
    trigger_payload = Column("triggerPayload", JSON, default=dict, nullable=False)
    execution_trace = Column("executionTrace", JSON, default=list, nullable=False)
    started_at = Column("startedAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    finished_at = Column("finishedAt", DateTime, nullable=True)

# ==============================================================================
# 7. TAXES, PRICING, PROMOTIONS, LOYALTY, STORAGE, NOTIFICATIONS
# ==============================================================================

class TaxRate(Base):
    __tablename__ = "tax_rates"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    code = Column(String, nullable=False)  # FIXED: was missing (NOT NULL)
    name = Column(String, nullable=False)
    rate_pct = Column("ratePct", Numeric(6, 4), nullable=False)
    is_inclusive = Column("isInclusive", Boolean, default=False, nullable=False)
    is_compound = Column("isCompound", Boolean, default=False, nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)  # FIXED: was missing

class PriceList(Base):
    __tablename__ = "price_lists"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    description = Column(String, nullable=True)
    currency = Column(String, default="USD", nullable=False)
    is_default = Column("isDefault", Boolean, default=False, nullable=False)
    customer_type = Column("customerType", String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)  # FIXED: was missing

class PriceListItem(Base):
    __tablename__ = "price_list_items"

    id = Column(String, primary_key=True, default=gen_id)
    price_list_id = Column("priceListId", String, ForeignKey("price_lists.id"), nullable=False)
    product_variant_id = Column("productVariantId", String, ForeignKey("product_variants.id"), nullable=False)
    unit_price = Column("unitPrice", Numeric(14, 4), nullable=False)
    min_quantity = Column("minQuantity", Numeric(14, 4), default=1.0, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True)
    description = Column(String, nullable=True)
    type = Column(String, default="PERCENTAGE", nullable=False)  # PromotionType enum
    scope = Column(String, default="ORDER", nullable=False)  # PromotionScope enum
    discount_value = Column("discountValue", Numeric(14, 4), nullable=False)  # FIXED: was 'value'
    min_order_amount = Column("minOrderAmount", Numeric(14, 4), nullable=True)  # FIXED: was 'minSpend'
    max_discount_amount = Column("maxDiscountAmount", Numeric(14, 4), nullable=True)
    buy_quantity = Column("buyQuantity", Integer, nullable=True)
    get_quantity = Column("getQuantity", Integer, nullable=True)
    start_date = Column("startDate", DateTime, nullable=True)
    end_date = Column("endDate", DateTime, nullable=True)
    usage_limit = Column("usageLimit", Integer, nullable=True)
    current_uses = Column("currentUses", Integer, default=0, nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    target_variant_ids = Column("targetVariantIds", String, nullable=True)
    target_category_ids = Column("targetCategoryIds", String, nullable=True)
    customer_types = Column("customerTypes", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)  # FIXED: was missing

class LoyaltyProgramConfig(Base):
    __tablename__ = "loyalty_program_configs"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), unique=True, nullable=False)
    earn_rate = Column("earnRate", Numeric(8, 4), default=1.0, nullable=False)
    redeem_rate = Column("redeemRate", Numeric(8, 4), default=0.01, nullable=False)
    min_points_redeem = Column("minPointsRedeem", Integer, default=50, nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    customer_id = Column("customerId", String, ForeignKey("customers.id"), nullable=False)
    type = Column(String, nullable=False)  # LoyaltyTxType enum
    points = Column(Integer, nullable=False)
    balance_after = Column("balanceAfter", Integer, nullable=False)  # FIXED: was missing (NOT NULL)
    reference_type = Column("referenceType", String, nullable=True)
    reference_id = Column("referenceId", String, nullable=True)
    notes = Column(String, nullable=True)
    actor_id = Column("actorId", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Removed: reference (not in Prisma — Prisma uses referenceType + referenceId)

class StoreCreditTransaction(Base):
    __tablename__ = "store_credit_transactions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    customer_id = Column("customerId", String, ForeignKey("customers.id"), nullable=False)
    type = Column(String, nullable=False)  # StoreCreditTxType enum
    amount = Column(Numeric(14, 4), nullable=False)
    balance_after = Column("balanceAfter", Numeric(14, 4), nullable=False)
    reference_type = Column("referenceType", String, nullable=True)
    reference_id = Column("referenceId", String, nullable=True)
    notes = Column(String, nullable=True)
    actor_id = Column("actorId", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

class DocumentRecord(Base):
    __tablename__ = "document_records"  # FIXED: was 'documents'

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    bucket = Column(String, default="default", nullable=False)
    key = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    mime_type = Column("mimeType", String, nullable=False)
    byte_size = Column("byteSize", Integer, nullable=False)  # FIXED: was 'sizeBytes'
    is_public = Column("isPublic", Boolean, default=False, nullable=False)
    status = Column(String, default="PENDING", nullable=False)
    entity_type = Column("entityType", String, nullable=True)
    entity_id = Column("entityId", String, nullable=True)
    uploaded_by_id = Column("uploadedById", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class NotificationConfig(Base):
    __tablename__ = "notification_configs"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), unique=True, nullable=False)
    telegram_enabled = Column("telegramEnabled", Boolean, default=False, nullable=False)
    telegram_bot_token = Column("telegramBotToken", String, nullable=True)
    telegram_chat_id = Column("telegramChatId", String, nullable=True)
    email_enabled = Column("emailEnabled", Boolean, default=False, nullable=False)
    email_recipient = Column("emailRecipient", String, nullable=True)
    in_app_enabled = Column("inAppEnabled", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class NotificationRecord(Base):
    __tablename__ = "notification_records"  # FIXED: was 'notifications'

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    user_id = Column("userId", String, nullable=True)
    channel = Column(String, default="IN_APP", nullable=False)
    type = Column(String, default="GENERAL", nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, default="PENDING", nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)
    is_read = Column("isRead", Boolean, default=False, nullable=False)
    sent_at = Column("sentAt", DateTime, nullable=True)
    read_at = Column("readAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    transfer_number = Column("transferNumber", String, nullable=False)
    source_location_id = Column("sourceLocationId", String, nullable=False)  # FIXED: was 'fromLocationId'
    destination_location_id = Column("destinationLocationId", String, nullable=False)  # FIXED: was 'toLocationId'
    status = Column(String, default="DRAFT", nullable=False)
    requested_by_id = Column("requestedById", String, nullable=False)  # FIXED: was missing (NOT NULL)
    approved_by_id = Column("approvedById", String, nullable=True)
    shipped_by_id = Column("shippedById", String, nullable=True)
    received_by_id = Column("receivedById", String, nullable=True)
    shipped_at = Column("shippedAt", DateTime, nullable=True)
    received_at = Column("receivedAt", DateTime, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)  # FIXED: was missing

# ==============================================================================
# 8. HR, PAYROLL, PROJECTS, TIMESHEETS
# ==============================================================================

class Department(Base):
    __tablename__ = "departments"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)  # FIXED: was missing

class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    department_id = Column("departmentId", String, nullable=True)
    first_name = Column("firstName", String, nullable=False)
    last_name = Column("lastName", String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    position = Column(String, nullable=False)  # FIXED: was missing (NOT NULL)
    status = Column(String, default="FULL_TIME", nullable=False)
    base_salary = Column("baseSalary", Numeric(14, 4), default=0.0, nullable=False)
    hire_date = Column("hireDate", DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)  # FIXED: was missing

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    employee_id = Column("employeeId", String, ForeignKey("employees.id"), nullable=False)
    type = Column(String, nullable=False)  # LeaveType enum
    start_date = Column("startDate", DateTime, nullable=False)
    end_date = Column("endDate", DateTime, nullable=False)
    days_count = Column("daysCount", Integer, default=1, nullable=False)
    reason = Column(String, nullable=True)
    status = Column(String, default="PENDING", nullable=False)
    approved_by_id = Column("approvedById", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    period_start = Column("periodStart", DateTime, nullable=False)
    period_end = Column("periodEnd", DateTime, nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="DRAFT", nullable=False)
    total_gross = Column("totalGross", Numeric(14, 4), default=0.0, nullable=False)
    total_net = Column("totalNet", Numeric(14, 4), default=0.0, nullable=False)
    journal_entry_id = Column("journalEntryId", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class PayrollItem(Base):
    __tablename__ = "payroll_items"

    id = Column(String, primary_key=True, default=gen_id)
    payroll_run_id = Column("payrollRunId", String, ForeignKey("payroll_runs.id"), nullable=False)
    employee_id = Column("employeeId", String, ForeignKey("employees.id"), nullable=False)
    base_salary = Column("baseSalary", Numeric(14, 4), nullable=False)
    allowances = Column(Numeric(14, 4), default=0.0, nullable=False)
    deductions = Column(Numeric(14, 4), default=0.0, nullable=False)
    net_pay = Column("netPay", Numeric(14, 4), nullable=False)

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    budget = Column(Numeric(14, 4), default=0.0, nullable=False)
    status = Column(String, default="PLANNING", nullable=False)  # FIXED: was 'ACTIVE'
    start_date = Column("startDate", DateTime, nullable=True)
    end_date = Column("endDate", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)  # FIXED: was missing

class ProjectTask(Base):
    __tablename__ = "project_tasks"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column("projectId", String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="TODO", nullable=False)
    assigned_to_id = Column("assignedToId", String, nullable=True)
    estimated_hours = Column("estimatedHours", Numeric(8, 2), default=0.0, nullable=False)
    actual_hours = Column("actualHours", Numeric(8, 2), default=0.0, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class TimesheetEntry(Base):
    __tablename__ = "timesheet_entries"  # FIXED: was 'timesheets'

    id = Column(String, primary_key=True, default=gen_id)
    task_id = Column("taskId", String, ForeignKey("project_tasks.id"), nullable=False)
    worker_id = Column("workerId", String, nullable=True)
    hours = Column(Numeric(8, 2), nullable=False)
    date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

# ==============================================================================
# 9. PROCUREMENT (models for DB tables that exist)
# ==============================================================================

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    code = Column(String, nullable=True)
    name = Column(String, nullable=False)
    contact_person = Column("contactPerson", String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    tax_id = Column("taxId", String, nullable=True)
    address = Column(String, nullable=True)
    payment_terms = Column("paymentTerms", String, default="NET_30", nullable=False)
    notes = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    location_id = Column("locationId", String, nullable=False)
    supplier_id = Column("supplierId", String, nullable=False)
    po_number = Column("poNumber", String, nullable=False)
    order_date = Column("orderDate", DateTime, default=datetime.datetime.utcnow, nullable=False)
    expected_delivery_date = Column("expectedDeliveryDate", DateTime, nullable=True)
    status = Column(String, default="DRAFT", nullable=False)
    currency = Column(String, default="USD", nullable=False)
    subtotal = Column(Numeric(14, 4), nullable=False)
    tax_total = Column("taxTotal", Numeric(14, 4), nullable=False)
    grand_total = Column("grandTotal", Numeric(14, 4), nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

# ==============================================================================
# 10. WORKFLOW (models for DB tables that exist)
# ==============================================================================

class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    entity_type = Column("entityType", String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    definition_id = Column("definitionId", String, nullable=True)
    entity_type = Column("entityType", String, nullable=False)
    entity_id = Column("entityId", String, nullable=False)
    title = Column(String, nullable=False)
    status = Column(String, default="PENDING", nullable=False)
    submitted_by_id = Column("submittedById", String, nullable=True)
    current_step = Column("currentStep", Integer, default=1, nullable=False)
    total_steps = Column("totalSteps", Integer, default=1, nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

# ==============================================================================
# COMPATIBILITY ALIASES
# ==============================================================================
JournalLine = JournalLineItem
Timesheet = TimesheetEntry
PayrollRecord = PayrollItem
ApprovalRequest = WorkflowInstance
Document = DocumentRecord
Notification = NotificationRecord


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id = Column(String, primary_key=True, default=gen_id)
    instance_id = Column("instanceId", String, ForeignKey("workflow_instances.id"), nullable=False)
    step_order = Column("stepOrder", Integer, nullable=False)
    name = Column(String, nullable=False)
    assigned_role = Column("assignedRole", String, nullable=True)
    assigned_to_id = Column("assignedToId", String, nullable=True)
    status = Column(String, default="PENDING", nullable=False)
    decision_by = Column("decisionBy", String, nullable=True)
    decision_at = Column("decisionAt", DateTime, nullable=True)
    comment = Column(String, nullable=True)

class WorkflowLog(Base):
    __tablename__ = "workflow_logs"

    id = Column(String, primary_key=True, default=gen_id)
    instance_id = Column("instanceId", String, ForeignKey("workflow_instances.id"), nullable=False)
    actor_id = Column("actorId", String, nullable=True)
    action = Column(String, nullable=False)
    comment = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

# ==============================================================================
# 11. WAREHOUSE (models for DB tables that exist)
# ==============================================================================

class WarehouseZone(Base):
    __tablename__ = "warehouse_zones"

    id = Column(String, primary_key=True, default=gen_id)
    location_id = Column("locationId", String, ForeignKey("locations.id"), nullable=False)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, default="STORAGE", nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class WarehouseBin(Base):
    __tablename__ = "warehouse_bins"

    id = Column(String, primary_key=True, default=gen_id)
    zone_id = Column("zoneId", String, ForeignKey("warehouse_zones.id"), nullable=False)
    code = Column(String, nullable=False)
    barcode = Column(String, nullable=True)
    max_weight_kg = Column("maxWeightKg", Numeric(10, 2), nullable=True)
    max_volume_cbm = Column("maxVolumeCbm", Numeric(10, 2), nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class ProductBatch(Base):
    __tablename__ = "product_batches"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    product_variant_id = Column("productVariantId", String, ForeignKey("product_variants.id"), nullable=False)
    batch_number = Column("batchNumber", String, nullable=False)
    lot_number = Column("lotNumber", String, nullable=True)
    manufactured_at = Column("manufacturedAt", DateTime, nullable=True)
    expires_at = Column("expiresAt", DateTime, nullable=False)
    quantity_on_hand = Column("quantityOnHand", Numeric(14, 4), default=0.0, nullable=False)
    cost_price = Column("costPrice", Numeric(14, 4), nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class PurchaseOrderLineItem(Base):
    __tablename__ = "purchase_order_line_items"

    id = Column(String, primary_key=True, default=gen_id)
    purchase_order_id = Column("purchaseOrderId", String, ForeignKey("purchase_orders.id"), nullable=False)
    product_variant_id = Column("productVariantId", String, ForeignKey("product_variants.id"), nullable=False)
    quantity = Column(Numeric(14, 4), nullable=False)
    received_qty = Column("receivedQty", Numeric(14, 4), default=0.0, nullable=False)
    unit_cost = Column("unitCost", Numeric(14, 4), nullable=False)
    tax_rate_pct = Column("taxRatePct", Numeric(14, 4), default=0.0, nullable=False)
    tax_amount = Column("taxAmount", Numeric(14, 4), default=0.0, nullable=False)
    line_total = Column("lineTotal", Numeric(14, 4), nullable=False)

class GoodsReceipt(Base):
    __tablename__ = "goods_receipts"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    location_id = Column("locationId", String, ForeignKey("locations.id"), nullable=False)
    purchase_order_id = Column("purchaseOrderId", String, ForeignKey("purchase_orders.id"), nullable=False)
    supplier_id = Column("supplierId", String, ForeignKey("suppliers.id"), nullable=False)
    grn_number = Column("grnNumber", String, nullable=False)
    received_date = Column("receivedDate", DateTime, default=datetime.datetime.utcnow, nullable=False)
    status = Column(String, default="COMPLETED", nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class GoodsReceiptLineItem(Base):
    __tablename__ = "goods_receipt_line_items"

    id = Column(String, primary_key=True, default=gen_id)
    goods_receipt_id = Column("goodsReceiptId", String, ForeignKey("goods_receipts.id"), nullable=False)
    po_line_item_id = Column("poLineItemId", String, ForeignKey("purchase_order_line_items.id"), nullable=False)
    product_variant_id = Column("productVariantId", String, ForeignKey("product_variants.id"), nullable=False)
    quantity_received = Column("quantityReceived", Numeric(14, 4), nullable=False)
    unit_cost = Column("unitCost", Numeric(14, 4), nullable=False)

class StockTransferLine(Base):
    __tablename__ = "stock_transfer_lines"

    id = Column(String, primary_key=True, default=gen_id)
    stock_transfer_id = Column("stockTransferId", String, ForeignKey("stock_transfers.id"), nullable=False)
    product_variant_id = Column("productVariantId", String, ForeignKey("product_variants.id"), nullable=False)
    requested_qty = Column("requestedQty", Numeric(14, 4), nullable=False)
    sent_qty = Column("sentQty", Numeric(14, 4), default=0.0, nullable=False)
    received_qty = Column("receivedQty", Numeric(14, 4), default=0.0, nullable=False)
    batch_number = Column("batchNumber", String, nullable=True)
    source_bin_id = Column("sourceBinId", String, nullable=True)
    dest_bin_id = Column("destBinId", String, nullable=True)

class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id = Column(String, primary_key=True, default=gen_id)
    subscription_id = Column("subscriptionId", String, ForeignKey("webhook_subscriptions.id"), nullable=False)
    event = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    status_code = Column("statusCode", Integer, nullable=True)
    response_body = Column("responseBody", Text, nullable=True)
    success = Column(Boolean, default=False, nullable=False)
    attempts = Column(Integer, default=1, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

