import asyncio
import json
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.modules.storage.models import StorageProvider

async def test():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(StorageProvider).where(StorageProvider.type == 'GOOGLE_DRIVE'))
        p = res.scalar_one_or_none()
        c = json.loads(p.credentials_reference)
        creds = Credentials(
            token=c.get("access_token"),
            refresh_token=c.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=c.get("client_id"),
            client_secret=c.get("client_secret"),
            scopes=["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]
        )
        print("Initial token valid?", creds.valid)
        try:
            creds.refresh(GoogleRequest())
            print("Token refresh SUCCESS! New token starts with:", creds.token[:15])
        except Exception as e:
            print("Token refresh FAILED:", e)

if __name__ == "__main__":
    asyncio.run(test())
