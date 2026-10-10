import json
import re
import uuid
from typing import List, Optional
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
    BakongConfigDto,
    UpdateBakongConfigInput,
    CreateOrganizationInput,
    OrganizationChannelsDto,
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

@router.get("", response_model=List[OrganizationDto])
async def list_organizations(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List organizations. SUPER_ADMIN sees all organizations (e.g. all 10 coffee shops).
    Regular ORG_ADMIN sees their assigned organization."""
    if "SUPER_ADMIN" in user.roles:
        result = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
        orgs = result.scalars().all()
    else:
        result = await db.execute(select(Organization).where(Organization.id == user.organization_id))
        orgs = result.scalars().all()
    return [map_org_to_dto(o) for o in orgs]

@router.post("", response_model=OrganizationDto, status_code=status.HTTP_201_CREATED)
async def create_organization(
    inp: CreateOrganizationInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new Organization/Store (e.g. onboarding a new coffee shop owner).
    Automatically provisions default location and optional store owner admin account."""
    if "SUPER_ADMIN" not in user.roles and "ORG_ADMIN" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super administrator privileges required to provision new organizations."
        )

    # Generate slug if empty
    slug = inp.slug or re.sub(r'[^a-z0-9]+', '-', inp.name.lower()).strip('-')
    if not slug:
        slug = f"store-{uuid.uuid4().hex[:6]}"

    # Check unique slug
    existing = (await db.execute(select(Organization).where(Organization.slug == slug))).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    org_id = f"org_{uuid.uuid4().hex[:12]}"
    settings_dict = dict(DEFAULT_SETTINGS)
    settings_dict["currency"] = inp.currency or "USD"
    settings_dict["timezone"] = inp.timezone or "UTC"
    settings_dict["businessType"] = inp.businessType or "CAFE"

    new_org = Organization(
        id=org_id,
        name=inp.name,
        slug=slug,
        currency=inp.currency or "USD",
        timezone=inp.timezone or "UTC",
        tax_rate_pct=Decimal(str(inp.taxRatePct if inp.taxRatePct is not None else 10.0)),
        business_type=inp.businessType or "CAFE",
        settings=json.dumps(settings_dict),
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(new_org)
    await db.flush()

    # Automatically create root Branch location for the new store
    from app.modules.locations.models import Location
    root_loc = Location(
        id=f"loc_{uuid.uuid4().hex[:10]}",
        organization_id=org_id,
        name=f"{inp.name} - Main Branch",
        code=f"{slug[:4].upper()}-01",
        type="BRANCH",
        is_active=True,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(root_loc)

    # Optionally create store owner user
    if inp.ownerEmail and inp.ownerPassword:
        from app.modules.identity.models import User, Role, UserRole
        from app.core.security import hash_password
        import asyncio
        pwd_hash = await asyncio.to_thread(hash_password, inp.ownerPassword)
        owner_user_id = f"usr_{uuid.uuid4().hex[:10]}"
        owner_user = User(
            id=owner_user_id,
            organization_id=org_id,
            email=inp.ownerEmail.strip().lower(),
            name=inp.ownerName or f"{inp.name} Owner",
            password_hash=pwd_hash,
            roles=json.dumps(["ORG_ADMIN"]),
            is_active=True,
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        db.add(owner_user)
        # Assign ORG_ADMIN role
        r_obj = (await db.execute(select(Role).where(Role.name == "ORG_ADMIN"))).scalars().first()
        if r_obj:
            db.add(UserRole(user_id=owner_user_id, role_id=r_obj.id, role_name=r_obj.name))

    await db.commit()
    await db.refresh(new_org)
    return map_org_to_dto(new_org)

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
        rsaPublicKey=pw_config.rsa_public_key,
        isProduction=pw_config.is_production,
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
    
    # Validation step: check if the credentials sent are valid
    # We do a test generation of QR code with $1. If the credentials are wrong, ABA PayWay will return success=False
    import uuid
    dummy_tran_id = f"TEST-{str(uuid.uuid4())[:8].upper()}"
    test_result = await PaywayService.generate_qr(
        merchant_id=pw_in.merchantId,
        api_key=pw_in.publicKey,
        transaction_id=dummy_tran_id,
        amount=1.00,
        items=[{"name": "Validation Test", "quantity": 1, "price": 1.00}],
        firstname="Test",
        lastname="User",
        email="test@example.com",
        phone="012345678",
        is_production=pw_in.isProduction or False,
    )
    
    if not test_result.get("success") or test_result.get("source") != "ABA_PAYWAY":
        raise HTTPException(status_code=400, detail="Invalid ABA PayWay credentials. Verification failed by ABA Bank.")

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
            is_production=pw_in.isProduction or False,
        )
        db.add(pw_config)
    else:
        pw_config.merchant_id = pw_in.merchantId
        pw_config.public_key = pw_in.publicKey
        if pw_in.rsaPublicKey is not None:
            pw_config.rsa_public_key = pw_in.rsaPublicKey
        if pw_in.rsaPrivateKey is not None:
            pw_config.rsa_private_key = pw_in.rsaPrivateKey
        if pw_in.isProduction is not None:
            pw_config.is_production = pw_in.isProduction
        pw_config.updated_at = utc_now()

    await db.commit()
    await db.refresh(pw_config)
    
    return PaywayConfigDto(
        id=pw_config.id,
        merchantId=pw_config.merchant_id,
        publicKey=pw_config.public_key,
        rsaPublicKey=pw_config.rsa_public_key,
        isProduction=pw_config.is_production,
        createdAt=pw_config.created_at,
        updatedAt=pw_config.updated_at
    )

@router.get("/current/bakong", response_model=BakongConfigDto)
async def get_current_organization_bakong(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve Bakong KHQR configuration for current organization."""
    result = await db.execute(select(Organization).where(Organization.id == user.organization_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    bakong_cfg = {}
    if org.settings:
        try:
            s_data = json.loads(org.settings) if isinstance(org.settings, str) else org.settings
            if isinstance(s_data, dict):
                bakong_cfg = s_data.get("bakong") or {}
        except Exception:
            pass

    account_id = bakong_cfg.get("accountId") or ""
    merchant_name = bakong_cfg.get("merchantName") or org.name or "CamTech Store"
    merchant_city = bakong_cfg.get("merchantCity") or "Phnom Penh"
    currency = bakong_cfg.get("currency") or org.currency or "USD"
    enabled = bakong_cfg.get("enabled", True) if account_id else False

    return BakongConfigDto(
        accountId=account_id,
        merchantName=merchant_name,
        merchantCity=merchant_city,
        currency=currency,
        enabled=enabled,
        isConfigured=bool(account_id),
        accountName=bakong_cfg.get("accountName"),
    )

@router.put("/current/bakong", response_model=BakongConfigDto)
@router.post("/current/bakong", response_model=BakongConfigDto)
async def update_current_organization_bakong(
    bakong_in: UpdateBakongConfigInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Save or update store-specific NBC Bakong KHQR credentials in PostgreSQL.
    Enables dynamic, store-by-store Bakong account IDs without code modification.
    """
    result = await db.execute(select(Organization).where(Organization.id == user.organization_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    account_clean = bakong_in.accountId.strip()
    merchant_name = (bakong_in.merchantName or org.name or "CamTech Store").strip()
    merchant_city = (bakong_in.merchantCity or "Phnom Penh").strip()
    currency = (bakong_in.currency or org.currency or "USD").strip().upper()
    enabled = bakong_in.enabled if bakong_in.enabled is not None else True

    # Optionally verify on Bakong network
    account_verified_name = None
    if account_clean:
        try:
            from app.core.bakong import BakongService
            verify_res = await BakongService.check_bakong_account(account_clean, token=bakong_in.token)
            if verify_res.get("valid"):
                account_verified_name = verify_res.get("accountName")
        except Exception:
            pass

    current_settings = dict(DEFAULT_SETTINGS)
    if org.settings:
        try:
            raw = json.loads(org.settings) if isinstance(org.settings, str) else org.settings
            if isinstance(raw, dict):
                current_settings.update(raw)
        except Exception:
            pass

    current_settings["bakong"] = {
        "accountId": account_clean,
        "merchantName": merchant_name,
        "merchantCity": merchant_city,
        "currency": currency,
        "enabled": enabled,
        "accountName": account_verified_name,
        "token": bakong_in.token.strip() if bakong_in.token else None,
        "updatedAt": utc_now().isoformat(),
    }

    org.settings = json.dumps(current_settings)
    org.updated_at = utc_now()

    await db.commit()
    await db.refresh(org)

    return BakongConfigDto(
        accountId=account_clean,
        merchantName=merchant_name,
        merchantCity=merchant_city,
        currency=currency,
        enabled=enabled,
        isConfigured=bool(account_clean),
        accountName=account_verified_name,
    )

@router.get("/current/channels", response_model=OrganizationChannelsDto)
async def get_current_organization_channels(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full storefront URLs, Telegram Mini App URLs, and live API endpoints for current organization."""
    return await _resolve_org_channels(user.organization_id, db)

@router.get("/{org_id}/channels", response_model=OrganizationChannelsDto)
async def get_organization_channels_by_id(
    org_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve storefront URLs, Telegram Mini App URLs, and API endpoints for a specific organization."""
    if org_id != user.organization_id and "SUPER_ADMIN" not in user.roles:
        raise HTTPException(status_code=403, detail="Access denied to external organization channels.")
    return await _resolve_org_channels(org_id, db)

async def _resolve_org_channels(target_id: str, db: AsyncSession) -> OrganizationChannelsDto:
    org = (await db.execute(select(Organization).where(Organization.id == target_id))).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    from .models import PaywayConfig
    pw = (await db.execute(select(PaywayConfig).where(PaywayConfig.organization_id == target_id))).scalar_one_or_none()

    bakong_cfg = {}
    if org.settings:
        try:
            s_data = json.loads(org.settings) if isinstance(org.settings, str) else org.settings
            if isinstance(s_data, dict):
                bakong_cfg = s_data.get("bakong") or {}
        except Exception:
            pass

    bakong_account = bakong_cfg.get("accountId")
    bakong_enabled = bool(bakong_cfg.get("enabled", True) and bakong_account)

    import os
    base_domain = os.getenv("APP_DOMAIN", "camtech.cam")
    gw_env = os.getenv("GATEWAY_URL", "")
    is_local = "localhost" in gw_env or "127.0.0.1" in gw_env

    if is_local:
        store_url = f"http://localhost:5001/?org={org.id}"
        mini_url = f"http://localhost:5002/mini?org={org.id}"
        api_base = "http://localhost:4000/api/v1"
    else:
        store_url = f"https://store.{base_domain}/?org={org.id}"
        mini_url = f"https://admin.{base_domain}/mini?org={org.id}"
        api_base = f"https://gateway.{base_domain}/api/v1"

    return OrganizationChannelsDto(
        organizationId=org.id,
        organizationName=org.name,
        organizationSlug=org.slug,
        storefrontUrl=store_url,
        telegramMiniAppUrl=mini_url,
        apiBaseUrl=api_base,
        publicCatalogEndpoint=f"{api_base}/public/products?organizationId={org.id}",
        checkoutEndpoint=f"{api_base}/sales/checkout",
        telegramBotAuthEndpoint=f"{api_base}/telegram/mini-app/auth",
        paywayConfigured=bool(pw and pw.merchant_id and pw.public_key),
        paywayMerchantId=pw.merchant_id if pw else None,
        bakongConfigured=bool(bakong_account),
        bakongAccountId=bakong_account,
        bakongEnabled=bakong_enabled,
    )

