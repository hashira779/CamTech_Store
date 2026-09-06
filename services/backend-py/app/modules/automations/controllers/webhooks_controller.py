import uuid
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from ..models import WebhookSubscription

router = APIRouter(tags=["Webhooks"])

@router.get("/developers/webhooks")
async def list_webhooks(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(WebhookSubscription)
        .where(WebhookSubscription.organization_id == user.organization_id)
        .order_by(WebhookSubscription.created_at.desc())
    )
    subs = result.scalars().all()
    return [
        {
            "id": s.id,
            "organizationId": s.organization_id,
            "url": s.url,
            "description": s.description,
            "events": s.events or [],
            "isActive": s.is_active,
            "createdAt": s.created_at.isoformat() if s.created_at else None,
            "updatedAt": s.updated_at.isoformat() if s.updated_at else None
        } for s in subs
    ]

@router.post("/developers/webhooks")
async def create_webhook(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    url = (data.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Webhook URL is required")

    secret = f"whsec_{uuid.uuid4().hex}"
    events = data.get("events", [])
    if not isinstance(events, list) or len(events) == 0:
        events = ["order.created"]

    sub = WebhookSubscription(
        organization_id=user.organization_id,
        url=url,
        secret=secret,
        description=data.get("description"),
        events=events,
        is_active=True
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    return {
        "id": sub.id,
        "organizationId": sub.organization_id,
        "url": sub.url,
        "description": sub.description,
        "events": sub.events or [],
        "isActive": sub.is_active,
        "createdAt": sub.created_at.isoformat() if sub.created_at else None,
        "updatedAt": sub.updated_at.isoformat() if sub.updated_at else None
    }

@router.delete("/developers/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.id == webhook_id,
            WebhookSubscription.organization_id == user.organization_id
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Webhook subscription not found")

    await db.delete(sub)
    await db.commit()
    return {"success": True}
