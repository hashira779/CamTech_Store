from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from decimal import Decimal

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.domain.hierarchy_engine import HierarchyEngine

from .models import Product, ProductVariant, Category, ProductImage
from .schemas import (
    ProductDto, ProductImageDto, CreateProductInput, UpdateProductInput, VariantDto,
    CategoryDto, CategoryTreeNodeDto, CreateCategoryInput, UpdateCategoryInput,
    PaginatedResponse, PageMeta
)
from app.modules.storage.sync_worker import dispatch_image_sync_job

def build_product_image_dtos(images: Optional[List[ProductImage]]) -> List[ProductImageDto]:
    if not images:
        return []
    sorted_imgs = sorted(images, key=lambda x: (not x.is_primary, x.sort_order))
    dtos = []
    for img in sorted_imgs:
        storage_obj = getattr(img, "storage_object", None)
        if isinstance(storage_obj, (list, tuple)):
            storage_obj = storage_obj[0] if storage_obj else None
            
        sync_status = getattr(storage_obj, "sync_status", "PENDING") if storage_obj else "PENDING"
        thumb_url = getattr(storage_obj, "thumbnail_url", None) if storage_obj else None
        med_url = getattr(storage_obj, "medium_url", None) if storage_obj else None
        lg_url = getattr(storage_obj, "large_url", None) if storage_obj else None
        store_url = getattr(storage_obj, "storage_url", None) if storage_obj else None
        
        if storage_obj and sync_status == "SYNCED" and thumb_url:
            dtos.append(ProductImageDto(
                id=img.id,
                storageObjectId=img.storage_object_id,
                url=store_url or med_url or f"/api/v1/storage/{img.storage_object_id}/download",
                thumbnailUrl=thumb_url,
                mediumUrl=med_url,
                largeUrl=lg_url,
                syncStatus=sync_status,
                isPrimary=img.is_primary,
                sortOrder=img.sort_order,
                altText=img.alt_text,
            ))
        else:
            base_url = f"/api/v1/storage/{img.storage_object_id}/download"
            dtos.append(ProductImageDto(
                id=img.id,
                storageObjectId=img.storage_object_id,
                url=base_url,
                thumbnailUrl=f"{base_url}?thumb=1",
                mediumUrl=base_url,
                largeUrl=base_url,
                syncStatus=sync_status,
                isPrimary=img.is_primary,
                sortOrder=img.sort_order,
                altText=img.alt_text,
            ))
    return dtos

def to_product_dto(p: Product, sanitize_cost: bool = False) -> ProductDto:
    img_dtos = build_product_image_dtos(p.images)
    primary_img = img_dtos[0] if img_dtos else None
    cat = getattr(p, "category", None)
    cat_name = cat.name if cat else None

    return ProductDto(
        id=p.id,
        organizationId=p.organization_id or "default",
        name=p.name,
        description=p.description,
        categoryId=p.category_id,
        categoryName=cat_name,
        brandId=p.brand_id,
        type=str(p.type) if p.type else "PHYSICAL",
        isActive=bool(p.is_active),
        imageUrl=primary_img.url if primary_img else None,
        thumbnailUrl=primary_img.thumbnailUrl if primary_img else None,
        mediumUrl=primary_img.mediumUrl if primary_img else None,
        largeUrl=primary_img.largeUrl if primary_img else None,
        syncStatus=primary_img.syncStatus if primary_img else None,
        variants=[
            VariantDto(
                id=v.id,
                productId=v.product_id,
                sku=v.sku,
                name=v.name,
                barcode=v.barcode,
                unit=v.unit or "piece",
                currency=v.currency or "USD",
                costPrice=0.0 if sanitize_cost else float(v.cost_price or 0),
                sellPrice=float(v.sell_price or 0),
                taxRatePct=float(v.tax_rate_pct or 0),
                marginPct=0.0 if sanitize_cost else (
                    float((v.sell_price - v.cost_price) / v.sell_price * 100)
                    if v.sell_price and v.sell_price > 0 else 0.0
                ),
                isActive=bool(v.is_active)
            ) for v in (p.variants or [])
        ],
        images=img_dtos
    )

