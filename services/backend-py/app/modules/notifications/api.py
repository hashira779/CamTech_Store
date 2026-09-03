from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import NotificationRecord
from .schemas import NotificationRecordDto

router = APIRouter(tags=["Notifications Platform"])

@router.get("/notifications", response_model=List[NotificationRecordDto])
async def list_notifications(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(NotificationRecord)
        .where(NotificationRecord.organization_id == user.organization_id)
        .order_by(desc(NotificationRecord.sent_at))
        .limit(20)
    )
    notes = result.scalars().all()
    return [
        {
            "id": n.id,
            "channel": n.channel,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "status": n.status,
            "sentAt": n.sent_at.isoformat()
        } for n in notes
    ]
