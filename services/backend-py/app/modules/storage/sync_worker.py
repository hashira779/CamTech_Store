import asyncio
import io
import json
import logging
import os
import time
import uuid
from typing import Dict, Any, Optional, List
import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.modules.storage.models import StorageObject, StorageProvider
from app.modules.storage.providers.r2 import CloudflareR2Provider
from app.modules.storage.providers import get_provider_adapter
from app.modules.storage.services import get_provider_adapter_for_provider
from app.modules.storage.image_processing import (
    generate_image_variants,
    validate_and_inspect_image,
)

logger = logging.getLogger("image_sync_worker")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QUEUE_KEY = "mystore:image_sync_queue"
MAX_RETRIES = 3

# In-memory queue fallback for local development or when Redis is not running
_in_memory_sync_queue = asyncio.Queue()

async def get_redis_client() -> Optional[aioredis.Redis]:
    try:
        client = aioredis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1.0)
        await client.ping()
        return client
    except Exception:
        return None

def get_r2_provider() -> CloudflareR2Provider:
    """Returns a configured CloudflareR2Provider using app settings."""
    return CloudflareR2Provider(
        config={
            "account_id": settings.R2_ACCOUNT_ID,
            "access_key_id": settings.R2_ACCESS_KEY_ID,
            "secret_access_key": settings.R2_SECRET_ACCESS_KEY,
            "bucket": settings.R2_BUCKET,
            "public_domain": settings.R2_PUBLIC_DOMAIN,
        }
    )

async def get_r2_provider_async(db: Optional[AsyncSession] = None) -> CloudflareR2Provider:
    """
    Returns a configured CloudflareR2Provider:
    1. Checks database for an active StorageProvider configured in the Admin UI (CLOUDFLARE_R2)
    2. Falls back to environment settings (settings.R2_ACCOUNT_ID, etc.)
    """
    if db:
        res = await db.execute(
            select(StorageProvider).where(StorageProvider.status == "CONNECTED")
        )
        providers = res.scalars().all()
        for p in providers:
            cfg = p.configuration or {}
            if isinstance(cfg, str):
                try:
                    cfg = json.loads(cfg)
                except Exception:
                    cfg = {}
            if cfg.get("provider_subtype") == "CLOUDFLARE_R2" or "r2" in (p.name or "").lower():
                creds = {}
                if p.credentials_reference:
                    try:
                        creds = json.loads(p.credentials_reference)
                    except Exception:
                        pass
                acc_id = cfg.get("account_id") or cfg.get("accountId") or settings.R2_ACCOUNT_ID
                key_id = creds.get("access_key_id") or cfg.get("access_key") or settings.R2_ACCESS_KEY_ID
                sec_key = creds.get("secret_access_key") or cfg.get("secret_key") or settings.R2_SECRET_ACCESS_KEY
                bucket = cfg.get("bucket") or settings.R2_BUCKET
                pub_dom = cfg.get("public_domain") or cfg.get("publicDomain") or settings.R2_PUBLIC_DOMAIN

                if acc_id and key_id and sec_key:
                    return CloudflareR2Provider(config={
                        "account_id": acc_id,
                        "access_key_id": key_id,
                        "secret_access_key": sec_key,
                        "bucket": bucket,
                        "public_domain": pub_dom,
                    })

    return get_r2_provider()

