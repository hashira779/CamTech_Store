from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.modules.catalog.models import ProductVariant, Product

from .models import InventoryItem
from .schemas import InventoryItemDto, PaginatedResponse, PageMeta

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
            availableQty=on_hand,
            reorderPoint=reorder,
            isLowStock=is_low,
            updatedAt=inv.updated_at.isoformat() if inv.updated_at else None
        ))
    return PaginatedResponse(items=items, meta=PageMeta(page=page, limit=limit, total=len(items), totalPages=1), total=len(items))
