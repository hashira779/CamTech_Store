import sys
import os
import json
import asyncio

# Ensure services/backend-py is on python path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from sqlalchemy import select, text
import app.models.entities  # Loads all model relationships
from app.core.database import AsyncSessionLocal
from app.modules.identity.models import User, Role, UserRole

CANONICAL_ROLES = [
    ("SUPER_ADMIN", "Full platform super administrator with unrestricted access"),
    ("ORG_ADMIN", "Organization administrator with tenant-wide management rights"),
    ("MANAGER", "Store or department operational manager"),
    ("CASHIER", "POS and cashier point-of-sale operator"),
    ("STAFF", "General operational and floor staff member"),
    ("DRIVER", "Delivery logistics and fleet driver"),
    ("CUSTOMER", "Store customer account")
]

async def backfill_rbac():
    print("=== STARTING RBAC RELATIONAL BACKFILL ===")
    async with AsyncSessionLocal() as db:
        # 1. Ensure all canonical roles exist in roles table
        for role_name, desc in CANONICAL_ROLES:
            existing = (await db.execute(select(Role).where(Role.name == role_name))).scalars().first()
            if not existing:
                db.add(Role(id=f"rol_{role_name.lower()}", name=role_name, description=desc))
                print(f"  + Added role: {role_name}")
            else:
                if not existing.description:
                    existing.description = desc
        await db.commit()

        # 2. Query all users
        res = await db.execute(select(User))
        users = res.scalars().all()
        print(f"Found {len(users)} users to verify.")

        synced_count = 0
        added_roles_count = 0

        for user in users:
            # Parse roles from user.roles JSON string
            roles_list = []
            if isinstance(user.roles, str):
                try:
                    parsed = json.loads(user.roles)
                    if isinstance(parsed, list):
                        roles_list = [str(r).upper() for r in parsed]
                    elif isinstance(parsed, str):
                        roles_list = [parsed.upper()]
                except Exception:
                    roles_list = [user.roles.upper()] if user.roles else ["STAFF"]
            elif isinstance(user.roles, list):
                roles_list = [str(r).upper() for r in user.roles]
            else:
                roles_list = ["STAFF"]

            if not roles_list:
                roles_list = ["STAFF"]

            # Query existing user_roles for this user
            ur_res = await db.execute(select(UserRole.role_name, UserRole.role_id).where(UserRole.user_id == user.id))
            rows = ur_res.fetchall()
            existing_role_names = set(r[0] for r in rows if r[0])
            existing_role_ids = set(r[1] for r in rows if r[1])

            user_updated = False
            for r_name in roles_list:
                r_obj = (await db.execute(select(Role).where(Role.name == r_name))).scalars().first()
                if not r_obj:
                    r_obj = Role(id=f"rol_{r_name.lower()}", name=r_name, description=f"{r_name} role")
                    db.add(r_obj)
                    await db.flush()

                if r_name not in existing_role_names and r_obj.id not in existing_role_ids:
                    db.add(UserRole(user_id=user.id, role_id=r_obj.id, role_name=r_name))
                    added_roles_count += 1
                    user_updated = True

            if user_updated:
                synced_count += 1

        await db.commit()
        print(f"=== RBAC BACKFILL COMPLETE ===")
        print(f"  Users inspected: {len(users)}")
        print(f"  Users updated with relational roles: {synced_count}")
        print(f"  User-role relations inserted: {added_roles_count}")

if __name__ == "__main__":
    asyncio.run(backfill_rbac())
