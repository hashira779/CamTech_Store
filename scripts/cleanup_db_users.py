#!/usr/bin/env python3
import sys
import os
import asyncio
from pathlib import Path

# Add backend to path for local DB session
backend_dir = Path(__file__).resolve().parent.parent / "services" / "backend-py"
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, os.path.dirname(__file__))

import run_remote as r
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def cleanup_local():
    print("\n=== Cleaning up local database ===")
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM users WHERE email IN ('admin@camtechstore', 'admin@camtechstore.com');"))
        await db.commit()
        res = await db.execute(text("SELECT id, email, name, roles, \"isActive\" FROM users WHERE email LIKE '%admin%' OR email LIKE '%cashier%';"))
        rows = res.fetchall()
        print(f"Local remaining key users ({len(rows)}):")
        for r_row in rows:
            print(f" - {r_row[1]} ({r_row[2]}): {r_row[3]}")

if __name__ == "__main__":
    remote_cleanup = """
docker exec mystore-postgres psql -U camtech -d camtechStore -c "
SELECT id, email, name, roles, \\"isActive\\", \\"createdAt\\" FROM users ORDER BY \\"createdAt\\" ASC;
"
"""
    print("=== Checking remote database on Ubuntu server ===")
    r.exec_remote(remote_cleanup)
    
    try:
        asyncio.run(cleanup_local())
    except Exception as e:
        print("Local DB cleanup skipped or error:", e)
