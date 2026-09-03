import json
import datetime
import secrets
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    decode_refresh_token, generate_totp_secret, verify_totp_code,
    get_totp_uri
)
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import (
    User, Organization, Product, ProductVariant, InventoryItem, Location,
    Category, Sale, SaleLineItem, SalePayment, Customer, Account, JournalEntry,
    JournalLine, FixedAsset, ServiceTicket, DeveloperApp, ApiKey,
    TelegramChatBinding, AutomationFlow, FlowExecution
)
from app.schemas.dto import (
    LoginRequest, LoginResponse, RefreshTokenRequest, TokenResponse,
    OrganizationDto, UpdateOrganizationInput,
    UserDto, ProductDto, CreateProductInput,
    InventoryItemDto, LocationDto, CreateLocationInput, UpdateLocationInput, LocationTreeNodeDto,
    CategoryDto, CreateCategoryInput, UpdateCategoryInput, CategoryTreeNodeDto,
    SaleDto, CreateSaleInput, CustomerDto,
    CreateCustomerInput, AutomationFlowDto, CreateFlowInput, FlowExecutionDto,
    PaginatedResponse, VariantDto, PageMeta
)
from app.domain.hierarchy_engine import HierarchyEngine
from app.domain.enterprise_engines import FlowExecutionEngine, ApiKeyGenerator, TelegramCommandRouter
from app.domain.commerce_engines import KhqrGenerator


router = APIRouter()

# ==============================================================================
# 1. AUTHENTICATION & PROFILE
# ==============================================================================

@router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    roles = json.loads(user.roles) if isinstance(user.roles, str) else (user.roles or ["CASHIER"])
    token = create_access_token({"sub": user.id, "orgId": user.organization_id, "roles": roles})
    refresh_token = create_refresh_token({"sub": user.id, "orgId": user.organization_id})

    # Default full permissions for admins and operators
    permissions = [
        "products.read", "products.write", "customers.read", "customers.write",
        "sales.read", "sales.write", "sales.void", "sales.refund",
        "inventory.read", "inventory.adjust", "locations.read", "locations.write",
        "organizations.read", "organizations.write", "procurement.read", "procurement.write",
        "promotions.read", "promotions.write", "pricing.read", "pricing.write",
        "payments.read", "taxes.read", "taxes.write", "loyalty.read", "loyalty.write",
        "storage.read", "storage.write", "notifications.read", "notifications.write",
        "reports.read", "reports.export", "finance.read", "finance.write", "journal.post",
        "workflow.read", "workflow.manage", "workflow.approve", "hr.read", "hr.write",
        "payroll.run", "assets.read", "assets.write", "projects.read", "projects.write",
        "tickets.read", "tickets.write", "developer.read", "developer.write",
        "webhooks.manage", "telegram.manage", "automation.read", "automation.write", "automation.execute"
    ]

    return LoginResponse(
        accessToken=token,
        refreshToken=refresh_token,
        user=UserDto(
            id=user.id,
            organizationId=user.organization_id,
            email=user.email,
            name=user.name,
            roles=roles,
            permissions=permissions,
            locationId=user.location_id
        )
    )

@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_refresh_token(req.refreshToken)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    roles = json.loads(user.roles) if isinstance(user.roles, str) else (user.roles or ["CASHIER"])
    new_access_token = create_access_token({"sub": user.id, "orgId": user.organization_id, "roles": roles})
    new_refresh_token = create_refresh_token({"sub": user.id, "orgId": user.organization_id})

    return TokenResponse(
        accessToken=new_access_token,
        refreshToken=new_refresh_token,
        tokenType="bearer"
    )

@router.post("/auth/mfa/setup")
async def mfa_setup(user: TenantUser = Depends(get_current_user)):
    """Generate RFC 6238 TOTP MFA secret and configuration URI (§66)."""
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, user.email, issuer="MyStore")
    return {
        "secret": secret,
        "otpauthUri": uri,
        "instructions": "Scan QR code or enter secret in Google Authenticator or 1Password"
    }

@router.post("/auth/mfa/verify")
async def mfa_verify(
    payload: Dict[str, str],
    user: TenantUser = Depends(get_current_user)
):
    """Verify 6-digit TOTP code against secret (§66)."""
    secret = payload.get("secret", "")
    code = payload.get("code", "")
    if not secret or not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both secret and code are required",
        )
    is_valid = verify_totp_code(secret, code)
    return {"valid": is_valid}


