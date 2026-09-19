import asyncio
import json
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.modules.storage.models import StorageProvider

async def test():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(StorageProvider).where(StorageProvider.type == 'GOOGLE_DRIVE'))
        for p in res.scalars().all():
            print("PROVIDER:", p.name, p.id, p.configuration)
            if p.credentials_reference:
                try:
                    c = json.loads(p.credentials_reference)
                    print("CREDENTIAL KEYS:", list(c.keys()))
                    for k, v in c.items():
                        print(f"  {k}: len={len(str(v))}, starts={str(v)[:8]}...")
                except Exception as e:
                    print("Error parsing json:", e)
            else:
                print("NO credentials_reference")

if __name__ == "__main__":
    asyncio.run(test())
