from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser

from .models import ServiceTicket, TicketComment
from .schemas import ServiceTicketDto

router = APIRouter(tags=["Service Desk"])

@router.get("/tickets", response_model=List[ServiceTicketDto])
async def list_tickets(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ServiceTicket)
        .where(ServiceTicket.organization_id == user.organization_id)
        .order_by(desc(ServiceTicket.created_at))
    )
    tickets = result.scalars().all()
    return [
        {
            "id": t.id,
            "ticketNumber": t.ticket_number,
            "subject": t.subject,
            "description": t.description,
            "priority": t.priority,
            "status": t.status,
            "createdAt": t.created_at.isoformat()
        } for t in tickets
    ]
