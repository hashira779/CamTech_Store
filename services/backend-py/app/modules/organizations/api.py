import json
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser

from .models import Organization
from .schemas import (
    OrganizationDto,
    OrganizationSettingsDto,
    UpdateOrganizationSettingsInput,
    UpdateOrganizationInput,
)

router = APIRouter(tags=["Organizations"])

DEFAULT_SETTINGS = {
    "currency": "USD",
    "timezone": "UTC",
    "taxRatePct": 10.0,
    "businessType": "RETAIL",
    "enabledModules": ["products", "customers", "sales", "inventory", "locations"],
    "receiptHeader": "Thank you for your business!",
    "receiptFooter": "Please keep your receipt for any exchanges.",
}

def map_org_to_dto(org: Organization) -> OrganizationDto:
    parsed = dict(DEFAULT_SETTINGS)
    if org.settings:
        if isinstance(org.settings, str):
            try:
                raw = json.loads(org.settings)
                if isinstance(raw, dict):
                    parsed.update(raw)
            except Exception:
                pass
        elif isinstance(org.settings, dict):
            parsed.update(org.settings)

    if org.currency:
        parsed["currency"] = org.currency
    if org.timezone:
        parsed["timezone"] = org.timezone
    if org.tax_rate_pct is not None:
        parsed["taxRatePct"] = float(org.tax_rate_pct)
    if org.business_type:
        parsed["businessType"] = org.business_type

    if not isinstance(parsed.get("enabledModules"), list):
        parsed["enabledModules"] = list(DEFAULT_SETTINGS["enabledModules"])

    settings_dto = OrganizationSettingsDto(
        currency=parsed.get("currency", "USD"),
        timezone=parsed.get("timezone", "UTC"),
        taxRatePct=float(parsed.get("taxRatePct", 10.0)),
        businessType=parsed.get("businessType", "RETAIL"),
        enabledModules=parsed.get("enabledModules", []),
        receiptHeader=parsed.get("receiptHeader") or "",
        receiptFooter=parsed.get("receiptFooter") or "",
    )

    return OrganizationDto(
        id=org.id,
        name=org.name,
        slug=org.slug,
        currency=org.currency or "USD",
        timezone=org.timezone or "UTC",
        taxRatePct=float(org.tax_rate_pct) if org.tax_rate_pct is not None else 10.0,
        businessType=org.business_type or "RETAIL",
        settings=settings_dto,
        createdAt=org.created_at,
        updatedAt=org.updated_at,
    )

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
    return map_org_to_dto(org)

@router.patch("/current/settings", response_model=OrganizationDto)
@router.put("/current/settings", response_model=OrganizationDto)
async def update_current_organization_settings(
    settings_in: UpdateOrganizationSettingsInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Organization).where(Organization.id == user.organization_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    current_settings = dict(DEFAULT_SETTINGS)
    if org.settings:
        if isinstance(org.settings, str):
            try:
                raw = json.loads(org.settings)
                if isinstance(raw, dict):
                    current_settings.update(raw)
            except Exception:
                pass
        elif isinstance(org.settings, dict):
            current_settings.update(org.settings)

    if settings_in.currency is not None:
        org.currency = settings_in.currency
        current_settings["currency"] = settings_in.currency
    if settings_in.timezone is not None:
        org.timezone = settings_in.timezone
        current_settings["timezone"] = settings_in.timezone
    if settings_in.taxRatePct is not None:
        org.tax_rate_pct = Decimal(str(settings_in.taxRatePct))
        current_settings["taxRatePct"] = float(settings_in.taxRatePct)
    if settings_in.businessType is not None:
        org.business_type = settings_in.businessType
        current_settings["businessType"] = settings_in.businessType
    if settings_in.enabledModules is not None:
        current_settings["enabledModules"] = settings_in.enabledModules
    if settings_in.receiptHeader is not None:
        current_settings["receiptHeader"] = settings_in.receiptHeader
    if settings_in.receiptFooter is not None:
        current_settings["receiptFooter"] = settings_in.receiptFooter

    if settings_in.settings is not None:
        current_settings.update(settings_in.settings)

    org.settings = json.dumps(current_settings)
    org.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(org)
    return map_org_to_dto(org)

@router.put("/current", response_model=OrganizationDto)
@router.patch("/current", response_model=OrganizationDto)
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

    current_settings = dict(DEFAULT_SETTINGS)
    if org.settings:
        if isinstance(org.settings, str):
            try:
                raw = json.loads(org.settings)
                if isinstance(raw, dict):
                    current_settings.update(raw)
            except Exception:
                pass
        elif isinstance(org.settings, dict):
            current_settings.update(org.settings)

    if org_in.name is not None:
        org.name = org_in.name
    if org_in.currency is not None:
        org.currency = org_in.currency
        current_settings["currency"] = org_in.currency
    if org_in.timezone is not None:
        org.timezone = org_in.timezone
        current_settings["timezone"] = org_in.timezone
    if org_in.taxRatePct is not None:
        org.tax_rate_pct = Decimal(str(org_in.taxRatePct))
        current_settings["taxRatePct"] = float(org_in.taxRatePct)
    if org_in.businessType is not None:
        org.business_type = org_in.businessType
        current_settings["businessType"] = org_in.businessType
    if org_in.enabledModules is not None:
        current_settings["enabledModules"] = org_in.enabledModules
    if org_in.receiptHeader is not None:
        current_settings["receiptHeader"] = org_in.receiptHeader
    if org_in.receiptFooter is not None:
        current_settings["receiptFooter"] = org_in.receiptFooter

    if org_in.settings is not None:
        if isinstance(org_in.settings, str):
            try:
                extra = json.loads(org_in.settings)
                if isinstance(extra, dict):
                    current_settings.update(extra)
            except Exception:
                pass
        elif isinstance(org_in.settings, dict):
            current_settings.update(org_in.settings)

    org.settings = json.dumps(current_settings)
    org.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(org)
    return map_org_to_dto(org)
