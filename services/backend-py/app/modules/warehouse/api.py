from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import StockTransfer
from .schemas import StockTransferDto

router = APIRouter(tags=["Warehouse & Transfers"])

@router.get("/wms/transfers", response_model=List[StockTransferDto])
async def list_stock_transfers(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StockTransfer).where(StockTransfer.organization_id == user.organization_id)
    )
    transfers = result.scalars().all()
    return [
        {
            "id": t.id,
            "transferNumber": t.transfer_number,
            "fromLocationId": t.from_location_id,
            "toLocationId": t.to_location_id,
            "status": t.status,
            "createdAt": t.created_at.isoformat()
        } for t in transfers
    ]

@router.get("/wms/transfers/{transfer_id}", response_model=StockTransferDto)
async def get_stock_transfer(
    transfer_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StockTransfer).where(
            StockTransfer.id == transfer_id,
            StockTransfer.organization_id == user.organization_id
        )
    )
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    return {
        "id": transfer.id,
        "transferNumber": transfer.transfer_number,
        "fromLocationId": transfer.from_location_id,
        "toLocationId": transfer.to_location_id,
        "status": transfer.status,
        "createdAt": transfer.created_at.isoformat()
    }
