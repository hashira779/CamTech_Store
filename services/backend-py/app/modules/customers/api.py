from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser

from .models import Customer
from .schemas import CustomerDto, PaginatedResponse, PageMeta

router = APIRouter(tags=["Customers"])

@router.get("/customers", response_model=PaginatedResponse[CustomerDto])
async def list_customers(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Customer).where(Customer.organization_id == user.organization_id)
    )
    customers = result.scalars().all()
    items = [
        CustomerDto(
            id=c.id,
            organizationId=c.organization_id,
            code=c.code or "",
            name=c.name,
            email=c.email,
            phone=c.phone,
            type=c.type,
            notes=c.notes,
            isActive=c.is_active,
            creditBalance=0.0  # Simplified for now, or based on store_credit
        ) for c in customers
    ]
    return PaginatedResponse(items=items, meta=PageMeta(page=1, limit=50, total=len(items), totalPages=1), total=len(items))
