import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.modules.storage.models import StorageProvider, StorageObject, StorageAttachment, StoragePolicy
from app.modules.storage.services import get_active_provider, get_provider_adapter_for_provider
from .schemas import (
    UploadIntentInput, UploadIntentResponse, 
    StorageStatsDto, StorageProviderDto, StorageProviderCreateInput,
    StorageObjectDto, ConfirmUploadInput,
    StoragePolicyDto, StoragePolicyCreateInput
)

router = APIRouter(tags=["Enterprise Storage"])

# --- PROVIDERS ---

@router.get("/storage/providers", response_model=List[StorageProviderDto])
async def list_providers(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StorageProvider).where(StorageProvider.organization_id == user.organization_id)
    )
    providers = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "type": p.type,
            "status": p.status,
            "isDefault": p.is_default,
            "createdAt": p.created_at.isoformat() if p.created_at else ""
        } for p in providers
    ]

@router.post("/storage/providers", response_model=StorageProviderDto)
async def create_provider(
    data: StorageProviderCreateInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    provider = StorageProvider(
        id=str(uuid.uuid4()),
        organization_id=user.organization_id,
        name=data.name,
        type=data.type,
        is_default=data.isDefault,
        configuration=data.configuration,
        credentials_reference=data.credentialsReference
    )
    
    # If this is default, unset others
    if data.isDefault:
        await db.execute(
            text("UPDATE storage_providers SET \"isDefault\" = false WHERE \"organizationId\" = :org_id"),
            {"org_id": user.organization_id}
        )
        
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    
    return {
        "id": provider.id,
        "name": provider.name,
        "type": provider.type,
        "status": provider.status,
        "isDefault": provider.is_default,
        "createdAt": provider.created_at.isoformat() if provider.created_at else ""
    }

@router.delete("/storage/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    import traceback
    try:
        result = await db.execute(
            select(StorageProvider).where(
                StorageProvider.organization_id == user.organization_id,
                StorageProvider.id == provider_id
            )
        )
        provider = result.scalars().first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
            
        # 1. Delete attachments linked to objects from this provider
        await db.execute(
            text("DELETE FROM storage_attachments WHERE \"storageObjectId\" IN (SELECT id FROM storage_objects WHERE \"providerId\" = :pid)"),
            {"pid": provider_id}
        )
        
        # 2. Delete objects
        await db.execute(
            text("DELETE FROM storage_objects WHERE \"providerId\" = :pid"),
            {"pid": provider_id}
        )
        
        # 3. Delete policies
        await db.execute(
            text("DELETE FROM storage_policies WHERE \"providerId\" = :pid"),
            {"pid": provider_id}
        )
        
        # 4. Delete provider
        await db.delete(provider)
        await db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to delete provider: {str(e)}\n{traceback.format_exc()}")

# --- POLICIES ---

@router.get("/storage/policies", response_model=List[StoragePolicyDto])
async def list_policies(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StoragePolicy).where(StoragePolicy.organization_id == user.organization_id)
    )
    policies = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "entityType": p.entity_type,
            "providerId": p.provider_id,
            "isActive": p.is_active,
            "createdAt": p.created_at.isoformat() if p.created_at else ""
        } for p in policies
    ]