router = APIRouter(tags=["Catalog"])

# ==============================================================================
# PRODUCTS
# ==============================================================================

@router.get("/public/products", response_model=PaginatedResponse[ProductDto])
async def list_public_products(
    response: Response,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Public customer storefront catalog endpoint (§161, §228).
    Does not require enterprise login. Sanitizes internal margins/cost prices.
    """
    response.headers["Cache-Control"] = "public, max-age=15, stale-while-revalidate=60"
    stmt = select(Product).options(
        selectinload(Product.variants),
        selectinload(Product.images).selectinload(ProductImage.storage_object),
        selectinload(Product.category)
    )
    if search:
        stmt = stmt.where(Product.name.ilike(f"%{search}%"))
    stmt = stmt.limit(limit).offset((page - 1) * limit)

    result = await db.execute(stmt)
    products = result.scalars().all()
    out = [to_product_dto(p, sanitize_cost=True) for p in products]
    return PaginatedResponse(items=out, meta=PageMeta(page=page, limit=limit, total=len(out), totalPages=1), total=len(out))

@router.get("/products", response_model=PaginatedResponse[ProductDto])
async def list_products(
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Product)
        .where(Product.organization_id == user.organization_id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images).selectinload(ProductImage.storage_object),
            selectinload(Product.category)
        )
    )
    if search:
        stmt = stmt.where(Product.name.ilike(f"%{search}%"))

    safe_limit = min(max(limit, 1), 200)
    safe_offset = max(page - 1, 0) * safe_limit
    stmt = stmt.order_by(Product.name.asc()).limit(safe_limit).offset(safe_offset)

    result = await db.execute(stmt)
    products = result.scalars().all()
    out = [to_product_dto(p) for p in products]
    return PaginatedResponse(items=out, meta=PageMeta(page=page, limit=limit, total=len(out), totalPages=1), total=len(out))

@router.post("/products", response_model=ProductDto)
async def create_product(
    input_data: CreateProductInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    product = Product(
        organization_id=user.organization_id,
        name=input_data.name,
        description=input_data.description,
        category_id=input_data.categoryId,
        brand_id=input_data.brandId,
        type=input_data.type or "PHYSICAL",
        is_active=input_data.isActive if input_data.isActive is not None else True
    )
    db.add(product)
    await db.flush()

    variants = []
    for v_in in input_data.variants:
        v = ProductVariant(
            organization_id=user.organization_id,
            product_id=product.id,
            sku=v_in.sku,
            name=v_in.name or input_data.name,
            barcode=v_in.barcode,
            unit=v_in.unit or "piece",
            currency=v_in.currency or "USD",
            cost_price=Decimal(str(v_in.costPrice)),
            sell_price=Decimal(str(v_in.sellPrice)),
            tax_rate_pct=Decimal(str(v_in.taxRatePct)),
            is_active=v_in.isActive if v_in.isActive is not None else True
        )
        db.add(v)
        variants.append(v)

    await db.commit()

    # Re-query with eager loads
    stmt = (
        select(Product)
        .where(Product.id == product.id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images).selectinload(ProductImage.storage_object),
            selectinload(Product.category)
        )
    )
    p = (await db.execute(stmt)).scalar_one()
    return to_product_dto(p)

@router.get("/products/{product_id}", response_model=ProductDto)
async def get_product(
    product_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Product)
        .where(Product.id == product_id, Product.organization_id == user.organization_id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images).selectinload(ProductImage.storage_object),
            selectinload(Product.category)
        )
    )
    result = await db.execute(stmt)
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    return to_product_dto(p)

@router.patch("/products/{product_id}", response_model=ProductDto)
@router.put("/products/{product_id}", response_model=ProductDto)
async def update_product(
    product_id: str,
    input_data: UpdateProductInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update master product details and/or variant attributes."""
    stmt = (
        select(Product)
        .where(Product.id == product_id, Product.organization_id == user.organization_id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images).selectinload(ProductImage.storage_object),
            selectinload(Product.category)
        )
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update master fields
    if input_data.name is not None:
        product.name = input_data.name
    if input_data.description is not None:
        product.description = input_data.description
    if input_data.categoryId is not None:
        product.category_id = input_data.categoryId if input_data.categoryId else None
    if input_data.brandId is not None:
        product.brand_id = input_data.brandId if input_data.brandId else None
    if input_data.type is not None:
        product.type = input_data.type
    if input_data.isActive is not None:
        product.is_active = input_data.isActive

    # Update or add variants
    if input_data.variants is not None:
        existing_variants = {v.id: v for v in product.variants}
        for v_in in input_data.variants:
            if v_in.id and v_in.id in existing_variants:
                v = existing_variants[v_in.id]
                if v_in.sku is not None:
                    v.sku = v_in.sku
                if v_in.name is not None:
                    v.name = v_in.name
                if v_in.barcode is not None:
                    v.barcode = v_in.barcode
                if v_in.unit is not None:
                    v.unit = v_in.unit
                if v_in.currency is not None:
                    v.currency = v_in.currency
                if v_in.costPrice is not None:
                    v.cost_price = Decimal(str(v_in.costPrice))
                if v_in.sellPrice is not None:
                    v.sell_price = Decimal(str(v_in.sellPrice))
                if v_in.taxRatePct is not None:
                    v.tax_rate_pct = Decimal(str(v_in.taxRatePct))
                if v_in.isActive is not None:
                    v.is_active = v_in.isActive
            elif not v_in.id and v_in.sku:
                # Create new variant
                new_v = ProductVariant(
                    organization_id=user.organization_id,
                    product_id=product.id,
                    sku=v_in.sku,
                    name=v_in.name or product.name,
                    barcode=v_in.barcode,
                    unit=v_in.unit or "piece",
                    currency=v_in.currency or "USD",
                    cost_price=Decimal(str(v_in.costPrice or 0)),
                    sell_price=Decimal(str(v_in.sellPrice or 0)),
                    tax_rate_pct=Decimal(str(v_in.taxRatePct or 0)),
                    is_active=v_in.isActive if v_in.isActive is not None else True
                )
                db.add(new_v)

    await db.commit()

    # Re-fetch fresh entity
    stmt_fresh = (
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images).selectinload(ProductImage.storage_object),
            selectinload(Product.category)
        )
    )
    p_fresh = (await db.execute(stmt_fresh)).scalar_one()
    return to_product_dto(p_fresh)

