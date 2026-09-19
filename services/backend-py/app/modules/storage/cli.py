import argparse
import asyncio
import logging
import sys
from typing import Optional
from sqlalchemy import select, func, and_

from app.core.database import AsyncSessionLocal
from app.modules.storage.models import StorageObject, StorageAttachment
from app.modules.storage.sync_worker import sync_storage_object, get_r2_provider

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("storage_cli")

async def cmd_status():
    """Outputs current image storage synchronization status across the platform."""
    async with AsyncSessionLocal() as db:
        total_res = await db.execute(select(func.count(StorageObject.id)))
        total_count = total_res.scalar() or 0

        # Query all objects to inspect metadata sync status
        res = await db.execute(select(StorageObject))
        objects = res.scalars().all()

        synced = sum(1 for o in objects if o.sync_status == "SYNCED")
        failed = sum(1 for o in objects if o.sync_status == "FAILED")
        syncing = sum(1 for o in objects if o.sync_status == "SYNCING")
        pending = total_count - (synced + failed + syncing)

        print("\n=======================================================")
        print("  📸 IMAGE STORAGE & CDN SYNCHRONIZATION STATUS")
        print("=======================================================")
        print(f"  Total Images:      {total_count}")
        print(f"  Synced (R2/CDN):   {synced}")
        print(f"  Pending:           {pending}")
        print(f"  Syncing:           {syncing}")
        print(f"  Failed:            {failed}")
        print("=======================================================\n")

async def cmd_sync(
    batch_size: int = 50,
    dry_run: bool = False,
    force: bool = False,
    retry_failed: bool = False,
    entity_type: Optional[str] = None
):
    """
    Performs batch synchronization of images from Google Drive to Cloudflare R2.
    Resumable, safe, and idempotent.
    """
    logger.info(
        "Starting sync with batch_size=%d, dry_run=%s, force=%s, retry_failed=%s, entity_type=%s",
        batch_size, dry_run, force, retry_failed, entity_type
    )

    r2 = get_r2_provider()
    logger.info("Target R2 Public Domain: %s, Bucket: %s", r2.public_domain, r2.bucket)

    async with AsyncSessionLocal() as db:
        # Fetch candidate storage objects
        stmt = select(StorageObject)
        if entity_type:
            stmt = stmt.join(
                StorageAttachment, StorageAttachment.storage_object_id == StorageObject.id
            ).where(StorageAttachment.entity_type == entity_type.upper())

        res = await db.execute(stmt)
        all_objects = res.scalars().all()

        # Filter candidates based on status
        candidates = []
        for obj in all_objects:
            status = obj.sync_status
            if force:
                candidates.append(obj)
            elif retry_failed and status == "FAILED":
                candidates.append(obj)
            elif status in ("PENDING", "FAILED"):
                candidates.append(obj)

        total_candidates = len(candidates)
        logger.info("Found %d candidate images requiring synchronization.", total_candidates)

        if dry_run:
            print(f"[DRY-RUN] Would process {total_candidates} images in batches of {batch_size}.")
            for c in candidates[:10]:
                print(f"  - Image ID: {c.id}, File: {c.file_name}, Status: {c.sync_status}")
            if total_candidates > 10:
                print(f"  ... and {total_candidates - 10} more.")
            return

        success_count = 0
        failure_count = 0
        skipped_count = 0

        # Process in batches
        for offset in range(0, total_candidates, batch_size):
            batch = candidates[offset : offset + batch_size]
            batch_num = (offset // batch_size) + 1
            total_batches = (total_candidates + batch_size - 1) // batch_size
            logger.info("--- Processing batch %d of %d (size: %d) ---", batch_num, total_batches, len(batch))

            for obj in batch:
                try:
                    # Find linked entity if exists
                    att_res = await db.execute(
                        select(StorageAttachment).where(StorageAttachment.storage_object_id == obj.id)
                    )
                    att = att_res.scalars().first()
                    target_entity_id = att.entity_id if att else obj.id
                    target_entity_type = (att.entity_type.lower() if att else "product")

                    result = await sync_storage_object(
                        storage_object_id=obj.id,
                        db=db,
                        force=force,
                        entity_id=target_entity_id,
                        entity_type=target_entity_type
                    )

                    if result.get("status") == "SKIPPED":
                        skipped_count += 1
                    else:
                        success_count += 1
                except Exception as exc:
                    logger.error("Failed processing image %s: %s", obj.id, exc)
                    failure_count += 1

            logger.info(
                "Batch %d complete. Running totals -> Success: %d, Skipped: %d, Failed: %d",
                batch_num, success_count, skipped_count, failure_count
            )

        print("\n=======================================================")
        print("  🎉 MIGRATION / SYNC RUN COMPLETED")
        print("=======================================================")
        print(f"  Processed: {total_candidates}")
        print(f"  Success:   {success_count}")
        print(f"  Skipped:   {skipped_count}")
        print(f"  Failed:    {failure_count}")
        print("=======================================================\n")

def main():
    parser = argparse.ArgumentParser(description="Image Storage & CDN Management CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status command
    subparsers.add_parser("status", help="Show image synchronization status")

    # sync command
    sync_parser = subparsers.add_parser("sync", help="Synchronize images to Cloudflare R2")
    sync_parser.add_argument("--batch-size", type=int, default=50, help="Number of images per batch")
    sync_parser.add_argument("--dry-run", action="store_true", help="Simulate without uploading")
    sync_parser.add_argument("--force", action="store_true", help="Force sync even if already SYNCED")
    sync_parser.add_argument("--retry-failed", action="store_true", help="Retry failed images")
    sync_parser.add_argument("--entity-type", type=str, default=None, help="Filter by entity type (e.g. PRODUCT)")

    # reconcile command
    reconcile_parser = subparsers.add_parser("reconcile", help="Detect changed or missing images")
    reconcile_parser.add_argument("--batch-size", type=int, default=50, help="Number of images per batch")

    args = parser.parse_args()

    if args.command == "status":
        asyncio.run(cmd_status())
    elif args.command == "sync":
        asyncio.run(cmd_sync(
            batch_size=args.batch_size,
            dry_run=args.dry_run,
            force=args.force,
            retry_failed=args.retry_failed,
            entity_type=args.entity_type
        ))
    elif args.command == "reconcile":
        asyncio.run(cmd_sync(
            batch_size=args.batch_size,
            dry_run=False,
            force=False,
            retry_failed=True,
        ))

if __name__ == "__main__":
    main()
