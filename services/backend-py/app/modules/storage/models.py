from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.datetime_utils import utc_now
from app.core.db_enums import pg_enum
from app.models.entities import gen_id

class StorageProvider(Base):
    __tablename__ = "storage_providers"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(pg_enum("StorageProviderType"), nullable=False)
    status = Column(pg_enum("StorageProviderStatus"), default="CONNECTED", nullable=False)
    is_default = Column("isDefault", Boolean, default=False, nullable=False)
    configuration = Column(JSON, nullable=True) # e.g. bucket name, prefix, etc.
    credentials_reference = Column("credentialsReference", String, nullable=True) # Optional reference to a secret or encrypted JSON string
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

class StorageObject(Base):
    __tablename__ = "storage_objects"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    provider_id = Column("providerId", String, ForeignKey("storage_providers.id"), nullable=False)
    object_key = Column("objectKey", String, nullable=False) # e.g. path in s3, or logical path
    file_name = Column("fileName", String, nullable=False)
    mime_type = Column("mimeType", String, nullable=False)
    size_bytes = Column("sizeBytes", Integer, nullable=False)
    checksum = Column(String, nullable=True)
    provider_object_id = Column("providerObjectId", String, nullable=True) # e.g. Google Drive file ID
    storage_path = Column("storagePath", String, nullable=True)
    storage_url = Column("storageUrl", String, nullable=True) # Public URL if applicable
    status = Column(pg_enum("StorageObjectStatus"), default="AVAILABLE", nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

class StorageAttachment(Base):
    __tablename__ = "storage_attachments"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    storage_object_id = Column("storageObjectId", String, ForeignKey("storage_objects.id"), nullable=False)
    entity_type = Column("entityType", String, nullable=False) # PRODUCT, PURCHASE_ORDER, etc.
    entity_id = Column("entityId", String, nullable=False)
    field_name = Column("fieldName", String, nullable=True) # e.g. 'avatar', 'gallery'
    is_primary = Column("isPrimary", Boolean, default=False, nullable=False)
    sort_order = Column("sortOrder", Integer, default=0, nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)

class StoragePolicy(Base):
    __tablename__ = "storage_policies"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    entity_type = Column("entityType", String, nullable=False)
    provider_id = Column("providerId", String, ForeignKey("storage_providers.id"), nullable=True) # Override default
    max_size_bytes = Column("maxSizeBytes", Integer, nullable=True)
    allowed_mime_types = Column("allowedMimeTypes", JSON, nullable=True) # e.g. ["image/jpeg", "image/png"]
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)