async def dispatch_image_sync_job(
    image_id: str,
    google_drive_file_id: Optional[str] = None,
    entity_type: str = "product",
    entity_id: Optional[str] = None,
    run_async_task: bool = True
) -> str:
    """
    Enqueues an image synchronization job into Redis (or in-memory queue).
    Returns immediately without blocking client requests.
    """
    job_id = f"job_sync_{uuid.uuid4().hex[:10]}"
    payload = {
        "job_id": job_id,
        "image_id": image_id,
        "google_drive_file_id": google_drive_file_id,
        "entity_type": entity_type,
        "entity_id": entity_id or image_id,
        "queued_at": time.time(),
        "retry_count": 0,
    }

    redis_client = await get_redis_client()
    if redis_client:
        try:
            await redis_client.lpush(QUEUE_KEY, json.dumps(payload))
            await redis_client.close()
        except Exception as ex:
            logger.warning("Redis push failed, falling back to in-memory queue: %s", ex)
            await _in_memory_sync_queue.put(payload)
    else:
        await _in_memory_sync_queue.put(payload)

    if run_async_task:
        asyncio.create_task(process_single_job_payload(payload))

    logger.info("Enqueued image sync job %s for image %s", job_id, image_id)
    return job_id

async def sync_storage_object(
    storage_object_id: str,
    db: AsyncSession,
    force: bool = False,
    entity_id: Optional[str] = None,
    entity_type: str = "product"
) -> Dict[str, Any]:
    """
    Processes synchronization for a single StorageObject:
    1. Downloads original from source (Google Drive)
    2. Validates and generates WebP variants (thumbnail, medium, large)
    3. Uploads variants to Cloudflare R2
    4. Updates StorageObject metadata to SYNCED with direct CDN URLs
    """
    res = await db.execute(
        select(StorageObject).where(StorageObject.id == storage_object_id)
    )
    obj = res.scalar_one_or_none()
    if not obj:
        raise ValueError(f"StorageObject {storage_object_id} not found")

    # Load source provider
    prov_res = await db.execute(
        select(StorageProvider).where(StorageProvider.id == obj.provider_id)
    )
    source_provider = prov_res.scalar_one_or_none()
    if not source_provider:
        raise ValueError(f"StorageProvider {obj.provider_id} not found")

    source_adapter = await get_provider_adapter_for_provider(source_provider)
    r2_adapter = await get_r2_provider_async(db)

    # Step 1: Mark as SYNCING
    obj.update_sync_state(status="SYNCING")
    await db.commit()

    try:
        source_key = obj.provider_object_id or obj.object_key

        # Step 2: Check for changes if not forced
        gdrive_meta = await source_adapter.get_object_metadata(source_key)
        modified_time = gdrive_meta.get("modifiedTime") if gdrive_meta else None
        gdrive_checksum = gdrive_meta.get("checksum") if gdrive_meta else None

        meta = obj.metadata_ or {}
        if not force and obj.sync_status == "SYNCED":
            if modified_time and meta.get("google_drive_modified_time") == modified_time:
                logger.info("Image %s has not changed since %s; skipping sync", storage_object_id, modified_time)
                return {"status": "SKIPPED", "image_id": storage_object_id, "reason": "UNCHANGED"}

        # Step 3: Download original binary from Google Drive
        stream_gen = None
        if hasattr(source_adapter, "stream_object"):
            try:
                stream_gen, _ = await source_adapter.stream_object(source_key, file_id=obj.provider_object_id)
            except TypeError:
                stream_gen, _ = await source_adapter.stream_object(source_key)
        elif hasattr(source_adapter, "get_object_stream"):
            stream_gen = await source_adapter.get_object_stream(source_key)

        chunks = []
        if stream_gen:
            async for chunk in stream_gen:
                chunks.append(chunk)
        original_bytes = b"".join(chunks)

        if not original_bytes:
            raise ValueError(f"Downloaded empty file from source provider for key {source_key}")

        # Step 4: Validate image
        validate_and_inspect_image(original_bytes)

        # Step 5: Generate WebP variants
        variant_result = await generate_image_variants(original_bytes)
        variants = variant_result["variants"]
        width = variant_result["width"]
        height = variant_result["height"]

        # Step 6: Determine deterministic R2 storage keys
        current_version = obj.version or 1
        target_entity_id = entity_id or obj.id
        prefix = f"{entity_type}s/{target_entity_id}"

        thumb_key = f"{prefix}/thumbnail/v{current_version}.webp"
        medium_key = f"{prefix}/medium/v{current_version}.webp"
        large_key = f"{prefix}/large/v{current_version}.webp"
        
        # Determine extension for original
        orig_ext = obj.file_name.split(".")[-1] if "." in obj.file_name else "jpg"
        orig_key = f"{prefix}/original/v{current_version}.{orig_ext}"

        # Step 7: Upload variants to R2
        await r2_adapter.upload(object_key=thumb_key, data=variants["thumbnail"], mime_type="image/webp")
        await r2_adapter.upload(object_key=medium_key, data=variants["medium"], mime_type="image/webp")
        await r2_adapter.upload(object_key=large_key, data=variants["large"], mime_type="image/webp")
        await r2_adapter.upload(object_key=orig_key, data=original_bytes, mime_type=obj.mime_type or "image/jpeg")

        # Step 8: Get CDN URLs
        thumb_url = await r2_adapter.get_url(thumb_key)
        medium_url = await r2_adapter.get_url(medium_key)
        large_url = await r2_adapter.get_url(large_key)

        # Step 9: Update StorageObject state
        obj.update_sync_state(
            status="SYNCED",
            thumbnail_url=thumb_url,
            medium_url=medium_url,
            large_url=large_url,
            width=width,
            height=height,
            sync_error=None,
            google_drive_modified_time=modified_time,
        )
        obj.storage_url = medium_url
        if gdrive_checksum:
            obj.checksum = gdrive_checksum

        await db.commit()
        logger.info(
            "Successfully synced image %s to R2. Thumb: %s, Med: %s, Large: %s",
            storage_object_id, thumb_url, medium_url, large_url
        )

        return {
            "status": "SYNCED",
            "image_id": storage_object_id,
            "thumbnail_url": thumb_url,
            "medium_url": medium_url,
            "large_url": large_url,
            "width": width,
            "height": height,
        }

    except Exception as exc:
        logger.error("Failed to sync image %s: %s", storage_object_id, exc, exc_info=True)
        obj.update_sync_state(status="FAILED", sync_error=str(exc))
        await db.commit()
        raise

