import json
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import app.models.entities  # Import this first to resolve circular dependencies
from app.modules.storage.models import StorageProvider
from app.models.entities import Organization
from typing import Dict, Any

async def sync_storage_providers(db: AsyncSession, config_path: str = "storage_config.json"):
    """
    Reads storage_config.json and ensures the database has corresponding
    StorageProvider records for the default organization.
    The actual credentials stay in the JSON file.
    """
    if not os.path.exists(config_path):
        print(f"No {config_path} found. Skipping provider sync.")
        return

    with open(config_path, "r") as f:
        try:
            config_data = json.load(f)
        except json.JSONDecodeError:
            print(f"Error parsing {config_path}. Skipping provider sync.")
            return

    providers_config = config_data.get("providers", [])
    if not providers_config:
        return

    # Find the default organization (or just the first one)
    org_res = await db.execute(select(Organization).limit(1))
    org = org_res.scalar_one_or_none()
    
    if not org:
        print("No organization found. Cannot sync storage providers.")
        return
        
    org_id = org.id

    for p_conf in providers_config:
        # Check if provider already exists by type and organization
        res = await db.execute(
            select(StorageProvider).where(
                StorageProvider.organization_id == org_id,
                StorageProvider.type == p_conf["type"]
            )
        )
        existing = res.scalar_one_or_none()
        
        if existing:
            # Update existing
            existing.name = p_conf.get("name", existing.name)
            existing.is_default = p_conf.get("is_default", existing.is_default)
            existing.configuration = p_conf.get("configuration", existing.configuration)
            # DO NOT save credentials directly to DB if they are in the config file
        else:
            # Create new
            new_provider = StorageProvider(
                organization_id=org_id,
                name=p_conf.get("name", p_conf["type"]),
                type=p_conf["type"],
                is_default=p_conf.get("is_default", False),
                configuration=p_conf.get("configuration", {}),
                status="CONNECTED"
            )
            db.add(new_provider)

    await db.commit()
    print("Storage providers synced from config.")
