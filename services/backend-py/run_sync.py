import asyncio
import app.models.entities  # Resolve circular imports
from app.core.database import AsyncSessionLocal
from app.modules.storage.sync_providers import sync_storage_providers

async def main():
    async with AsyncSessionLocal() as db:
        await sync_storage_providers(db, "storage_config.json")

if __name__ == "__main__":
    asyncio.run(main())
