from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class StorageProviderDto(BaseModel):
    id: str
    name: str
    type: str
    status: str
    isDefault: bool
    createdAt: str

class StorageProviderCreateInput(BaseModel):
    name: str
    type: str
    isDefault: bool = False
    configuration: Dict[str, Any] = {}
    credentialsReference: Optional[str] = None # Or base64 encoded credential JSON for GDrive

class StoragePolicyDto(BaseModel):
    id: str
    name: str
    entityType: str
    providerId: Optional[str]
    isActive: bool
    createdAt: str

class StoragePolicyCreateInput(BaseModel):
    name: str
    entityType: str
    providerId: str

class StorageObjectDto(BaseModel):
    id: str
    fileName: str
    mimeType: str
    sizeBytes: int
    storageUrl: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    mediumUrl: Optional[str] = None
    largeUrl: Optional[str] = None
    syncStatus: Optional[str] = "SYNCED"
    width: Optional[int] = None
    height: Optional[int] = None
    status: str
    createdAt: str
    providerId: str
    entityType: Optional[str] = None
    entityId: Optional[str] = None

class UploadIntentInput(BaseModel):
    fileName: str
    mimeType: str
    byteSize: int
    entityType: Optional[str] = None
    entityId: Optional[str] = None
    providerId: Optional[str] = None

class UploadIntentResponse(BaseModel):
    uploadUrl: str
    method: str = "PUT"
    headers: Dict[str, str] = {}
    objectId: str # Replaces fileKey, maps to StorageObject.id
    expiresIn: int

class ConfirmUploadInput(BaseModel):
    objectId: str

class StorageStatsDto(BaseModel):
    totalFiles: int
    totalBytes: int
    activeStorageDriver: str

class ImageSyncHealthDto(BaseModel):
    total: int
    synced: int
    pending: int
    syncing: int
    failed: int
    r2Bucket: Optional[str] = None
    r2PublicDomain: Optional[str] = None

class BatchSyncInput(BaseModel):
    batchSize: int = 50
    force: bool = False
    retryFailed: bool = True
    entityType: Optional[str] = None
