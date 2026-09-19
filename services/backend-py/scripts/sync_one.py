import asyncio
import traceback
from app.core.database import AsyncSessionLocal
from app.modules.storage.sync_worker import sync_storage_object
from app.modules.storage.models import StorageObject
from sqlalchemy import select

async def test():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(StorageObject).where(StorageObject.id == '26cca352-0762-4f39-a92a-0aad98b32c21'))
        obj = res.scalar_one_or_none()
        print("StorageObject:", obj.id, "key:", obj.object_key, "provider_object_id:", obj.provider_object_id, "metadata:", obj.metadata_)
        try:
            r = await sync_storage_object('26cca352-0762-4f39-a92a-0aad98b32c21', db, force=True)
            print("Sync result:", r)
        except Exception as e:
            print("Sync failed:", e)
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
