import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Numeric,
    DateTime,
    ForeignKey,
    Integer
)
from app.core.database import Base
from app.core.db_enums import pg_enum

def gen_id():
    return str(uuid.uuid4())

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    code = Column(String, nullable=True)  # Prisma: optional
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    tax_id = Column("taxId", String, nullable=True)
    type = Column(pg_enum("CustomerType"), default="INDIVIDUAL", nullable=False)
    price_list_id = Column("priceListId", String, nullable=True)
    loyalty_points = Column("loyaltyPoints", Integer, default=0, nullable=False)
    loyalty_tier = Column("loyaltyTier", String, default="BRONZE", nullable=False)
    store_credit = Column("storeCredit", Numeric(14, 4), default=0.0, nullable=False)
    notes = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

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
