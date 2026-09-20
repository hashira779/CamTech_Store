import datetime
import re
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Numeric,
    DateTime,
    ForeignKey,
    Integer,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.datetime_utils import utc_now
from app.core.db_enums import pg_enum
from app.modules.storage.models import StorageObject

def gen_id():
    return str(uuid.uuid4())


def slugify(text: str) -> str:
    """Generate a URL-friendly slug from text."""
    s = text.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s.strip('-')[:120]


class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    parent_id = Column("parentId", String, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    slug = Column(String(120), nullable=True)
    icon = Column(String(64), nullable=True)
    image_url = Column("imageUrl", String(500), nullable=True)
    level = Column(Integer, default=0, server_default="0", nullable=False)
    sort_order = Column("sortOrder", Integer, default=0, server_default="0", nullable=False)
    is_active = Column("isActive", Boolean, default=True, server_default="true", nullable=False)
    seo_title = Column("seoTitle", String(200), nullable=True)
    seo_description = Column("seoDescription", Text, nullable=True)
    product_count = Column("productCount", Integer, default=0, server_default="0", nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Self-referential relationship for tree queries
    children = relationship("Category", back_populates="parent_rel",
                            foreign_keys=[parent_id], lazy="select")
    parent_rel = relationship("Category", back_populates="children",
                              foreign_keys=[parent_id], remote_side="Category.id",
                              lazy="select", uselist=False)
    products = relationship("Product", back_populates="category", lazy="select")

class Brand(Base):
    __tablename__ = "brands"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    category_id = Column("categoryId", String, ForeignKey("categories.id"), nullable=True)
    brand_id = Column("brandId", String, ForeignKey("brands.id"), nullable=True)
    type = Column(pg_enum("ProductType"), default="PHYSICAL", nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    category = relationship("Category", foreign_keys=[category_id], back_populates="products")

class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(String, primary_key=True, default=gen_id)
    product_id = Column("productId", String, ForeignKey("products.id"), nullable=False)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    sku = Column(String, nullable=False)
    name = Column(String, nullable=True)  # Prisma: optional
    barcode = Column(String, nullable=True)
    unit = Column(String, default="piece", server_default="piece", nullable=False)
    currency = Column(String, default="USD", server_default="USD", nullable=False)
    cost_price = Column("costPrice", Numeric(14, 4), default=0.0, server_default="0.0", nullable=False)
    sell_price = Column("sellPrice", Numeric(14, 4), default=0.0, server_default="0.0", nullable=False)
    tax_rate_pct = Column("taxRatePct", Numeric(14, 4), default=0.0, server_default="0.0", nullable=False)
    tax_rate_id = Column("taxRateId", String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, server_default="true", nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    product = relationship("Product", back_populates="variants")

class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(String, primary_key=True, default=gen_id)
    product_id = Column("productId", String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    storage_object_id = Column("storageObjectId", String, ForeignKey("storage_objects.id", ondelete="RESTRICT"), nullable=False)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    is_primary = Column("isPrimary", Boolean, default=False, nullable=False)
    sort_order = Column("sortOrder", Integer, default=0, nullable=False)
    alt_text = Column("altText", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    product = relationship("Product", back_populates="images")
    storage_object = relationship("StorageObject", foreign_keys=[storage_object_id], uselist=False, viewonly=True)
