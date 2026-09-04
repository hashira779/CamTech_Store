import secrets
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import DocumentRecord
from .schemas import DocumentRecordDto, UploadIntentInput, UploadIntentResponse

router = APIRouter(tags=["Documents & Storage"])

@router.get("/storage", response_model=List[DocumentRecordDto])
async def list_documents(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DocumentRecord).where(DocumentRecord.organization_id == user.organization_id)
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "fileName": d.filename,
            "mimeType": d.mime_type,
            "sizeBytes": d.byte_size,
            "storagePath": f"{d.bucket}/{d.key}" if d.bucket else d.key,
            "createdAt": d.created_at.isoformat() if d.created_at else ""
        } for d in docs
    ]

@router.post("/storage/upload-intent", response_model=UploadIntentResponse)
async def create_upload_intent(
    data: UploadIntentInput,
    user: TenantUser = Depends(get_current_user)
):
    filename = data.fileName or "upload.pdf"
    token = secrets.token_hex(16)
    return {
        "uploadUrl": f"/api/v1/storage/upload/{token}",
        "fileKey": f"tenant/{user.organization_id}/{token}_{filename}",
        "expiresIn": 3600
    }
