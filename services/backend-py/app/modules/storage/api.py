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
        
        # Save provider object ID if returned (e.g. Google Drive returns file JSON)
        try:
            drive_data = resp.json()
            drive_file_id = drive_data.get("id")
            if drive_file_id:
                obj.provider_object_id = drive_file_id
                meta = obj.metadata_ or {}
                meta["drive_file_id"] = drive_file_id
                obj.metadata_ = meta
        except Exception:
            pass

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

from app.core.dependencies import get_optional_streaming_user
from typing import Optional
import json
from app.models.entities import AuditLog
from app.modules.storage.image_processing import process_and_cache_image, get_cached_file

PLACEHOLDER_PRODUCT_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" fill="none">
  <rect width="200" height="200" rx="16" fill="#090d16"/>
  <rect x="1" y="1" width="198" height="198" rx="15" stroke="#1e293b" stroke-width="1.5"/>
  <path d="M100 48L148 76V132L100 160L52 132V76L100 48Z" stroke="#6366f1" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M100 48V104M100 104L148 132M100 104L52 132" stroke="#818cf8" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="100" cy="104" r="3" fill="#a5b4fc"/>
</svg>"""

def get_placeholder_image_response():
    from fastapi.responses import Response
    return Response(
        content=PLACEHOLDER_PRODUCT_SVG,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "public, max-age=300",
            "Content-Type": "image/svg+xml",
        }
    )

@router.get("/storage/{object_id}/download")
@router.get("/storage/{object_id}/view")
@router.get("/storage/{object_id}")
async def download_object(
    object_id: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    thumb: Optional[int] = None,
    user: Optional[TenantUser] = Depends(get_optional_streaming_user),
    db: AsyncSession = Depends(get_db)
):
    import traceback

    # ?thumb=1 is a shortcut for 80x80 thumbnail (used by table views)
    if thumb:
        width = width or 80
        height = height or 80

    is_image_request = bool(thumb or width or height)

    stmt = select(StorageObject).where(StorageObject.id == object_id)
    if user:
        stmt = stmt.where(StorageObject.organization_id == user.organization_id)
    result = await db.execute(stmt)
    obj = result.scalars().first()
    
    if not obj or obj.status != "AVAILABLE":
        if is_image_request:
            return get_placeholder_image_response()
        raise HTTPException(status_code=404, detail="Storage object not found or not available.")

    # If the image is already synced to Cloudflare R2 / CDN, redirect directly to avoid proxying binaries
    if obj.sync_status == "SYNCED":
        target_cdn_url = obj.thumbnail_url if (thumb or (width and width <= 200)) else (obj.medium_url or obj.storage_url)
        if target_cdn_url and target_cdn_url.startswith("http"):
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=target_cdn_url, status_code=307)

    # Determine cache duration: images get 7-day browser cache
    is_image = obj.mime_type.startswith('image/') if obj.mime_type else False
    if is_image:
        is_image_request = True
    cache_header = "public, max-age=604800, stale-while-revalidate=604800" if is_image else "public, max-age=86400"

    # Check local cache first for instant response
    if is_image or (width and height):
        cached_path = await get_cached_file(obj.object_key, width, height)
        if cached_path:
            from fastapi.responses import FileResponse
            return FileResponse(
                cached_path,
                media_type=obj.mime_type,
                headers={
                    "Cache-Control": cache_header,
                    "Content-Disposition": f'inline; filename="{obj.file_name}"'
                }
            )

    result = await db.execute(
        select(StorageProvider).where(StorageProvider.id == obj.provider_id)
    )
    provider = result.scalars().first()
    
    if not provider:
        if is_image_request:
            return get_placeholder_image_response()
        raise HTTPException(status_code=404, detail="Storage provider no longer exists. The file cannot be downloaded.")
    
    try:
        adapter = await get_provider_adapter_for_provider(provider)
        
        # Try streaming first (e.g. Google Drive private files)
        stream_generator = None
        mime_type = obj.mime_type
        try:
            stream_generator, mime_type = await adapter.stream_object(obj.object_key, file_id=obj.provider_object_id)
        except TypeError:
            stream_generator, mime_type = await adapter.stream_object(obj.object_key)

        if stream_generator:
            if not obj.provider_object_id and getattr(adapter, 'last_resolved_file_id', None):
                obj.provider_object_id = adapter.last_resolved_file_id
                await db.commit()

            # If it's an image, or we have width/height, process and cache it
            if is_image or (width and height):
                from fastapi.responses import FileResponse
                cached_path = await process_and_cache_image(
                    obj.object_key, 
                    stream_generator, 
                    width, 
                    height
                )
                if cached_path:
                    return FileResponse(
                        cached_path,
                        media_type=mime_type or obj.mime_type,
                        headers={
                            "Cache-Control": cache_header,
                            "Content-Disposition": f'inline; filename="{obj.file_name}"'
                        }
                    )
            
            # Fallback if not cached or not image: just stream it to client
            from fastapi.responses import StreamingResponse
            return StreamingResponse(
                stream_generator,
                media_type=mime_type or obj.mime_type,
                headers={
                    "Cache-Control": cache_header,
                    "Content-Disposition": f'inline; filename="{obj.file_name}"'
                }
            )
            
        # Fallback to direct redirect (e.g. S3 presigned URLs)
        download_url = await adapter.get_download_url(obj.object_key)
        
        from fastapi.responses import RedirectResponse
        if download_url.startswith("http"):
            return RedirectResponse(download_url)
        return RedirectResponse(f"/{download_url}")
    except HTTPException as he:
        if he.status_code == 404 and is_image_request:
            return get_placeholder_image_response()
        raise
    except Exception as e:
        if is_image_request:
            return get_placeholder_image_response()
        raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}\n{traceback.format_exc()}")

# ==============================================================================
# IMAGE SYNC & CDN HEALTH MONITORING
# ==============================================================================

@router.get("/storage/sync/health")
async def get_image_sync_health(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns real-time synchronization metrics between Google Drive and Cloudflare R2."""
    from app.core.config import settings
    res = await db.execute(select(StorageObject))
    objects = res.scalars().all()

    total = len(objects)
    synced = sum(1 for o in objects if o.sync_status == "SYNCED")
    failed = sum(1 for o in objects if o.sync_status == "FAILED")
    syncing = sum(1 for o in objects if o.sync_status == "SYNCING")
    pending = total - (synced + failed + syncing)

    return {
        "total": total,
        "synced": synced,
        "pending": pending,
        "syncing": syncing,
        "failed": failed,
        "r2Bucket": settings.R2_BUCKET,
        "r2PublicDomain": settings.R2_PUBLIC_DOMAIN,
    }

@router.post("/storage/{object_id}/sync")
async def trigger_image_sync(
    object_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually triggers or retries synchronization of a specific image to Cloudflare R2."""
    from app.modules.storage.sync_worker import sync_storage_object
    result = await sync_storage_object(storage_object_id=object_id, db=db, force=True)
    return result

@router.post("/storage/sync/batch")
async def trigger_batch_image_sync(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Dispatches background sync for all PENDING or FAILED images."""
    from app.modules.storage.sync_worker import dispatch_image_sync_job
    res = await db.execute(select(StorageObject))
    objects = res.scalars().all()

    queued = 0
    for obj in objects:
        if obj.sync_status in ("PENDING", "FAILED"):
            await dispatch_image_sync_job(
                image_id=obj.id,
                google_drive_file_id=obj.provider_object_id,
                entity_type="product",
                entity_id=obj.id,
            )
            queued += 1

    return {"status": "DISPATCHED", "queued": queued}

