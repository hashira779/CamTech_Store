from pydantic import BaseModel
from typing import Optional

class DocumentRecordDto(BaseModel):
    id: str
    fileName: str
    mimeType: str
    sizeBytes: int
    storagePath: str
    createdAt: str

class UploadIntentInput(BaseModel):
    fileName: str = "upload.pdf"

class UploadIntentResponse(BaseModel):
    uploadUrl: str
    fileKey: str
    expiresIn: int
