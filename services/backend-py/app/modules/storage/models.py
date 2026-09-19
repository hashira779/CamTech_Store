from typing import Optional, Dict, Any
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

import uuid

from app.core.database import Base
from app.core.datetime_utils import utc_now
from app.core.db_enums import pg_enum

def gen_id():
    return str(uuid.uuid4())

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

    def _get_meta(self) -> Dict[str, Any]:
        meta = self.metadata_
        if not meta:
            return {}
        if isinstance(meta, str):
            try:
                import json
                return json.loads(meta)
            except Exception:
                return {}
        if isinstance(meta, dict):
            return meta
        return {}

    @property
    def thumbnail_url(self) -> Optional[str]:
        meta = self._get_meta()
        return meta.get("thumbnail_url") or meta.get("thumbnailUrl") or self.storage_url

    @property
    def medium_url(self) -> Optional[str]:
        meta = self._get_meta()
        return meta.get("medium_url") or meta.get("mediumUrl") or self.storage_url

    @property
    def large_url(self) -> Optional[str]:
        meta = self._get_meta()
        return meta.get("large_url") or meta.get("largeUrl") or self.storage_url

    @property
    def sync_status(self) -> str:
        meta = self._get_meta()
        return meta.get("sync_status") or meta.get("syncStatus") or ("SYNCED" if self.status == "AVAILABLE" else "PENDING")

    @property
    def sync_error(self) -> Optional[str]:
        return self._get_meta().get("sync_error")

    @property
    def width(self) -> Optional[int]:
        return self._get_meta().get("width")

    @property
    def height(self) -> Optional[int]:
        return self._get_meta().get("height")

    @property
    def version(self) -> int:
        return self._get_meta().get("version", 1)

    def update_sync_state(
        self,
        status: str,
        thumbnail_url: Optional[str] = None,
        medium_url: Optional[str] = None,
        large_url: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        sync_error: Optional[str] = None,
        google_drive_modified_time: Optional[str] = None,
    ):
        meta = dict(self._get_meta())
        meta["sync_status"] = status
        meta["syncStatus"] = status
        if thumbnail_url:
            meta["thumbnail_url"] = thumbnail_url
            meta["thumbnailUrl"] = thumbnail_url
        if medium_url:
            meta["medium_url"] = medium_url
            meta["mediumUrl"] = medium_url
        if large_url:
            meta["large_url"] = large_url
            meta["largeUrl"] = large_url
        if width is not None:
            meta["width"] = width
        if height is not None:
            meta["height"] = height
        if sync_error is not None:
            meta["sync_error"] = sync_error
        if google_drive_modified_time:
            meta["google_drive_modified_time"] = google_drive_modified_time
        meta["version"] = meta.get("version", 1) + (1 if status == "SYNCED" else 0)
        self.metadata_ = meta

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