@router.get("/auth/me", response_model=UserDto)
async def get_me(user: TenantUser = Depends(get_current_user)):
    permissions = [
        "products.read", "products.write", "customers.read", "customers.write",
        "sales.read", "sales.write", "inventory.read", "inventory.adjust",
        "locations.read", "reports.read", "automation.read", "automation.write"
    ]
    return UserDto(
        id=user.id,
        organizationId=user.organization_id,
        email=user.email,
        name=user.name,
        roles=user.roles,
        permissions=permissions,
        locationId=user.location_id
    )

# ==============================================================================
# 2. PRODUCT CATALOG
# ==============================================================================

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
# 3. LOCATIONS & INVENTORY
# ==============================================================================

@router.get("/organizations/current", response_model=OrganizationDto)
async def get_current_organization(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Organization).where(Organization.id == user.organization_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return OrganizationDto(
        id=org.id,
        name=org.name,
        slug=org.slug,
        currency=org.currency,
        timezone=org.timezone,
        taxRatePct=float(org.tax_rate_pct),
        businessType=org.business_type,
        settings=org.settings
    )

@router.put("/organizations/current", response_model=OrganizationDto)
async def update_current_organization(
    org_in: UpdateOrganizationInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Organization).where(Organization.id == user.organization_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    if org_in.name is not None:
        org.name = org_in.name
    if org_in.currency is not None:
        org.currency = org_in.currency
    if org_in.timezone is not None:
        org.timezone = org_in.timezone
    if org_in.taxRatePct is not None:
        org.tax_rate_pct = Decimal(str(org_in.taxRatePct))
    if org_in.businessType is not None:
        org.business_type = org_in.businessType
    if org_in.settings is not None:
        org.settings = org_in.settings

    await db.commit()
    await db.refresh(org)
    return OrganizationDto(
        id=org.id,
        name=org.name,
        slug=org.slug,
        currency=org.currency,
        timezone=org.timezone,
        taxRatePct=float(org.tax_rate_pct),
        businessType=org.business_type,
        settings=org.settings
    )

@router.get("/locations", response_model=PaginatedResponse[LocationDto])
async def list_locations(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    type: Optional[str] = None,
    parentId: Optional[str] = None,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Location).where(Location.organization_id == user.organization_id)
    if search:
        stmt = stmt.where(Location.name.ilike(f"%{search}%") | Location.code.ilike(f"%{search}%"))
    if type:
        stmt = stmt.where(Location.type == type.upper())
    if parentId is not None:
        if parentId == "" or parentId.lower() == "null":
            stmt = stmt.where(Location.parent_id.is_(None))
        else:
            stmt = stmt.where(Location.parent_id == parentId)

    result = await db.execute(stmt)
    all_locations = result.scalars().all()

    # Pre-fetch all locations in tenant to compute parent info & children count accurately
    all_tenant_res = await db.execute(select(Location).where(Location.organization_id == user.organization_id))
    tenant_locs = {l.id: l for l in all_tenant_res.scalars().all()}

    children_counts: Dict[str, int] = {}
    for l in tenant_locs.values():
        if l.parent_id:
            children_counts[l.parent_id] = children_counts.get(l.parent_id, 0) + 1

    total = len(all_locations)
    offset = (page - 1) * limit
    paged = all_locations[offset:offset + limit]

    items = []
    for loc in paged:
        parent_summary = None
        if loc.parent_id and loc.parent_id in tenant_locs:
            p_obj = tenant_locs[loc.parent_id]
            parent_summary = {
                "id": p_obj.id,
                "name": p_obj.name,
                "type": p_obj.type
            }

        items.append(LocationDto(
            id=loc.id,
            organizationId=loc.organization_id,
            parentId=loc.parent_id,
            type=loc.type,
            name=loc.name,
            code=loc.code,
            isActive=True,
            createdAt=loc.created_at.isoformat() if loc.created_at else None,
            updatedAt=loc.updated_at.isoformat() if loc.updated_at else None,
            parent=parent_summary,
            childrenCount=children_counts.get(loc.id, 0)
        ))

    total_pages = max(1, (total + limit - 1) // limit)
    return PaginatedResponse(
        items=items,
        total=total,
        meta=PageMeta(page=page, limit=limit, total=total, totalPages=total_pages)
    )

@router.get("/locations/tree", response_model=List[LocationTreeNodeDto])
async def get_locations_tree(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(Location.organization_id == user.organization_id)
    )
    locations = result.scalars().all()

    dict_items = [
        {
            "id": loc.id,
            "organizationId": loc.organization_id,
            "parentId": loc.parent_id,
            "type": loc.type,
            "name": loc.name,
            "code": loc.code,
            "createdAt": loc.created_at.isoformat() if loc.created_at else None,
        }
        for loc in locations
    ]

    tree = HierarchyEngine.build_tree(
        dict_items,
        id_key="id",
        parent_key="parentId",
        children_key="children",
        sort_by="name"
    )
    return tree

@router.get("/locations/{location_id}/breadcrumbs")
async def get_location_breadcrumbs(
    location_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(Location.organization_id == user.organization_id)
    )
    locations = result.scalars().all()
    items_map = {
        loc.id: {
            "id": loc.id,
            "name": loc.name,
            "code": loc.code,
            "type": loc.type,
            "parentId": loc.parent_id
        }
        for loc in locations
    }

    if location_id not in items_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    path = HierarchyEngine.get_ancestor_path(items_map, location_id, parent_key="parentId")
    return {"locationId": location_id, "breadcrumbs": path}

@router.get("/locations/{location_id}/descendants")
async def get_location_descendants(
    location_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(Location.organization_id == user.organization_id)
    )
    locations = result.scalars().all()

    children_map: Dict[str, List[str]] = {}
    for loc in locations:
        if loc.parent_id:
            children_map.setdefault(loc.parent_id, []).append(loc.id)

    descendants = HierarchyEngine.get_descendant_ids(children_map, location_id)
    return {"locationId": location_id, "descendantIds": list(descendants), "count": len(descendants)}

@router.post("/locations", response_model=LocationDto)
async def create_location(
    loc_in: CreateLocationInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    parent_loc = None
    if loc_in.parentId:
        p_res = await db.execute(
            select(Location).where(
                Location.id == loc_in.parentId,
                Location.organization_id == user.organization_id
            )
        )
        parent_loc = p_res.scalar_one_or_none()
        if not parent_loc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parent location not found: {loc_in.parentId}"
            )

        if not HierarchyEngine.validate_type_hierarchy(parent_loc.type, loc_in.type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid hierarchy: A '{loc_in.type}' cannot be nested directly under a '{parent_loc.type}'"
            )

    if loc_in.code:
        code_check = await db.execute(
            select(Location).where(
                Location.organization_id == user.organization_id,
                Location.code == loc_in.code
            )
        )
        if code_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Location with code '{loc_in.code}' already exists"
            )

    loc = Location(
        organization_id=user.organization_id,
        name=loc_in.name,
        code=loc_in.code,
        type=loc_in.type.upper(),
        parent_id=loc_in.parentId
    )
    db.add(loc)
    await db.commit()
    await db.refresh(loc)

    parent_summary = None
    if parent_loc:
        parent_summary = {"id": parent_loc.id, "name": parent_loc.name, "type": parent_loc.type}

    return LocationDto(
        id=loc.id,
        organizationId=loc.organization_id,
        parentId=loc.parent_id,
        type=loc.type,
        name=loc.name,
        code=loc.code,
        isActive=True,
        createdAt=loc.created_at.isoformat() if loc.created_at else None,
        updatedAt=loc.updated_at.isoformat() if loc.updated_at else None,
        parent=parent_summary,
        childrenCount=0
    )

@router.patch("/locations/{location_id}", response_model=LocationDto)
@router.put("/locations/{location_id}", response_model=LocationDto)
async def update_location(
    location_id: str,
    loc_in: UpdateLocationInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.organization_id == user.organization_id
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    if loc_in.parentId is not None and loc_in.parentId != loc.parent_id:
        all_res = await db.execute(
            select(Location).where(Location.organization_id == user.organization_id)
        )
        all_locs = all_res.scalars().all()
        parent_map = {l.id: l.parent_id for l in all_locs}

        if HierarchyEngine.has_circular_dependency(parent_map, location_id, loc_in.parentId):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Circular hierarchy dependency detected: A location cannot be set as a child of itself or its descendants"
            )

        if loc_in.parentId:
            parent_node = next((l for l in all_locs if l.id == loc_in.parentId), None)
            target_type = loc_in.type or loc.type
            if parent_node and not HierarchyEngine.validate_type_hierarchy(parent_node.type, target_type):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid hierarchy: '{target_type}' cannot be nested under '{parent_node.type}'"
                )

        loc.parent_id = loc_in.parentId

    if loc_in.name is not None:
        loc.name = loc_in.name
    if loc_in.code is not None:
        loc.code = loc_in.code
    if loc_in.type is not None:
        loc.type = loc_in.type.upper()

    await db.commit()
    await db.refresh(loc)

    parent_summary = None
    if loc.parent_id:
        p_res = await db.execute(select(Location).where(Location.id == loc.parent_id))
        p_obj = p_res.scalar_one_or_none()
        if p_obj:
            parent_summary = {"id": p_obj.id, "name": p_obj.name, "type": p_obj.type}

    child_cnt_res = await db.execute(
        select(Location).where(
            Location.parent_id == loc.id,
            Location.organization_id == user.organization_id
        )
    )
    children_count = len(child_cnt_res.scalars().all())

    return LocationDto(
        id=loc.id,
        organizationId=loc.organization_id,
        parentId=loc.parent_id,
        type=loc.type,
        name=loc.name,
        code=loc.code,
        isActive=True,
        createdAt=loc.created_at.isoformat() if loc.created_at else None,
        updatedAt=loc.updated_at.isoformat() if loc.updated_at else None,
        parent=parent_summary,
        childrenCount=children_count
    )

@router.delete("/locations/{location_id}")
async def delete_location(
    location_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.organization_id == user.organization_id
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    child_check = await db.execute(
        select(Location).where(
            Location.parent_id == location_id,
            Location.organization_id == user.organization_id
        )
    )
    if child_check.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete location with child sub-locations"
        )

    await db.delete(loc)
    await db.commit()
    return {"deleted": True, "id": location_id}

# ==============================================================================
# CATEGORY HIERARCHY (Catalog Taxonomy)
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
        .join(ProductVariant, InventoryItem.variant_id == ProductVariant.id)
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
        reorder = float(inv.reorder_point)
        if lowStockOnly and on_hand > reorder:
            continue
        items.append(InventoryItemDto(
            id=inv.id,
            organizationId=inv.organization_id,
            locationId=inv.location_id,
            locationName="Central Store",
            variantId=inv.variant_id,
            productVariantId=inv.variant_id,
            sku=var.sku,
            productName=prod.name,
            variantName=var.name,
            stockOnHand=on_hand,
            availableQty=on_hand,
            reorderPoint=reorder
        ))
    return PaginatedResponse(items=items, total=len(items), page=page, limit=limit, totalPages=1)

# ==============================================================================
# 4. SALES & POS CHECKOUT
# ==============================================================================

@router.get("/sales", response_model=PaginatedResponse[SaleDto])
async def list_sales(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Sale)
        .where(Sale.organization_id == user.organization_id)
        .options(selectinload(Sale.line_items), selectinload(Sale.payments))
        .order_by(desc(Sale.created_at))
        .limit(50)
    )
    result = await db.execute(stmt)
    sales = result.scalars().all()

    out = []
    for s in sales:
        out.append(SaleDto(
            id=s.id,
            saleNumber=s.sale_number,
            channel=s.channel,
            status=s.status,
            subtotal=float(s.subtotal),
            taxTotal=float(s.tax_total),
            discountTotal=float(s.discount_total),
            grandTotal=float(s.grand_total),
            currency=s.currency,
            itemCount=s.item_count,
            customerName=s.customer_name,
            paymentStatus=s.payment_status,
            createdAt=s.created_at.isoformat(),
            lineItems=[
                {
                    "id": li.id,
                    "variantId": li.variant_id,
                    "sku": li.sku,
                    "name": li.name,
                    "quantity": float(li.quantity),
                    "unitPrice": float(li.unit_price),
                    "taxRatePct": float(li.tax_rate_pct),
                    "lineTotal": float(li.line_total)
                } for li in s.line_items
            ],
            payments=[
                {
                    "id": p.id,
                    "amount": float(p.amount),
                    "method": p.method,
                    "status": p.status,
                    "reference": p.reference
                } for p in s.payments
            ]
        ))
    return PaginatedResponse(items=out, total=len(out), page=1, limit=50, totalPages=1)

