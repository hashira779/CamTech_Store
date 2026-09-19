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

class StorageObjectDto(BaseModel):
    id: str
    fileName: str
    mimeType: str
    sizeBytes: int
    storageUrl: Optional[str]
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
