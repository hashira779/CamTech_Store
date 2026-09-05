from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from decimal import Decimal

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser

from .models import Organization
from .schemas import OrganizationDto, UpdateOrganizationInput

router = APIRouter(tags=["Organizations"])

@router.get("/current", response_model=OrganizationDto)
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
        settings=org.settings or {}
    )

@router.put("/current", response_model=OrganizationDto)
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