@router.post("/sales", response_model=SaleDto)
async def create_sale(
    sale_in: CreateSaleInput,
    request: Request,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    x_idempotency_key_header: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Idempotency Key Handling (§104)
    idempotency_key = sale_in.idempotencyKey or idempotency_key_header or x_idempotency_key_header
    if idempotency_key:
        existing_stmt = (
            select(Sale)
            .where(
                Sale.organization_id == user.organization_id,
                Sale.idempotency_key == idempotency_key
            )
            .options(selectinload(Sale.line_items), selectinload(Sale.payments))
        )
        existing_res = await db.execute(existing_stmt)
        existing_sale = existing_res.scalar_one_or_none()
        if existing_sale:
            # Return previously created sale without re-processing
            return SaleDto(
                id=existing_sale.id,
                idempotencyKey=existing_sale.idempotency_key,
                saleNumber=existing_sale.sale_number,
                channel=existing_sale.channel,
                status=existing_sale.status,
                subtotal=float(existing_sale.subtotal),
                taxTotal=float(existing_sale.tax_total),
                discountTotal=float(existing_sale.discount_total),
                grandTotal=float(existing_sale.grand_total),
                currency=existing_sale.currency,
                itemCount=len(existing_sale.line_items),
                customerName=sale_in.customerName,
                paymentStatus="PAID" if existing_sale.payments else "PENDING",
                createdAt=existing_sale.created_at.isoformat(),
                lineItems=[
                    SaleLineItemDto(
                        id=li.id,
                        variantId=li.product_variant_id,
                        sku=li.sku,
                        name=li.product_name,
                        quantity=float(li.quantity),
                        unitPrice=float(li.unit_price),
                        taxRatePct=float(li.tax_rate_pct),
                        lineTotal=float(li.line_total)
                    ) for li in existing_sale.line_items
                ],
                payments=[
                    SalePaymentDto(
                        id=p.id,
                        amount=float(p.amount),
                        method=p.method,
                        status=p.status,
                        reference=p.reference
                    ) for p in existing_sale.payments
                ]
            )

    sale_num = f"ORD-{datetime.datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    location_id = sale_in.locationId or user.location_id or "loc_main"

    if not sale_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A sale must contain at least one item",
        )

    # Load authoritative variant data (price, tax, sku, name) from the DB,
    # scoped to the caller's organization. Client-supplied unitPrice/taxRatePct
    # are IGNORED — prices are never trusted from the client (spec §66, §106).
    variant_ids = [item.variantId for item in sale_in.items]
    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.organization_id == user.organization_id,
            ProductVariant.id.in_(variant_ids),
        )
    )
    variants = {v.id: v for v in result.scalars().all()}

    subtotal = Decimal('0.0')
    tax_total = Decimal('0.0')
    line_entities = []

    for item in sale_in.items:
        variant = variants.get(item.variantId)
        if variant is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown or inaccessible product variant: {item.variantId}",
            )

        qty = Decimal(str(item.quantity))
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quantity must be positive for variant {item.variantId}",
            )

        price = Decimal(str(variant.sell_price))
        tax_pct = Decimal(str(variant.tax_rate_pct))

        line_sub = (qty * price).quantize(Decimal('0.01'))
        line_tax = (line_sub * (tax_pct / Decimal('100.0'))).quantize(Decimal('0.01'))
        line_tot = line_sub + line_tax

        subtotal += line_sub
        tax_total += line_tax

        line_entities.append(SaleLineItem(
            product_variant_id=variant.id,
            sku=variant.sku,
            product_name=variant.name or variant.sku,
            variant_name=variant.name,
            quantity=qty,
            unit_price=price,
            discount=Decimal('0.0'),
            tax_rate_pct=tax_pct,
            tax_amount=line_tax,
            line_total=line_tot
        ))

    grand_total = subtotal + tax_total

    sale = Sale(
        organization_id=user.organization_id,
        location_id=location_id,
        user_id=user.id,
        idempotency_key=idempotency_key,
        sale_number=sale_num,
        channel=sale_in.channel,
        status="COMPLETED",
        subtotal=subtotal,
        tax_total=tax_total,
        discount_total=Decimal('0.0'),
        grand_total=grand_total,
        currency=sale_in.currency,
        customer_id=sale_in.customerId,
        line_items=line_entities
    )

    for p_in in sale_in.payments:
        sale.payments.append(SalePayment(
            amount=Decimal(str(p_in.amount)),
            method=p_in.method,
            status="COMPLETED",
            reference=p_in.reference
        ))

    db.add(sale)
    await db.commit()
    await db.refresh(sale)

    return SaleDto(
        id=sale.id,
        idempotencyKey=sale.idempotency_key,
        saleNumber=sale.sale_number,
        channel=sale.channel,
        status=sale.status,
        subtotal=float(sale.subtotal),
        taxTotal=float(sale.tax_total),
        discountTotal=float(sale.discount_total),
        grandTotal=float(sale.grand_total),
        currency=sale.currency,
        itemCount=len(sale_in.items),
        customerName=sale_in.customerName,
        paymentStatus="PAID" if sale_in.payments else "PENDING",
        createdAt=sale.created_at.isoformat(),
        lineItems=[
            SaleLineItemDto(
                id=li.id,
                variantId=li.product_variant_id,
                sku=li.sku,
                name=li.product_name,
                quantity=float(li.quantity),
                unitPrice=float(li.unit_price),
                taxRatePct=float(li.tax_rate_pct),
                lineTotal=float(li.line_total)
            ) for li in sale.line_items
        ],
        payments=[
            SalePaymentDto(
                id=p.id,
                amount=float(p.amount),
                method=p.method,
                status=p.status,
                reference=p.reference
            ) for p in sale.payments
        ]
    )


