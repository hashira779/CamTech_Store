import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Numeric,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def gen_id():
    return str(uuid.uuid4())

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

    line_items = relationship("SaleLineItem", back_populates="sale", cascade="all, delete-orphan")
    payments = relationship("SalePayment", back_populates="sale", cascade="all, delete-orphan")

class SaleLineItem(Base):
    __tablename__ = "sale_line_items"

    id = Column(String, primary_key=True, default=gen_id)
    sale_id = Column("saleId", String, ForeignKey("sales.id"), nullable=False)
    product_variant_id = Column("productVariantId", String, nullable=False)
    sku = Column(String, nullable=False)
    product_name = Column("productName", String, nullable=False)
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

    sale = relationship("Sale", back_populates="payments")
