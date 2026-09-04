from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from decimal import Decimal

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.domain.hierarchy_engine import HierarchyEngine

from .models import Product, ProductVariant, Category
from .schemas import (
    ProductDto, CreateProductInput, VariantDto,
    CategoryDto, CategoryTreeNodeDto, CreateCategoryInput, UpdateCategoryInput,
    PaginatedResponse, PageMeta
)

router = APIRouter(tags=["Catalog"])

# ==============================================================================
# PRODUCTS
# ==============================================================================

@router.get("/public/products", response_model=PaginatedResponse[ProductDto])
async def list_public_products(
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Public customer storefront catalog endpoint (§161, §228).
    Does not require enterprise login. Sanitizes internal margins/cost prices.
    """
    stmt = select(Product).options(selectinload(Product.variants))
    if search:
        stmt = stmt.where(Product.name.ilike(f"%{search}%"))
    stmt = stmt.limit(limit).offset((page - 1) * limit)

    result = await db.execute(stmt)
    products = result.scalars().all()

    out = []
    for p in products:
        out.append(ProductDto(
            id=p.id,
            organizationId=p.organization_id or "default",
            name=p.name,
            description=p.description,
            categoryId=p.category_id,
            brandId=p.brand_id,
            type="PHYSICAL",
            isActive=True,
            variants=[
                VariantDto(
                    id=v.id,
                    productId=v.product_id,
                    sku=v.sku,
                    name=v.name,
                    barcode=v.barcode,
                    unit="piece",
                    currency="USD",
                    costPrice=0.0,
                    sellPrice=float(v.sell_price),
                    taxRatePct=float(v.tax_rate_pct),
                    marginPct=0.0,
                    isActive=True
                ) for v in p.variants
            ]
        ))
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
        .options(selectinload(Product.variants))
    )
    if search:
        stmt = stmt.where(Product.name.ilike(f"%{search}%"))

    result = await db.execute(stmt)
    products = result.scalars().all()

    out = []
    for p in products:
        out.append(ProductDto(
            id=p.id,
            organizationId=p.organization_id,
            name=p.name,
            description=p.description,
            categoryId=p.category_id,
            brandId=p.brand_id,
            type="PHYSICAL",
            isActive=True,
            variants=[
                VariantDto(
                    id=v.id,
                    productId=v.product_id,
                    sku=v.sku,
                    name=v.name,
                    barcode=v.barcode,
                    unit="piece",
                    currency="USD",
                    costPrice=float(v.cost_price),
                    sellPrice=float(v.sell_price),
                    taxRatePct=float(v.tax_rate_pct),
                    marginPct=float((v.sell_price - v.cost_price) / v.sell_price * 100) if v.sell_price > 0 else 0.0,
                    isActive=True
                ) for v in p.variants
            ]
        ))
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
        brand_id=input_data.brandId
    )
    db.add(product)
    await db.flush()

    variants = []
    for v_in in input_data.variants:
        v = ProductVariant(
            organization_id=user.organization_id,
            product_id=product.id,
            sku=v_in.sku,
            name=v_in.name,
            barcode=v_in.barcode,
            cost_price=Decimal(str(v_in.costPrice)),
            sell_price=Decimal(str(v_in.sellPrice)),
            tax_rate_pct=Decimal(str(v_in.taxRatePct))
        )
        db.add(v)
        variants.append(v)

    await db.commit()
    await db.refresh(product)

    return ProductDto(
        id=product.id,
        organizationId=product.organization_id,
        name=product.name,
        description=product.description,
        categoryId=product.category_id,
        brandId=product.brand_id,
        type="PHYSICAL",
        isActive=True,
        variants=[
            VariantDto(
                id=v.id,
                productId=v.product_id,
                sku=v.sku,
                name=v.name,
                barcode=v.barcode,
                unit="piece",
                currency="USD",
                costPrice=float(v.cost_price),
                sellPrice=float(v.sell_price),
                taxRatePct=float(v.tax_rate_pct),
                marginPct=float((v.sell_price - v.cost_price) / v.sell_price * 100) if v.sell_price > 0 else 0.0,
                isActive=True
            ) for v in variants
        ]
    )

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
