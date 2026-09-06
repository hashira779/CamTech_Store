import datetime
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser
from app.domain.enterprise_engines import ApiKeyGenerator
from ..models import DeveloperApp, ApiKey

router = APIRouter(tags=["Developer Apps & API Keys"])

# ─── Developer Apps ─────────────────────────────────────────────────────────

@router.get("/developers/apps")
async def list_developer_apps(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DeveloperApp)
        .where(DeveloperApp.organization_id == user.organization_id)
        .order_by(DeveloperApp.created_at.desc())
    )
    apps = result.scalars().all()
    return [
        {
            "id": a.id,
            "organizationId": a.organization_id,
            "name": a.name,
            "description": a.description,
            "homepageUrl": a.homepage_url,
            "createdAt": a.created_at.isoformat() if a.created_at else None,
            "updatedAt": a.updated_at.isoformat() if a.updated_at else None,
            "status": "ACTIVE"
        } for a in apps
    ]

@router.post("/developers/apps")
async def create_developer_app(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="App name is required")

    app_record = DeveloperApp(
        organization_id=user.organization_id,
        name=name,
        description=data.get("description"),
        homepage_url=data.get("homepageUrl")
    )
    db.add(app_record)
    await db.commit()
    await db.refresh(app_record)

    return {
        "id": app_record.id,
        "organizationId": app_record.organization_id,
        "name": app_record.name,
        "description": app_record.description,
        "homepageUrl": app_record.homepage_url,
        "createdAt": app_record.created_at.isoformat() if app_record.created_at else None,
        "updatedAt": app_record.updated_at.isoformat() if app_record.updated_at else None,
        "status": "ACTIVE"
    }

# ─── API Keys ───────────────────────────────────────────────────────────────

@router.get("/developers/keys")
async def list_api_keys(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.organization_id == user.organization_id)
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        {
            "id": k.id,
            "organizationId": k.organization_id,
            "appId": k.app_id,
            "name": k.name,
            "keyPrefix": k.key_prefix,
            "scopes": k.scopes or [],
            "rateLimit": k.rate_limit,
            "expiresAt": k.expires_at.isoformat() if k.expires_at else None,
            "lastUsedAt": k.last_used_at.isoformat() if k.last_used_at else None,
            "revokedAt": k.revoked_at.isoformat() if k.revoked_at else None,
            "status": "REVOKED" if k.revoked_at else "ACTIVE",
            "createdAt": k.created_at.isoformat() if k.created_at else None
        } for k in keys
    ]

@router.post("/developers/keys")
async def create_api_key(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    name = (data.get("name") or "Default Key").strip()
    key_info = ApiKeyGenerator.generate_api_key("live")

    expires_in_days = data.get("expiresInDays")
    expires_at = None
    if expires_in_days:
        try:
            expires_at = utc_now() + datetime.timedelta(days=int(expires_in_days))
        except (ValueError, TypeError):
            expires_at = None

    key_record = ApiKey(
        organization_id=user.organization_id,
        app_id=data.get("appId") or None,
        name=name,
        key_prefix=key_info["keyPrefix"],
        key_hash=key_info["keyHash"],
        scopes=data.get("scopes", ["products:read"]),
        rate_limit=int(data.get("rateLimit", 60)),
        expires_at=expires_at
    )
    db.add(key_record)
    await db.commit()
    await db.refresh(key_record)

    return {
        "id": key_record.id,
        "organizationId": key_record.organization_id,
        "appId": key_record.app_id,
        "name": key_record.name,
        "keyPrefix": key_record.key_prefix,
        "scopes": key_record.scopes or [],
        "rateLimit": key_record.rate_limit,
        "expiresAt": key_record.expires_at.isoformat() if key_record.expires_at else None,
        "lastUsedAt": None,
        "revokedAt": None,
        "status": "ACTIVE",
        "createdAt": key_record.created_at.isoformat() if key_record.created_at else None,
        "secretKey": key_info["rawKey"],
        "rawKey": key_info["rawKey"]
    }

@router.delete("/developers/keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.organization_id == user.organization_id)
    )
    key_record = result.scalar_one_or_none()
    if not key_record:
        raise HTTPException(status_code=404, detail="API Key not found")

    key_record.revoked_at = utc_now()
    await db.commit()
    await db.refresh(key_record)

    return {
        "id": key_record.id,
        "organizationId": key_record.organization_id,
        "appId": key_record.app_id,
        "name": key_record.name,
        "keyPrefix": key_record.key_prefix,
        "scopes": key_record.scopes or [],
        "rateLimit": key_record.rate_limit,
        "expiresAt": key_record.expires_at.isoformat() if key_record.expires_at else None,
        "lastUsedAt": key_record.last_used_at.isoformat() if key_record.last_used_at else None,
        "revokedAt": key_record.revoked_at.isoformat() if key_record.revoked_at else None,
        "status": "REVOKED",
        "createdAt": key_record.created_at.isoformat() if key_record.created_at else None
    }
