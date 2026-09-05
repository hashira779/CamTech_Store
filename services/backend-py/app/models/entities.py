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
from app.core.db_enums import pg_enum

def gen_id():
    return str(uuid.uuid4())

# ==============================================================================
# 1. CORE TENANT & USER
# ==============================================================================
from app.modules.organizations.models import Organization
from app.modules.identity.models import User
from app.modules.locations.models import Location

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

from app.modules.catalog.models import Category, Brand, Product, ProductVariant

from app.modules.inventory.models import InventoryItem, StockMovement

# ==============================================================================
# 3. CRM & SALES
# ==============================================================================

from app.modules.customers.models import Customer, CustomerAddress

from app.modules.sales.models import Sale, SaleLineItem, SalePayment
from app.modules.delivery.models import DeliveryDriver, DeliveryOrder



# ==============================================================================
# 4. FINANCE & ACCOUNTING
# ==============================================================================

from app.modules.finance.models import Account, AccountingPeriod, JournalEntry, JournalLineItem, FixedAsset, DepreciationRecord

# ==============================================================================
# 5. WORKFORCE, TICKETS, APPROVALS
# ==============================================================================

from app.modules.service_desk.models import ServiceTicket, TicketComment

# ==============================================================================
# 6. INTEGRATIONS & FLOW AUTOMATIONS
# ==============================================================================

from app.modules.automations.models import DeveloperApp, ApiKey, WebhookSubscription, TelegramChatBinding, AutomationFlow, FlowExecution

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
    customer_type = Column("customerType", pg_enum("CustomerType"), nullable=True)
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
    type = Column(pg_enum("PromotionType"), default="PERCENTAGE", nullable=False)
    scope = Column(pg_enum("PromotionScope"), default="ORDER", nullable=False)
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
    type = Column(pg_enum("LoyaltyTxType"), nullable=False)
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
    type = Column(pg_enum("StoreCreditTxType"), nullable=False)
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
    channel = Column(pg_enum("NotificationChannel"), default="IN_APP", nullable=False)
    type = Column(String, default="GENERAL", nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(pg_enum("NotificationStatus"), default="PENDING", nullable=False)
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
    status = Column(pg_enum("StockTransferStatus"), default="DRAFT", nullable=False)
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
    status = Column(pg_enum("EmploymentStatus"), default="FULL_TIME", nullable=False)
    base_salary = Column("baseSalary", Numeric(14, 4), default=0.0, nullable=False)
    hire_date = Column("hireDate", DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)  # FIXED: was missing

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    employee_id = Column("employeeId", String, ForeignKey("employees.id"), nullable=False)
    type = Column(pg_enum("LeaveType"), nullable=False)
    start_date = Column("startDate", DateTime, nullable=False)
    end_date = Column("endDate", DateTime, nullable=False)
    days_count = Column("daysCount", Integer, default=1, nullable=False)
    reason = Column(String, nullable=True)
    status = Column(pg_enum("LeaveStatus"), default="PENDING", nullable=False)
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
    status = Column(pg_enum("PayrollStatus"), default="DRAFT", nullable=False)
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
    status = Column(pg_enum("ProjectStatus"), default="PLANNING", nullable=False)  # FIXED: was 'ACTIVE'
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
    status = Column(pg_enum("TaskStatus"), default="TODO", nullable=False)
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
    payment_terms = Column("paymentTerms", pg_enum("PaymentTerm"), default="NET_30", nullable=False)
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
    status = Column(pg_enum("PurchaseOrderStatus"), default="DRAFT", nullable=False)
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
    entity_type = Column("entityType", pg_enum("WorkflowEntityType"), nullable=False)
    description = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    definition_id = Column("definitionId", String, nullable=True)
    entity_type = Column("entityType", pg_enum("WorkflowEntityType"), nullable=False)
    entity_id = Column("entityId", String, nullable=False)
    title = Column(String, nullable=False)
    status = Column(pg_enum("WorkflowStatus"), default="PENDING", nullable=False)
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
    status = Column(pg_enum("WorkflowStepStatus"), default="PENDING", nullable=False)
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
    type = Column(pg_enum("WarehouseZoneType"), default="STORAGE", nullable=False)
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
    status = Column(pg_enum("GoodsReceiptStatus"), default="COMPLETED", nullable=False)
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

from app.modules.automations.models import TelegramBot, TelegramChatBinding
