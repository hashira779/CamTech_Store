import uuid
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_optional_user, TenantUser
from app.core.config import settings
from app.core.db_enums import ENUM_LABELS
from app.modules.organizations.models import Organization
from app.modules.identity.models import User

import json
from .models import Customer
from .schemas import (
    CustomerDto,
    CustomerSyncInput,
    CustomerCartSyncInput,
    CustomerCartDto,
    CreateCustomerInput,
    UpdateCustomerInput,
    PaginatedResponse,
    PageMeta,
)

router = APIRouter(tags=["Customers"])

_CUSTOMER_TYPES = set(ENUM_LABELS["CustomerType"])


def _to_dto(c: Customer) -> CustomerDto:
    return CustomerDto(
        id=c.id,
        organizationId=c.organization_id,
        code=c.code or "",
        name=c.name,
        email=c.email,
        phone=c.phone,
        type=c.type,
        loyaltyPoints=c.loyalty_points or 0,
        loyaltyTier=c.loyalty_tier or "BRONZE",
        storeCredit=float(c.store_credit or 0),
        creditBalance=float(c.store_credit or 0),
        notes=c.notes,
        isActive=c.is_active,
        createdAt=c.created_at.isoformat() if c.created_at else None,
        updatedAt=c.updated_at.isoformat() if c.updated_at else None,
    )


def _validate_type(value: str) -> str:
    if value not in _CUSTOMER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid customer type '{value}'. Allowed: {sorted(_CUSTOMER_TYPES)}",
        )
    return value