@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete product or soft-archive if historical transactions exist (§GoldenRule 9)."""
    stmt = (
        select(Product)
        .where(Product.id == product_id, Product.organization_id == user.organization_id)
        .options(selectinload(Product.variants))
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    variant_ids = [v.id for v in product.variants]
    has_transactions = False

    if variant_ids:
        check_sql = text("""
            SELECT 1 FROM (
                SELECT "productVariantId" FROM sale_line_items WHERE "productVariantId" = ANY(:vids)
                UNION ALL
                SELECT "productVariantId" FROM purchase_order_line_items WHERE "productVariantId" = ANY(:vids)
                UNION ALL
                SELECT "productVariantId" FROM goods_receipt_line_items WHERE "productVariantId" = ANY(:vids)
                UNION ALL
                SELECT "productVariantId" FROM stock_transfer_lines WHERE "productVariantId" = ANY(:vids)
            ) t LIMIT 1
        """)
        has_transactions = bool((await db.execute(check_sql, {"vids": variant_ids})).scalar())

    if has_transactions:
        # Soft-archive / deactivate to preserve historical audit trail
        product.is_active = False
        for v in product.variants:
            v.is_active = False
        await db.commit()
        return {
            "deleted": True,
            "archived": True,
            "id": product_id,
            "message": "Product has existing transaction history and has been deactivated/archived to preserve ledger integrity."
        }
    else:
        # Hard delete
        await db.delete(product)
        await db.commit()
        return {
            "deleted": True,
            "archived": False,
            "id": product_id,
            "message": "Product deleted successfully."
        }

# ==============================================================================
# PRODUCT IMAGES
# ==============================================================================

from .models import ProductImage
from .schemas import ProductImageDto, AddProductImageInput, ReorderImagesInput

@router.post("/products/{product_id}/images", response_model=ProductImageDto)
async def add_product_image(
    product_id: str,
    data: AddProductImageInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify product exists
    prod_res = await db.execute(
        select(Product).where(Product.id == product_id, Product.organization_id == user.organization_id)
    )
    if not prod_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    # Get max sort_order
    order_res = await db.execute(
        select(ProductImage.sort_order)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.sort_order.desc())
        .limit(1)
    )
    max_order = order_res.scalar_one_or_none() or 0
    is_primary = data.isPrimary or max_order == 0

    if is_primary:
        await db.execute(
            text("UPDATE product_images SET \"isPrimary\" = false WHERE \"productId\" = :pid"),
            {"pid": product_id}
        )

    img = ProductImage(
        organization_id=user.organization_id,
        product_id=product_id,
        storage_object_id=data.storageObjectId,
        is_primary=is_primary,
        alt_text=data.altText,
        sort_order=max_order + 1
    )
    db.add(img)
    await db.commit()
    await db.refresh(img)
    
    # Enqueue background sync to Cloudflare R2 / CDN
    try:
        await dispatch_image_sync_job(
            image_id=data.storageObjectId,
            entity_type="product",
            entity_id=product_id
        )
    except Exception as exc:
        pass

    base_url = f"/api/v1/storage/{img.storage_object_id}/download"
    return {
        "id": img.id,
        "storageObjectId": img.storage_object_id,
        "url": base_url,
        "thumbnailUrl": f"{base_url}?thumb=1",
        "mediumUrl": base_url,
        "largeUrl": base_url,
        "syncStatus": "PENDING",
        "isPrimary": img.is_primary,
        "sortOrder": img.sort_order,
        "altText": img.alt_text
    }

@router.delete("/products/{product_id}/images/{image_id}")
async def delete_product_image(
    product_id: str,
    image_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(ProductImage).where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
            ProductImage.organization_id == user.organization_id
        )
    )
    img = res.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Product image not found")
        
    await db.delete(img)
    await db.commit()
    return {"success": True}

@router.patch("/products/{product_id}/images/{image_id}/primary")
async def set_primary_product_image(
    product_id: str,
    image_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(ProductImage).where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
            ProductImage.organization_id == user.organization_id
        )
    )
    img = res.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Product image not found")
        
    await db.execute(
        f"UPDATE product_images SET \"isPrimary\" = false WHERE \"productId\" = '{product_id}'"
    )
    
    img.is_primary = True
    await db.commit()
    return {"success": True}

@router.patch("/products/{product_id}/images/reorder")
async def reorder_product_images(
    product_id: str,
    data: ReorderImagesInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(ProductImage).where(
            ProductImage.product_id == product_id,
            ProductImage.organization_id == user.organization_id
        )
    )
    images = res.scalars().all()
    img_map = {i.id: i for i in images}
    
    for idx, i_id in enumerate(data.imageIds):
        if i_id in img_map:
            img_map[i_id].sort_order = idx
            
    await db.commit()
    return {"success": True}

# ==============================================================================
# CATEGORIES
# ==============================================================================

@router.get("/categories", response_model=List[CategoryDto])
async def list_categories(
    parentId: Optional[str] = None,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Category).where(Category.organization_id == user.organization_id)
    if parentId is not None:
        if parentId == "" or parentId.lower() == "null":
            stmt = stmt.where(Category.parent_id.is_(None))
        else:
            stmt = stmt.where(Category.parent_id == parentId)

    result = await db.execute(stmt)
    categories = result.scalars().all()

    all_cat_res = await db.execute(select(Category).where(Category.organization_id == user.organization_id))
    all_cats = all_cat_res.scalars().all()
    children_counts: Dict[str, int] = {}
    for c in all_cats:
        if c.parent_id:
            children_counts[c.parent_id] = children_counts.get(c.parent_id, 0) + 1

    return [
        CategoryDto(
            id=c.id,
            organizationId=c.organization_id,
            parentId=c.parent_id,
            name=c.name,
            description=c.description,
            createdAt=c.created_at.isoformat() if c.created_at else None,
            childrenCount=children_counts.get(c.id, 0)
        )
        for c in categories
    ]

@router.get("/categories/tree", response_model=List[CategoryTreeNodeDto])
async def get_categories_tree(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Category).where(Category.organization_id == user.organization_id)
    )
    categories = result.scalars().all()

    dict_items = [
        {
            "id": c.id,
            "organizationId": c.organization_id,
            "parentId": c.parent_id,
            "name": c.name,
            "description": c.description,
        }
        for c in categories
    ]

    return HierarchyEngine.build_tree(
        dict_items,
        id_key="id",
        parent_key="parentId",
        children_key="children",
        sort_by="name"
    )

@router.post("/categories", response_model=CategoryDto)
async def create_category(
    cat_in: CreateCategoryInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if cat_in.parentId:
        p_res = await db.execute(
            select(Category).where(
                Category.id == cat_in.parentId,
                Category.organization_id == user.organization_id
            )
        )
        if not p_res.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent category not found")

    cat = Category(
        organization_id=user.organization_id,
        name=cat_in.name,
        description=cat_in.description,
        parent_id=cat_in.parentId
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryDto(
        id=cat.id,
        organizationId=cat.organization_id,
        parentId=cat.parent_id,
        name=cat.name,
        description=cat.description,
        createdAt=cat.created_at.isoformat() if cat.created_at else None,
        childrenCount=0
    )

@router.patch("/categories/{category_id}", response_model=CategoryDto)
@router.put("/categories/{category_id}", response_model=CategoryDto)
async def update_category(
    category_id: str,
    cat_in: UpdateCategoryInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            Category.organization_id == user.organization_id
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if cat_in.parentId is not None and cat_in.parentId != cat.parent_id:
        all_res = await db.execute(
            select(Category).where(Category.organization_id == user.organization_id)
        )
        parent_map = {c.id: c.parent_id for c in all_res.scalars().all()}
        if HierarchyEngine.has_circular_dependency(parent_map, category_id, cat_in.parentId):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Circular category dependency detected: A category cannot be set as child of itself or its descendants"
            )
        cat.parent_id = cat_in.parentId

    if cat_in.name is not None:
        cat.name = cat_in.name
    if cat_in.description is not None:
        cat.description = cat_in.description

    await db.commit()
    await db.refresh(cat)
    return CategoryDto(
        id=cat.id,
        organizationId=cat.organization_id,
        parentId=cat.parent_id,
        name=cat.name,
        description=cat.description,
        createdAt=cat.created_at.isoformat() if cat.created_at else None,
        childrenCount=0
    )

@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            Category.organization_id == user.organization_id
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    child_check = await db.execute(
        select(Category).where(
            Category.parent_id == category_id,
            Category.organization_id == user.organization_id
        )
    )
    if child_check.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete category with active child categories"
        )

    await db.delete(cat)
    await db.commit()
    return {"deleted": True, "id": category_id}
