import uuid
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.storage.models import StorageProvider, StorageObject, StorageAttachment
from app.modules.storage.providers import get_provider_adapter

async def get_active_provider(db: AsyncSession, organization_id: str, requested_provider_id: str = None, entity_type: str = None) -> StorageProvider:
    if requested_provider_id:
        result = await db.execute(
            select(StorageProvider).where(
                StorageProvider.organization_id == organization_id,
                StorageProvider.id == requested_provider_id
            )
        )
        return result.scalars().first()
    
    if entity_type:
        # Check for active policy matching the entity type
        from app.modules.storage.models import StoragePolicy
        result = await db.execute(
            select(StoragePolicy).where(
                StoragePolicy.organization_id == organization_id,
                StoragePolicy.entity_type == entity_type,
                StoragePolicy.is_active == True,
                StoragePolicy.provider_id != None
            ).order_by(StoragePolicy.created_at.desc())
        )
        policy = result.scalars().first()
        if policy and policy.provider_id:
            result = await db.execute(
                select(StorageProvider).where(
                    StorageProvider.organization_id == organization_id,
                    StorageProvider.id == policy.provider_id
                )
            )
            prov = result.scalars().first()
            if prov:
                return prov

    # Get default
    result = await db.execute(
        select(StorageProvider).where(
            StorageProvider.organization_id == organization_id,
            StorageProvider.is_default == True
        )
    )
    prov = result.scalars().first()
    if not prov:
        # Fallback to any connected
        result = await db.execute(
            select(StorageProvider).where(
                StorageProvider.organization_id == organization_id,
                StorageProvider.status == "CONNECTED"
            ).limit(1)
        )
        prov = result.scalars().first()
    return prov

async def get_provider_adapter_for_provider(provider: StorageProvider):
    import json
    import os
    
    credentials_data = {}
    
    # Prioritize DB credentials first (configured via UI)
    if provider.credentials_reference:
        try:
            credentials_data = json.loads(provider.credentials_reference)
        except:
            pass

    # Fallback to local JSON config if not found in DB
    config_path = "storage_config.json"
    if not credentials_data and os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                config_data = json.load(f)
                providers_config = config_data.get("providers", [])
                
                for p_conf in providers_config:
                    if p_conf["type"] == provider.type:
                        credentials_data = p_conf.get("credentials", {})
                        break
        except Exception as e:
            print(f"Failed to read credentials from {config_path}: {e}")
            
    config = provider.configuration or {}
    if isinstance(config, str):
        try:
            config = json.loads(config)
        except:
            config = {}
    return get_provider_adapter(provider.type, config, credentials_data)
