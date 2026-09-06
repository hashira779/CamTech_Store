import datetime
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.modules.catalog.models import ProductVariant, Product
from app.modules.locations.models import Location

from .models import InventoryItem, StockMovement
from .schemas import (
    InventoryItemDto, AdjustInventoryInput, StockMovementDto,
    PaginatedResponse, PageMeta
)

router = APIRouter(tags=["Inventory"])

@router.get("/inventory", response_model=PaginatedResponse[InventoryItemDto])
async def list_inventory(
    locationId: Optional[str] = None,
    search: Optional[str] = None,
    lowStockOnly: Optional[bool] = False,
    page: int = 1,
    limit: int = 50,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(InventoryItem, ProductVariant, Product)
        .join(ProductVariant, InventoryItem.product_variant_id == ProductVariant.id)
        .join(Product, ProductVariant.product_id == Product.id)
        .where(InventoryItem.organization_id == user.organization_id)
    )
    if locationId:
        query = query.where(InventoryItem.location_id == locationId)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%") | ProductVariant.sku.ilike(f"%{search}%"))

    result = await db.execute(query)
    rows = result.all()

    items = []
    for inv, var, prod in rows:
        on_hand = float(inv.stock_on_hand)
        reorder = float(inv.reorder_point) if inv.reorder_point is not None else 0.0
        is_low = on_hand <= reorder if inv.reorder_point is not None else False
        if lowStockOnly and not is_low:
            continue
        items.append(InventoryItemDto(
            id=inv.id,
            organizationId=inv.organization_id,
            locationId=inv.location_id,
            locationName="Central Store",
            variantId=inv.product_variant_id,
            productVariantId=inv.product_variant_id,
            sku=var.sku,
            productName=prod.name,
            variantName=var.name,
            stockOnHand=on_hand,
            availableQty=on_hand - float(inv.reserved_qty or 0),
            reorderPoint=reorder,
            isLowStock=is_low,
            updatedAt=inv.updated_at.isoformat() if inv.updated_at else None
        ))
    return PaginatedResponse(items=items, meta=PageMeta(page=page, limit=limit, total=len(items), totalPages=1), total=len(items))


@router.post("/inventory/adjust", response_model=InventoryItemDto)
async def adjust_inventory(
    input_data: AdjustInventoryInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    valid_types = {"ADJUSTMENT_IN", "ADJUSTMENT_OUT", "DAMAGE", "EXPIRED", "COUNT"}
    if input_data.type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid adjustment type '{input_data.type}'. Allowed: {sorted(valid_types)}"
        )
    if input_data.quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be non-negative"
        )

    # 1. Verify variant exists and belongs to tenant
    var_res = await db.execute(
        select(ProductVariant, Product)
        .join(Product, ProductVariant.product_id == Product.id)
        .where(
            ProductVariant.id == input_data.productVariantId,
            ProductVariant.organization_id == user.organization_id
        )
    )
    var_row = var_res.first()
    if not var_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product variant not found")
    var, prod = var_row

    # 2. Verify location exists and belongs to tenant
    loc_res = await db.execute(
        select(Location).where(
            Location.id == input_data.locationId,
            Location.organization_id == user.organization_id
        )
    )
    loc = loc_res.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    # 3. Find or create InventoryItem
    inv_res = await db.execute(
        select(InventoryItem).where(
            InventoryItem.organization_id == user.organization_id,
            InventoryItem.product_variant_id == input_data.productVariantId,
            InventoryItem.location_id == input_data.locationId
        )
    )
    inv = inv_res.scalar_one_or_none()
    if not inv:
        inv = InventoryItem(
            organization_id=user.organization_id,
            product_variant_id=input_data.productVariantId,
            location_id=input_data.locationId,
            stock_on_hand=Decimal("0.0"),
            reserved_qty=Decimal("0.0"),
            minimum_stock=Decimal("0.0"),
        )
        db.add(inv)
        await db.flush()

    current_qty = Decimal(str(inv.stock_on_hand))
    adj_qty = Decimal(str(input_data.quantity))

    if input_data.type == "ADJUSTMENT_IN":
        new_qty = current_qty + adj_qty
    elif input_data.type in ("ADJUSTMENT_OUT", "DAMAGE", "EXPIRED"):
        new_qty = max(Decimal("0.0"), current_qty - adj_qty)
    elif input_data.type == "COUNT":
        new_qty = adj_qty
    else:
        new_qty = current_qty

    inv.stock_on_hand = new_qty
    inv.updated_at = datetime.datetime.utcnow()

    # 4. Create StockMovement audit record
    movement = StockMovement(
        organization_id=user.organization_id,
        inventory_item_id=inv.id,
        type=input_data.type,
        quantity=adj_qty,
        balance_after=new_qty,
        notes=input_data.notes,
        user_id=user.id,
        created_at=datetime.datetime.utcnow()
    )
    db.add(movement)
    await db.commit()
    await db.refresh(inv)

    on_hand = float(inv.stock_on_hand)
    reorder = float(inv.reorder_point) if inv.reorder_point is not None else 0.0
    return InventoryItemDto(
        id=inv.id,
        organizationId=inv.organization_id,
        locationId=inv.location_id,
        locationName=loc.name,
        variantId=inv.product_variant_id,
        productVariantId=inv.product_variant_id,
        sku=var.sku,
        productName=prod.name,
        variantName=var.name,
        stockOnHand=on_hand,
        availableQty=on_hand - float(inv.reserved_qty or 0),
        reorderPoint=reorder,
        isLowStock=on_hand <= reorder if inv.reorder_point is not None else False,
        updatedAt=inv.updated_at.isoformat() if inv.updated_at else None
    )


@router.get("/inventory/{variant_id}/movements", response_model=List[StockMovementDto])
async def list_movements(
    variant_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(StockMovement)
        .join(InventoryItem, StockMovement.inventory_item_id == InventoryItem.id)
        .where(
            StockMovement.organization_id == user.organization_id,
            InventoryItem.product_variant_id == variant_id
        )
        .order_by(StockMovement.created_at.desc())
        .limit(50)
    )
    res = await db.execute(stmt)
    movements = res.scalars().all()
    return [
        StockMovementDto(
            id=m.id,
            organizationId=m.organization_id,
            inventoryItemId=m.inventory_item_id,
            type=m.type,
            quantity=float(m.quantity),
            balanceAfter=float(m.balance_after),
            referenceType=m.reference_type,
            referenceId=m.reference_id,
            notes=m.notes,
            userId=m.user_id,
            createdAt=m.created_at.isoformat() if m.created_at else None
        )
        for m in movements
    ]
