import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Numeric,
    DateTime,
    ForeignKey,
)
from app.core.database import Base

def gen_id():
    return str(uuid.uuid4())

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    product_variant_id = Column("productVariantId", String, ForeignKey("product_variants.id"), nullable=False)
    location_id = Column("locationId", String, ForeignKey("locations.id"), nullable=False)
    stock_on_hand = Column("stockOnHand", Numeric(14, 4), default=0.0, nullable=False)
    reserved_qty = Column("reservedQty", Numeric(14, 4), default=0.0, nullable=False)
    minimum_stock = Column("minimumStock", Numeric(14, 4), default=0.0, nullable=False)
    maximum_stock = Column("maximumStock", Numeric(14, 4), nullable=True)
    reorder_point = Column("reorderPoint", Numeric(14, 4), nullable=True)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    inventory_item_id = Column("inventoryItemId", String, ForeignKey("inventory_items.id"), nullable=False)
    type = Column(String, nullable=False)  # StockMovementType enum
    quantity = Column(Numeric(14, 4), nullable=False)
    balance_after = Column("balanceAfter", Numeric(14, 4), nullable=False)
    reference_type = Column("referenceType", String, nullable=True)
    reference_id = Column("referenceId", String, nullable=True)
    notes = Column(String, nullable=True)
    user_id = Column("userId", String, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
