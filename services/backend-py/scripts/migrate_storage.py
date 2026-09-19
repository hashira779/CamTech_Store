import asyncio
import os
import sys
import uuid

# Ensure services/backend-py root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.entities import DocumentRecord
from app.modules.storage.models import StorageProvider, StorageObject, StorageAttachment

async def migrate_data():
    async with AsyncSessionLocal() as db:
        print("Starting data migration from document_records to storage_objects...")
        
        # 1. Ensure a default Local S3 provider exists for the migration
        # We need to assign one provider per organization, or a system-wide default.
        # Since providers belong to an organization, we must get all unique orgs.
        result = await db.execute(select(DocumentRecord.organization_id).distinct())
        org_ids = [r[0] for r in result.all()]
        
        provider_map = {}
        for org_id in org_ids:
            # Check if a default provider exists
            prov_result = await db.execute(
                select(StorageProvider).where(
                    StorageProvider.organization_id == org_id,
                    StorageProvider.type == "LOCAL_S3"
                )
            )
            provider = prov_result.scalars().first()
            if not provider:
                provider = StorageProvider(
                    id=str(uuid.uuid4()),
                    organization_id=org_id,
                    name="Legacy Local Storage",
                    type="LOCAL_S3",
                    status="CONNECTED",
                    is_default=True,
                    configuration={"bucket": "default"}
                )
                db.add(provider)
                await db.flush()
            provider_map[org_id] = provider.id
        
        # 2. Migrate documents
        docs_result = await db.execute(select(DocumentRecord))
        docs = docs_result.scalars().all()
        
        migrated_count = 0
        for doc in docs:
            # Check if already migrated
            existing = await db.execute(
                select(StorageObject).where(StorageObject.id == doc.id)
            )
            if existing.scalars().first():
                continue
                
            storage_path = f"{doc.bucket}/{doc.key}" if doc.bucket else doc.key
            
            obj = StorageObject(
                id=doc.id,  # Keep the same ID so client references don't break
                organization_id=doc.organization_id,
                provider_id=provider_map[doc.organization_id],
                object_key=doc.key,
                file_name=doc.filename,
                mime_type=doc.mime_type,
                size_bytes=doc.byte_size,
                storage_path=storage_path,
                storage_url=f"/api/v1/storage/{doc.id}/download", # Just a placeholder
                status="AVAILABLE",
                created_at=doc.created_at,
                updated_at=doc.updated_at
            )
            db.add(obj)
            
            # Create attachment if entity linked
            if doc.entity_type and doc.entity_id:
                attachment = StorageAttachment(
                    id=str(uuid.uuid4()),
                    organization_id=doc.organization_id,
                    storage_object_id=doc.id,
                    entity_type=doc.entity_type,
                    entity_id=doc.entity_id,
                    is_primary=True,
                    created_at=doc.created_at
                )
                db.add(attachment)
            
            migrated_count += 1
            
        await db.commit()
        print(f"Migrated {migrated_count} document records successfully.")

if __name__ == "__main__":
    asyncio.run(migrate_data())
