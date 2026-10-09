import json
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser

from .models import Organization
from .schemas import (
    OrganizationDto,
    OrganizationSettingsDto,
    UpdateOrganizationSettingsInput,
    UpdateOrganizationInput,
    PaywayConfigDto,
    UpdatePaywayConfigInput,
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
    org.updated_at = utc_now()

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
    org.updated_at = utc_now()

    await db.commit()
    await db.refresh(org)
    return map_org_to_dto(org)

@router.get("/current/payway", response_model=PaywayConfigDto)
async def get_current_payway_config(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from .models import PaywayConfig
    result = await db.execute(
        select(PaywayConfig).where(PaywayConfig.organization_id == user.organization_id)
    )
    pw_config = result.scalar_one_or_none()
    if not pw_config:
        raise HTTPException(status_code=404, detail="Payway config not found")
        
    return PaywayConfigDto(
        id=pw_config.id,
        merchantId=pw_config.merchant_id,
        publicKey=pw_config.public_key,
        createdAt=pw_config.created_at,
        updatedAt=pw_config.updated_at
    )

@router.put("/current/payway", response_model=PaywayConfigDto)
async def update_current_payway_config(
    pw_in: UpdatePaywayConfigInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from .models import PaywayConfig
    from app.core.payway import PaywayService
    
    # Validation step: check if the sandbox ABA sends is correct
    # We do a test generation of QR code with $1. If the credentials are wrong, ABA PayWay will return success=False
    import uuid
    dummy_tran_id = f"TEST-{str(uuid.uuid4())[:8].upper()}"
    test_result = await PaywayService.generate_qr(
        merchant_id=pw_in.merchantId,
        api_key=pw_in.publicKey,
        transaction_id=dummy_tran_id,
        amount=1.00,
        items=[{"name": "Validation Test", "quantity": "1", "price": "1.00"}],
        firstname="Test",
        lastname="User",
        email="test@example.com",
        phone="012345678"
    )
    
    if not test_result.get("success"):
        raise HTTPException(status_code=400, detail="Invalid ABA PayWay credentials. Validation failed.")

    # Validated! Now save to DB
    result = await db.execute(
        select(PaywayConfig).where(PaywayConfig.organization_id == user.organization_id)
    )
    pw_config = result.scalar_one_or_none()
    
    if not pw_config:
        pw_config = PaywayConfig(
            organization_id=user.organization_id,
            merchant_id=pw_in.merchantId,
            public_key=pw_in.publicKey,
            rsa_public_key=pw_in.rsaPublicKey,
            rsa_private_key=pw_in.rsaPrivateKey,
        )
        db.add(pw_config)
    else:
        pw_config.merchant_id = pw_in.merchantId
        pw_config.public_key = pw_in.publicKey
        if pw_in.rsaPublicKey is not None:
            pw_config.rsa_public_key = pw_in.rsaPublicKey
        if pw_in.rsaPrivateKey is not None:
            pw_config.rsa_private_key = pw_in.rsaPrivateKey
        pw_config.updated_at = utc_now()

    await db.commit()
    await db.refresh(pw_config)
    
    return PaywayConfigDto(
        id=pw_config.id,
        merchantId=pw_config.merchant_id,
        publicKey=pw_config.public_key,
        createdAt=pw_config.created_at,
        updatedAt=pw_config.updated_at
    )