async def process_single_job_payload(payload: Dict[str, Any]):
    """Background processor for a single job payload."""
    image_id = payload.get("image_id")
    entity_id = payload.get("entity_id")
    entity_type = payload.get("entity_type", "product")

    async with AsyncSessionLocal() as db:
        try:
            await sync_storage_object(
                storage_object_id=image_id,
                db=db,
                force=False,
                entity_id=entity_id,
                entity_type=entity_type
            )
        except Exception as exc:
            logger.warning(
                "Image sync job failed for image %s: %s (attempt %d)",
                image_id, exc, payload.get("retry_count", 0) + 1
            )

async def run_sync_worker(poll_interval: float = 1.0):
    """
    Continuous worker loop that pulls from Redis queue or in-memory queue.
    """
    logger.info("Starting Image Storage & CDN Sync Worker on queue: %s", QUEUE_KEY)
    
    while True:
        try:
            job_payload = None
            redis_client = await get_redis_client()
            if redis_client:
                try:
                    # BRPOP with 2-second timeout
                    item = await redis_client.brpop(QUEUE_KEY, timeout=2)
                    if item:
                        _, data_str = item
                        job_payload = json.loads(data_str)
                    await redis_client.close()
                except Exception as ex:
                    logger.debug("Redis brpop error: %s", ex)

            if not job_payload:
                # Check in-memory fallback queue
                try:
                    job_payload = _in_memory_sync_queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass

            if job_payload:
                await process_single_job_payload(job_payload)
            else:
                await asyncio.sleep(poll_interval)

        except asyncio.CancelledError:
            logger.info("Image sync worker received cancellation. Shutting down gracefully.")
            break
        except Exception as exc:
            logger.error("Unexpected error in image sync worker loop: %s", exc)
            await asyncio.sleep(2.0)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    asyncio.run(run_sync_worker())