# ==============================================================================
# 5. CUSTOMERS & CRM
# ==============================================================================

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
            code=c.code,
            name=c.name,
            email=c.email,
            phone=c.phone,
            type=c.type,
            notes=c.notes,
            isActive=c.is_active,
            creditBalance=float(c.credit_balance)
        ) for c in customers
    ]
    return PaginatedResponse(items=items, total=len(items), page=1, limit=50, totalPages=1)

# ==============================================================================
# 6. FLOW AUTOMATION ENGINE (n8n-style)
# ==============================================================================

@router.get("/flows", response_model=List[AutomationFlowDto])
async def list_flows(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AutomationFlow).where(AutomationFlow.organization_id == user.organization_id)
    )
    flows = result.scalars().all()
    return [
        AutomationFlowDto(
            id=f.id,
            name=f.name,
            description=f.description,
            isActive=f.is_active,
            triggerType=f.trigger_type,
            nodes=f.nodes or [],
            edges=f.edges or [],
            createdAt=f.created_at.isoformat()
        ) for f in flows
    ]

@router.post("/flows", response_model=AutomationFlowDto)
async def create_flow(
    flow_in: CreateFlowInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    flow = AutomationFlow(
        organization_id=user.organization_id,
        name=flow_in.name,
        description=flow_in.description,
        is_active=flow_in.isActive if flow_in.isActive is not None else True,
        trigger_type=flow_in.triggerType,
        nodes=flow_in.nodes,
        edges=flow_in.edges
    )
    db.add(flow)
    await db.commit()
    await db.refresh(flow)

    return AutomationFlowDto(
        id=flow.id,
        name=flow.name,
        description=flow.description,
        isActive=flow.is_active,
        triggerType=flow.trigger_type,
        nodes=flow.nodes or [],
        edges=flow.edges or [],
        createdAt=flow.created_at.isoformat()
    )

@router.post("/flows/{flow_id}/execute", response_model=FlowExecutionDto)
async def execute_flow(
    flow_id: str,
    payload: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AutomationFlow).where(
            AutomationFlow.id == flow_id,
            AutomationFlow.organization_id == user.organization_id
        )
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    exec_result = await FlowExecutionEngine.execute(flow.nodes, flow.edges, payload)

    execution = FlowExecution(
        organization_id=user.organization_id,
        flow_id=flow.id,
        trigger_type=flow.trigger_type,
        status=exec_result["status"],
        trigger_payload=payload,
        execution_trace=exec_result["executionTrace"],
        finished_at=datetime.datetime.utcnow()
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    return FlowExecutionDto(
        id=execution.id,
        flowId=execution.flow_id,
        triggerType=execution.trigger_type,
        status=execution.status,
        triggerPayload=execution.trigger_payload,
        executionTrace=execution.execution_trace,
        startedAt=execution.started_at.isoformat(),
        finishedAt=execution.finished_at.isoformat() if execution.finished_at else None
    )

@router.get("/flows/{flow_id}/executions", response_model=List[FlowExecutionDto])
async def list_flow_executions(
    flow_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FlowExecution)
        .where(
            FlowExecution.flow_id == flow_id,
            FlowExecution.organization_id == user.organization_id
        )
        .order_by(desc(FlowExecution.started_at))
        .limit(20)
    )
    execs = result.scalars().all()
    return [
        FlowExecutionDto(
            id=e.id,
            flowId=e.flow_id,
            triggerType=e.trigger_type,
            status=e.status,
            triggerPayload=e.trigger_payload,
            executionTrace=e.execution_trace,
            startedAt=e.started_at.isoformat(),
            finishedAt=e.finished_at.isoformat() if e.finished_at else None
        ) for e in execs
    ]
