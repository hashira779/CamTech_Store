import datetime
import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import StockTransfer, NotificationRecord
from app.modules.sales.models import Sale, SaleLineItem
from app.services.delivery_service import delivery_service
from .schemas import (
    StockTransferDto,
    PickingOrderDto,
    PickingOrderItemDto,
    FulfillPickingInput,
)

router = APIRouter(tags=["Warehouse & Transfers"])

@router.get("/wms/transfers", response_model=List[StockTransferDto])
async def list_stock_transfers(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StockTransfer)
        .where(StockTransfer.organization_id == user.organization_id)
        .order_by(desc(StockTransfer.created_at))
    )
    transfers = result.scalars().all()
    return [
        {
            "id": t.id,
            "transferNumber": t.transfer_number,
            "fromLocationId": t.source_location_id,
            "toLocationId": t.destination_location_id,
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
        "fromLocationId": transfer.source_location_id,
        "toLocationId": transfer.destination_location_id,
        "status": transfer.status,
        "createdAt": transfer.created_at.isoformat()
    }


# ─── Stocker Fulfillment & Picking Queue ─────────────────────────────────────

def _parse_sale_notes(raw: Optional[str]) -> dict:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {"notes": str(raw)}


@router.get("/wms/picking-orders", response_model=List[PickingOrderDto])
async def list_picking_orders(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns customer sales orders requiring warehouse picking and packaging.
    Stocker uses this queue to assemble items from warehouse shelves.
    """
    stmt = (
        select(Sale)
        .where(Sale.organization_id == user.organization_id)
        .options(selectinload(Sale.line_items))
        .order_by(desc(Sale.created_at))
        .limit(50)
    )
    result = await db.execute(stmt)
    sales = result.scalars().all()

    orders: List[PickingOrderDto] = []
    for s in sales:
        notes_dict = _parse_sale_notes(s.notes)
        wms_status = notes_dict.get("wmsStatus", "PENDING_PICKING")

        orders.append(PickingOrderDto(
            id=s.id,
            saleNumber=s.sale_number,
            customerName=notes_dict.get("customerName", "Valued Customer"),
            customerPhone=notes_dict.get("customerPhone"),
            deliveryAddress=notes_dict.get("deliveryAddress", "Customer Address"),
            itemCount=len(s.line_items),
            wmsStatus=wms_status,
            createdAt=s.created_at.isoformat(),
            items=[
                PickingOrderItemDto(
                    id=li.id,
                    variantId=li.product_variant_id,
                    sku=li.sku,
                    name=li.product_name,
                    quantity=float(li.quantity),
                    unitPrice=float(li.unit_price),
                    zone="Zone A" if idx % 2 == 0 else "Zone B",
                    bin=f"Bin {idx+1:02d}",
                ) for idx, li in enumerate(s.line_items)
            ]
        ))
    return orders


@router.post("/wms/picking-orders/{sale_id}/fulfill", response_model=PickingOrderDto)
async def fulfill_picking_order(
    sale_id: str,
    inp: FulfillPickingInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Warehouse Stocker action: Marks order items as picked, boxed, and ready at dock.
    Dispatches real-time notification to delivery drivers that parcel is ready.
    """
    stmt = (
        select(Sale)
        .where(Sale.id == sale_id, Sale.organization_id == user.organization_id)
        .options(selectinload(Sale.line_items))
    )
    result = await db.execute(stmt)
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale order not found")

    now = datetime.datetime.utcnow()
    notes_dict = _parse_sale_notes(sale.notes)
    notes_dict["wmsStatus"] = "PICKED"
    notes_dict["packedAt"] = now.isoformat()
    notes_dict["packerName"] = inp.packerName or user.id
    if inp.notes:
        notes_dict["packingNotes"] = inp.notes
    sale.notes = json.dumps(notes_dict)

    # Dispatch notification to Delivery Couriers that package is ready for pickup
    dock_note = NotificationRecord(
        id=str(uuid.uuid4()),
        organization_id=user.organization_id,
        user_id=None,
        channel="IN_APP",
        type="TRANSFER_DISPATCHED",
        title=f"📦 Parcel Ready at Dock #{sale.sale_number}",
        message=f"Order #{sale.sale_number} has been picked & boxed by Stocker. Ready for courier pickup at dispatch bay.",
        status="SENT",
        is_read=False,
        sent_at=now,
        created_at=now,
        metadata_={
            "saleId": sale.id,
            "saleNumber": sale.sale_number,
            "status": "READY_FOR_COURIER",
            "targetAudience": "DELIVERY",
        }
    )
    db.add(dock_note)
    await db.commit()

    return PickingOrderDto(
        id=sale.id,
        saleNumber=sale.sale_number,
        customerName=notes_dict.get("customerName", "Valued Customer"),
        customerPhone=notes_dict.get("customerPhone"),
        deliveryAddress=notes_dict.get("deliveryAddress", "Customer Address"),
        itemCount=len(sale.line_items),
        wmsStatus="PICKED",
        createdAt=sale.created_at.isoformat(),
        items=[
            PickingOrderItemDto(
                id=li.id,
                variantId=li.product_variant_id,
                sku=li.sku,
                name=li.product_name,
                quantity=float(li.quantity),
                unitPrice=float(li.unit_price),
                zone="Zone A" if idx % 2 == 0 else "Zone B",
                bin=f"Bin {idx+1:02d}",
            ) for idx, li in enumerate(sale.line_items)
        ]
    )
