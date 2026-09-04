import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.core.db_enums import ENUM_LABELS

from .models import Customer
from .schemas import (
    CustomerDto,
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
        notes=c.notes,
        isActive=c.is_active,
        creditBalance=float(c.store_credit or 0),
    )


def _validate_type(value: str) -> str:
    if value not in _CUSTOMER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid customer type '{value}'. Allowed: {sorted(_CUSTOMER_TYPES)}",
        )
    return value


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