@router.post("/customers/sync", response_model=CustomerDto)
@router.post("/customers/public-sync", response_model=CustomerDto)
async def sync_customer(
    input_data: CustomerSyncInput,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Storefront Google / Customer Sync Endpoint.
    When a customer signs in with Google (or manual login) on store.camtech.cam:
    1. Persists & updates the customer profile in PostgreSQL 'customers' table with real loyalty tier & points.
    2. Persists & updates the user account in PostgreSQL 'users' table with role 'CUSTOMER'.
    Both Super Admin (apps/web) and Storefront immediately share dynamic, synchronized data without gaps.
    """
    email_clean = input_data.email.strip().lower()
    name_clean = input_data.name.strip()
    phone_clean = input_data.phone.strip() if input_data.phone else None

    # Resolve Target Organization ID
    target_org = user.organization_id if user else None
    if not target_org:
        org_result = await db.execute(select(Organization.id).limit(1))
        target_org = org_result.scalar_one_or_none() or settings.DEFAULT_ORG_ID

    # 1. Sync / Provision in 'customers' table
    cust_result = await db.execute(
        select(Customer).where(
            Customer.organization_id == target_org,
            func.lower(Customer.email) == email_clean
        )
    )
    customer = cust_result.scalar_one_or_none()

    if not customer:
        customer_code = f"CUST-{uuid.uuid4().hex[:8].upper()}"
        customer = Customer(
            organization_id=target_org,
            code=customer_code,
            name=name_clean or email_clean.split("@")[0],
            email=email_clean,
            phone=phone_clean,
            type="INDIVIDUAL",
            loyalty_points=500,  # 500 VIP Welcome points
            loyalty_tier="Executive Gold",
            store_credit=0.0,
            notes=f"Store customer via {input_data.authProvider or 'Google OAuth'}",
            is_active=True
        )
        db.add(customer)
    else:
        if name_clean and (not customer.name or customer.name == "Google User"):
            customer.name = name_clean
        if phone_clean:
            customer.phone = phone_clean
        if not customer.loyalty_tier or customer.loyalty_tier == "BRONZE":
            customer.loyalty_tier = "Executive Gold"
        if not customer.loyalty_points:
            customer.loyalty_points = 500
        customer.is_active = True

    # 2. Sync / Provision in 'users' table (Visible to Super Admin in User Directory)
    user_result = await db.execute(
        select(User).where(func.lower(User.email) == email_clean)
    )
    user_record = user_result.scalar_one_or_none()

    if not user_record:
        user_record = User(
            organization_id=target_org,
            email=email_clean,
            name=name_clean or email_clean.split("@")[0],
            password_hash="OAUTH_EXTERNAL_SSO_USER",
            roles='["CUSTOMER"]',
            is_active=True
        )
        db.add(user_record)
    else:
        if name_clean and (not user_record.name or user_record.name == "Google User"):
            user_record.name = name_clean
        user_record.is_active = True

    await db.commit()
    await db.refresh(customer)
    return _to_dto(customer)


@router.get("/customers/profile", response_model=CustomerDto)
async def get_customer_profile(
    email: str,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches real-time customer profile & loyalty metrics by email.
    """
    email_clean = email.strip().lower()
    target_org = user.organization_id if user else None
    if not target_org:
        org_result = await db.execute(select(Organization.id).limit(1))
        target_org = org_result.scalar_one_or_none() or settings.DEFAULT_ORG_ID

    cust_result = await db.execute(
        select(Customer).where(
            Customer.organization_id == target_org,
            func.lower(Customer.email) == email_clean
        )
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found in database")
    return _to_dto(customer)


@router.get("/customers/cart", response_model=CustomerCartDto)
async def get_customer_cart(
    email: str,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves the customer's active shopping cart directly from PostgreSQL.
    """
    email_clean = email.strip().lower()
    target_org = user.organization_id if user else None
    if not target_org:
        org_result = await db.execute(select(Organization.id).limit(1))
        target_org = org_result.scalar_one_or_none() or settings.DEFAULT_ORG_ID

    cust_result = await db.execute(
        select(Customer).where(
            Customer.organization_id == target_org,
            func.lower(Customer.email) == email_clean
        )
    )
    customer = cust_result.scalar_one_or_none()
    if not customer or not customer.notes:
        return CustomerCartDto(email=email_clean, items=[])

    items = []
    try:
        parsed = json.loads(customer.notes)
        if isinstance(parsed, dict) and "cart" in parsed and isinstance(parsed["cart"], list):
            items = parsed["cart"]
        elif isinstance(parsed, list):
            items = parsed
    except Exception:
        pass

    return CustomerCartDto(email=email_clean, items=items)


@router.post("/customers/cart", response_model=CustomerCartDto)
async def sync_customer_cart(
    payload: CustomerCartSyncInput,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Persists customer shopping cart in PostgreSQL linked to their customer profile.
    """
    email_clean = payload.email.strip().lower()
    target_org = user.organization_id if user else None
    if not target_org:
        org_result = await db.execute(select(Organization.id).limit(1))
        target_org = org_result.scalar_one_or_none() or settings.DEFAULT_ORG_ID

    cust_result = await db.execute(
        select(Customer).where(
            Customer.organization_id == target_org,
            func.lower(Customer.email) == email_clean
        )
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        customer = Customer(
            organization_id=target_org,
            code=f"CUST-{uuid.uuid4().hex[:8].upper()}",
            name=email_clean.split("@")[0],
            email=email_clean,
            type="INDIVIDUAL",
            loyalty_points=500,
            loyalty_tier="Executive Gold",
            store_credit=0.0,
            is_active=True
        )
        db.add(customer)

    existing_meta = {}
    if customer.notes:
        try:
            parsed = json.loads(customer.notes)
            if isinstance(parsed, dict):
                existing_meta = parsed
            else:
                existing_meta["notes"] = customer.notes
        except Exception:
            existing_meta["notes"] = customer.notes

    existing_meta["cart"] = payload.items
    customer.notes = json.dumps(existing_meta)

    await db.commit()
    return CustomerCartDto(email=email_clean, items=payload.items)


@router.get("/customers", response_model=PaginatedResponse[CustomerDto])
async def list_customers(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Customer).where(Customer.organization_id == user.organization_id)
    )
    customers = result.scalars().all()
    items = [_to_dto(c) for c in customers]
    return PaginatedResponse(items=items, meta=PageMeta(page=1, limit=50, total=len(items), totalPages=1), total=len(items))


@router.post("/customers", response_model=CustomerDto, status_code=status.HTTP_201_CREATED)
async def create_customer(
    input_data: CreateCustomerInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    _validate_type(input_data.type)

    code = input_data.code or f"CUST-{uuid.uuid4().hex[:8].upper()}"

    # Enforce per-tenant code uniqueness for a friendlier error than a DB constraint 500.
    existing = await db.execute(
        select(Customer).where(
            Customer.organization_id == user.organization_id,
            Customer.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer code '{code}' already exists",
        )

    customer = Customer(
        organization_id=user.organization_id,
        code=code,
        name=input_data.name,
        email=input_data.email,
        phone=input_data.phone,
        type=input_data.type,
        notes=input_data.notes,
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return _to_dto(customer)


@router.patch("/customers/{customer_id}", response_model=CustomerDto)
@router.put("/customers/{customer_id}", response_model=CustomerDto)
async def update_customer(
    customer_id: str,
    input_data: UpdateCustomerInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.organization_id == user.organization_id,
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    if input_data.type is not None:
        _validate_type(input_data.type)
        customer.type = input_data.type
    if input_data.name is not None:
        customer.name = input_data.name
    if input_data.code is not None:
        customer.code = input_data.code
    if input_data.email is not None:
        customer.email = input_data.email
    if input_data.phone is not None:
        customer.phone = input_data.phone
    if input_data.notes is not None:
        customer.notes = input_data.notes
    if input_data.isActive is not None:
        customer.is_active = input_data.isActive

    await db.commit()
    await db.refresh(customer)
    return _to_dto(customer)