@router.post("/storage/policies", response_model=StoragePolicyDto)
async def create_policy(
    data: StoragePolicyCreateInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify provider belongs to tenant
    result = await db.execute(
        select(StorageProvider).where(
            StorageProvider.id == data.providerId,
            StorageProvider.organization_id == user.organization_id
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Storage provider not found")
        
    policy = StoragePolicy(
        id=str(uuid.uuid4()),
        organization_id=user.organization_id,
        name=data.name,
        entity_type=data.entityType,
        provider_id=data.providerId,
        is_active=True
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    
    return {
        "id": policy.id,
        "name": policy.name,
        "entityType": policy.entity_type,
        "providerId": policy.provider_id,
        "isActive": policy.is_active,
        "createdAt": policy.created_at.isoformat() if policy.created_at else ""
    }

@router.delete("/storage/policies/{policy_id}")
async def delete_policy(
    policy_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StoragePolicy).where(
            StoragePolicy.id == policy_id,
            StoragePolicy.organization_id == user.organization_id
        )
    )
    policy = result.scalars().first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
        
    await db.delete(policy)
    await db.commit()
    return {"success": True}

# --- OBJECTS & UPLOAD PIPELINE ---

@router.get("/storage", response_model=List[StorageObjectDto])
async def list_objects(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StorageObject, StorageAttachment).outerjoin(
            StorageAttachment,
            (StorageObject.id == StorageAttachment.storage_object_id) & (StorageAttachment.is_primary == True)
        ).where(
            StorageObject.organization_id == user.organization_id,
            StorageObject.status != "DELETED"
        ).order_by(StorageObject.created_at.desc())
    )
    docs = result.all()
    return [
        {
            "id": d.StorageObject.id,
            "fileName": d.StorageObject.file_name,
            "mimeType": d.StorageObject.mime_type,
            "sizeBytes": d.StorageObject.size_bytes,
            "storageUrl": d.StorageObject.storage_url,
            "status": d.StorageObject.status,
            "createdAt": d.StorageObject.created_at.isoformat() if d.StorageObject.created_at else "",
            "providerId": d.StorageObject.provider_id,
            "entityType": d.StorageAttachment.entity_type if d.StorageAttachment else None,
            "entityId": d.StorageAttachment.entity_id if d.StorageAttachment else None
        } for d in docs
    ]

@router.get("/storage/stats", response_model=StorageStatsDto)
async def get_storage_stats(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(
            func.count(StorageObject.id),
            func.coalesce(func.sum(StorageObject.size_bytes), 0)
        ).where(
            StorageObject.organization_id == user.organization_id,
            StorageObject.status != "DELETED"
        )
    )
    row = result.one()
    total_files = row[0] or 0
    total_bytes = int(row[1] or 0)
    
    prov = await get_active_provider(db, user.organization_id)
    active_driver = prov.type if prov else "NONE"
    
    return {
        "totalFiles": total_files,
        "totalBytes": total_bytes,
        "activeStorageDriver": active_driver
    }

@router.post("/storage/upload-intent", response_model=UploadIntentResponse)
async def create_upload_intent(
    data: UploadIntentInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    import traceback
    try:
        provider = await get_active_provider(db, user.organization_id, data.providerId, data.entityType)
        if not provider:
            raise HTTPException(status_code=400, detail="No active storage provider configured.")
            
        adapter = await get_provider_adapter_for_provider(provider)
        
        # Generate unique key
        object_id = str(uuid.uuid4())
        object_key = f"tenant/{user.organization_id}/{object_id}_{data.fileName}"
        
        upload_url = await adapter.get_upload_url(object_key, data.mimeType)
        
        # Store pending object
        obj = StorageObject(
            id=object_id,
            organization_id=user.organization_id,
            provider_id=provider.id,
            object_key=object_key,
            file_name=data.fileName,
            mime_type=data.mimeType,
            size_bytes=data.byteSize,
            status="PENDING",
            storage_path=object_key
        )
        db.add(obj)
        # Flush obj to DB first so its PK exists before the FK reference in attachment
        await db.flush()
        
        # Add attachment if requested
        if data.entityType and data.entityId:
            attachment = StorageAttachment(
                id=str(uuid.uuid4()),
                organization_id=user.organization_id,
                storage_object_id=obj.id,
                entity_type=data.entityType,
                entity_id=data.entityId,
                is_primary=True
            )
            db.add(attachment)
        
        # Store the resumable URL in metadata so the proxy endpoint can use it
        obj.metadata_ = {"resumable_url": upload_url}
            
        await db.commit()
        
        # Return a proxy URL that routes through our backend (avoids browser CORS)
        proxy_url = f"/api/v1/storage/{object_id}/upload"
        return {
            "uploadUrl": proxy_url,
            "method": "PUT",
            "headers": {"Content-Type": data.mimeType},
            "objectId": object_id,
            "expiresIn": 3600
        }
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=400, detail=error_msg)


@router.put("/storage/{object_id}/upload")
async def proxy_upload(
    object_id: str,
    request: Request,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Proxy endpoint: browser uploads file here, we forward to the actual storage provider.
    This avoids CORS issues with direct-to-provider uploads (e.g. Google Drive).
    """
    import httpx, traceback as tb
    result = await db.execute(
        select(StorageObject).where(
            StorageObject.id == object_id,
            StorageObject.organization_id == user.organization_id
        )
    )
    obj = result.scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Storage object not found")
    
    metadata = obj.metadata_ or {}
    resumable_url = metadata.get("resumable_url")
    if not resumable_url:
        raise HTTPException(status_code=400, detail="No resumable upload URL stored for this object")
    
    try:
        body = await request.body()
        content_type = request.headers.get("content-type", obj.mime_type)
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.put(
                resumable_url,
                content=body,
                headers={"Content-Type": content_type}
            )
        
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail=f"Storage provider rejected upload: {resp.text}")
        
        # Mark object as available
        obj.status = "AVAILABLE"
        obj.storage_url = f"/api/v1/storage/{obj.id}/download"
        await db.commit()
        
        return {"success": True, "objectId": object_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy upload failed: {str(e)}\n{tb.format_exc()}") 

@router.post("/storage/confirm-upload")
async def confirm_upload(
    data: ConfirmUploadInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StorageObject).where(
            StorageObject.id == data.objectId,
            StorageObject.organization_id == user.organization_id
        )
    )
    obj = result.scalars().first()
    
    if not obj:
        raise HTTPException(status_code=404, detail="Storage object not found.")
        
    # Mark as available
    obj.status = "AVAILABLE"
    obj.storage_url = f"/api/v1/storage/{obj.id}/download"
    await db.commit()
    
    return {"success": True, "objectId": obj.id}

from app.core.dependencies import get_streaming_user
from typing import Optional
import json
from app.models.entities import AuditLog
from app.modules.storage.image_processing import process_and_cache_image

@router.get("/storage/{object_id}/download")
async def download_object(
    object_id: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    user: TenantUser = Depends(get_streaming_user),
    db: AsyncSession = Depends(get_db)
):
    import traceback
    result = await db.execute(
        select(StorageObject).where(
            StorageObject.id == object_id,
            StorageObject.organization_id == user.organization_id
        )
    )
    obj = result.scalars().first()
    
    if not obj or obj.status != "AVAILABLE":
        raise HTTPException(status_code=404, detail="Storage object not found or not available.")
        
    # Log access for audit
    try:
        audit = AuditLog(
            organization_id=user.organization_id,
            actor_id=user.id,
            action="FILE_DOWNLOAD",
            resource_type="STORAGE_OBJECT",
            resource_id=obj.id,
            metadata_=json.dumps({"width": width, "height": height}),
            result="SUCCESS"
        )
        db.add(audit)
        await db.commit()
    except Exception:
        await db.rollback()

    result = await db.execute(
        select(StorageProvider).where(StorageProvider.id == obj.provider_id)
    )
    provider = result.scalars().first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Storage provider no longer exists. The file cannot be downloaded.")
    
    try:
        adapter = await get_provider_adapter_for_provider(provider)
        
        # Try streaming first (e.g. Google Drive private files)
        stream_generator, mime_type = await adapter.stream_object(obj.object_key)
        if stream_generator:
            # If it's an image, or we have width/height, process and cache it
            if obj.mime_type.startswith('image/') or (width and height):
                from fastapi.responses import FileResponse
                cached_path = await process_and_cache_image(
                    obj.object_key, 
                    stream_generator, 
                    width, 
                    height
                )
                if cached_path:
                    return FileResponse(cached_path, media_type=mime_type or obj.mime_type)
            
            # Fallback if not cached or not image: just stream it to client
            from fastapi.responses import StreamingResponse
            return StreamingResponse(stream_generator, media_type=mime_type or obj.mime_type)
            
        # Fallback to direct redirect (e.g. S3 presigned URLs)
        download_url = await adapter.get_download_url(obj.object_key)
        
        from fastapi.responses import RedirectResponse
        if download_url.startswith("http"):
            return RedirectResponse(download_url)
        return RedirectResponse(f"/{download_url}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}\n{traceback.format_exc()}")

