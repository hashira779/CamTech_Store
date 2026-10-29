import json
import re
import uuid
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request
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
    VerifyBakongAccountInput,
    VerifyBakongAccountResultDto,
    CreateOrganizationInput,
    OrganizationChannelsDto,
)

router = APIRouter(tags=["Organizations"])

# Only store admins may replace where a store's money is paid to.
CREDENTIAL_ADMIN_ROLES = {"SUPER_ADMIN", "ORG_ADMIN"}
SECRET_MASK = "••••"


def require_store_admin(user: TenantUser = Depends(get_current_user)) -> TenantUser:
    if not CREDENTIAL_ADMIN_ROLES.intersection(user.roles):
        raise HTTPException(status_code=403, detail="Only store administrators can manage payment credentials.")
    return user


def _is_masked(value: Optional[str]) -> bool:
    """True when the client echoed back the masked placeholder instead of a new secret."""
    return bool(value) and SECRET_MASK in value


def _seal_or_503(secret: str, org_id: str) -> dict:
    from app.core import key_vault
    try:
        return key_vault.seal(secret, org_id)
    except key_vault.VaultUnavailable:
        raise HTTPException(status_code=503, detail="Payment key vault is not configured (PAYMENT_KEK). Secrets cannot be stored.")


def _audit_credential_change(db: AsyncSession, user: TenantUser, request: Request, resource_type: str, resource_id: str, fields: List[str]):
    """Append-only record of who replaced which payment credential, from where (values are never logged)."""
    from app.models.entities import AuditLog
    from app.modules.observability.middleware import _client_ip
    db.add(AuditLog(
        organization_id=user.organization_id,
        actor_id=user.id,
        action="PAYMENT_CREDENTIAL_REPLACED",
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_=json.dumps({"fields": fields, "branchId": user.organization_id, "actorEmail": user.email}),
        ip=_client_ip(request),
        result="SUCCESS",
    ))

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

def _payway_dto(pw_config) -> PaywayConfigDto:
    from app.core import key_vault
    from .payment_config import parse_sealed_column
    sealed = parse_sealed_column(pw_config.public_key)
    return PaywayConfigDto(
        id=pw_config.id,
        merchantId=pw_config.merchant_id,
        # The API key is never returned; the UI shows a mask and sends a new key only to replace it.
        publicKey=key_vault.mask(sealed, prefix="pw_live_") if sealed else "",
        rsaPublicKey=pw_config.rsa_public_key,
        isProduction=pw_config.is_production,
        createdAt=pw_config.created_at,
        updatedAt=pw_config.updated_at
    )


@router.get("/current/payway", response_model=PaywayConfigDto)
async def get_current_payway_config(
    user: TenantUser = Depends(require_store_admin),
    db: AsyncSession = Depends(get_db)
):
    from .models import PaywayConfig
    result = await db.execute(
        select(PaywayConfig).where(PaywayConfig.organization_id == user.organization_id)
    )
    pw_config = result.scalar_one_or_none()
    if not pw_config:
        raise HTTPException(status_code=404, detail="Payway config not found")
    return _payway_dto(pw_config)

@router.put("/current/payway", response_model=PaywayConfigDto)
async def update_current_payway_config(
    pw_in: UpdatePaywayConfigInput,
    request: Request,
    user: TenantUser = Depends(require_store_admin),
    db: AsyncSession = Depends(get_db)
):
    from .models import PaywayConfig
    from app.core.payway import PaywayService
    from .payment_config import resolve_store_payment_config

    result = await db.execute(
        select(PaywayConfig).where(PaywayConfig.organization_id == user.organization_id)
    )
    pw_config = result.scalar_one_or_none()

    # A masked key means "keep the stored key" (the form shows the mask, never the secret).
    api_key = pw_in.publicKey
    if _is_masked(api_key) or not api_key:
        current = await resolve_store_payment_config(db, user.organization_id)
        if not current.payway:
            raise HTTPException(status_code=400, detail="Update failed — nothing was saved. Enter the ABA PayWay API key.")
        api_key = current.payway.api_key

    # Validation step: check if the credentials sent are valid
    # We do a test generation of QR code with $1. If the credentials are wrong, ABA PayWay will return success=False
    import uuid
    dummy_tran_id = f"TEST-{str(uuid.uuid4())[:8].upper()}"
    test_result = await PaywayService.generate_qr(
        merchant_id=pw_in.merchantId,
        api_key=api_key,
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
        raise HTTPException(
            status_code=400,
            detail="Update failed — nothing was saved. ABA PayWay did not accept this Merchant ID / API key "
                   f"({'production' if pw_in.isProduction else 'sandbox'} environment). Check both values and the environment switch.",
        )

    # Validated! Seal the secrets (bound to this store) and save.
    org_id = user.organization_id
    sealed_key = json.dumps(_seal_or_503(api_key, org_id))
    sealed_rsa = (
        json.dumps(_seal_or_503(pw_in.rsaPrivateKey, org_id))
        if pw_in.rsaPrivateKey and not _is_masked(pw_in.rsaPrivateKey) else None
    )
    changed = ["merchantId", "apiKey"] + (["rsaPrivateKey"] if sealed_rsa else [])

    if not pw_config:
        pw_config = PaywayConfig(
            organization_id=org_id,
            merchant_id=pw_in.merchantId,
            public_key=sealed_key,
            rsa_public_key=pw_in.rsaPublicKey,
            rsa_private_key=sealed_rsa,
            is_production=pw_in.isProduction or False,
        )
        db.add(pw_config)
        await db.flush()
    else:
        pw_config.merchant_id = pw_in.merchantId
        pw_config.public_key = sealed_key
        if pw_in.rsaPublicKey is not None:
            pw_config.rsa_public_key = pw_in.rsaPublicKey
        if sealed_rsa:
            pw_config.rsa_private_key = sealed_rsa
        if pw_in.isProduction is not None:
            pw_config.is_production = pw_in.isProduction
        pw_config.updated_at = utc_now()

    _audit_credential_change(db, user, request, "PaywayConfig", pw_config.id, changed)
    await db.commit()
    await db.refresh(pw_config)
    return _payway_dto(pw_config)

def _bakong_dto(cfg: dict, org: Organization) -> BakongConfigDto:
    from app.core import key_vault
    account_id = cfg.get("accountId") or ""
    return BakongConfigDto(
        accountId=account_id,
        accountType=cfg.get("accountType") or "INDIVIDUAL",
        merchantName=cfg.get("merchantName") or org.name or "Store",
        merchantId=cfg.get("merchantId"),
        acquiringBank=cfg.get("acquiringBank"),
        merchantCity=cfg.get("merchantCity") or "Phnom Penh",
        currency=cfg.get("currency") or org.currency or "USD",
        enabled=cfg.get("enabled", True) if account_id else False,
        isConfigured=bool(account_id),
        accountVerifiedAt=cfg.get("accountVerifiedAt"),
        accountName=None,
        hasToken=bool(cfg.get("tokenSealed")),
        tokenMasked=key_vault.mask(cfg.get("tokenSealed"), prefix="bk_live_"),
        hasWebhookSecret=bool(cfg.get("webhookSecretSealed")),
        webhookSecretMasked=key_vault.mask(cfg.get("webhookSecretSealed"), prefix="whsec_"),
    )


@router.get("/current/bakong", response_model=BakongConfigDto)
async def get_current_organization_bakong(
    user: TenantUser = Depends(require_store_admin),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve Bakong KHQR configuration for current organization (secrets masked)."""
    from .payment_config import read_bakong_settings
    result = await db.execute(select(Organization).where(Organization.id == user.organization_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return _bakong_dto(read_bakong_settings(org), org)

@router.put("/current/bakong", response_model=BakongConfigDto)
@router.post("/current/bakong", response_model=BakongConfigDto)
async def update_current_organization_bakong(
    bakong_in: UpdateBakongConfigInput,
    request: Request,
    user: TenantUser = Depends(require_store_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Save or update store-specific NBC Bakong KHQR credentials.
    The API token and webhook secret are sealed in the key vault (bound to this store) and never returned.
    """
    from .payment_config import read_bakong_settings, open_store_secret
    result = await db.execute(select(Organization).where(Organization.id == user.organization_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    from app.core.bakong import BakongService
    from app.domain.commerce_engines import KhqrGenerator

    previous = read_bakong_settings(org)
    account_clean = bakong_in.accountId.strip()
    merchant_name = bakong_in.merchantName.strip()
    merchant_city = (bakong_in.merchantCity or "Phnom Penh").strip()
    currency = (bakong_in.currency or org.currency or "USD").strip().upper()
    enabled = bakong_in.enabled if bakong_in.enabled is not None else True
    is_merchant = bakong_in.accountType == "MERCHANT"

    new_token = None if _is_masked(bakong_in.token) else (bakong_in.token or "").strip() or None
    new_webhook_secret = None if _is_masked(bakong_in.webhookSecret) else (bakong_in.webhookSecret or "").strip() or None
    verify_token = new_token or open_store_secret(previous, "token", org.id)

    # 1. The account must exist on Bakong (NBC /v1/check_bakong_account). Any failure aborts the save.
    verify_res = await BakongService.check_bakong_account(account_clean, token=verify_token)
    if not verify_res.get("valid"):
        reason = verify_res.get("reason")
        code = {"UNREACHABLE": 502, "RATE_LIMITED": 429}.get(reason, status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=code, detail=f"Update failed — nothing was saved. {verify_res.get('message')}")

    # 2. The exact QR customers will scan must build and decode cleanly with these values.
    try:
        probe = KhqrGenerator.generate_dynamic_qr(
            merchant_name=merchant_name, account_id=account_clean, amount=1, currency=currency,
            merchant_city=merchant_city, bill_number="CONFIG-CHECK",
            account_type=bakong_in.accountType, merchant_id=bakong_in.merchantId, acquiring_bank=bakong_in.acquiringBank,
        )
        tags = KhqrGenerator.parse(probe["qrString"])
        if tags["30" if is_merchant else "29"]["00"] != account_clean:
            raise ValueError("account ID did not round-trip")
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=f"Update failed — nothing was saved. These details cannot form a valid KHQR: {e}")

    # 3. Secrets: seal now so a vault problem also fails the save before anything is written.
    token_sealed = _seal_or_503(new_token, org.id) if new_token else previous.get("tokenSealed")
    webhook_sealed = _seal_or_503(new_webhook_secret, org.id) if new_webhook_secret else previous.get("webhookSecretSealed")
    if not token_sealed and not BakongService.get_token() and not BakongService.test_accounts_allowed():
        raise HTTPException(
            status_code=400,
            detail="Update failed — nothing was saved. Enter your Bakong API token: without it payments cannot be confirmed.",
        )

    current_settings = dict(DEFAULT_SETTINGS)
    if org.settings:
        try:
            raw = json.loads(org.settings) if isinstance(org.settings, str) else org.settings
            if isinstance(raw, dict):
                current_settings.update(raw)
        except Exception:
            pass

    new_cfg = {
        "accountId": account_clean,
        "accountType": bakong_in.accountType,
        "merchantName": merchant_name,
        "merchantId": bakong_in.merchantId if is_merchant else None,
        "acquiringBank": bakong_in.acquiringBank,
        "merchantCity": merchant_city,
        "currency": currency,
        "enabled": enabled,
        "accountVerifiedAt": utc_now().isoformat(),
        # Unchanged secrets keep their existing envelopes; replaced ones are re-sealed for this store.
        "tokenSealed": token_sealed,
        "webhookSecretSealed": webhook_sealed,
        "updatedAt": utc_now().isoformat(),
    }
    current_settings["bakong"] = new_cfg

    changed = [k for k in ("accountId", "accountType", "merchantName", "merchantId", "acquiringBank", "currency", "enabled")
               if previous.get(k) != new_cfg[k]]
    changed += (["token"] if new_token else []) + (["webhookSecret"] if new_webhook_secret else [])
    if changed:
        _audit_credential_change(db, user, request, "BakongConfig", org.id, changed)

    org.settings = json.dumps(current_settings)
    org.updated_at = utc_now()

    await db.commit()
    await db.refresh(org)
    return _bakong_dto(new_cfg, org)

@router.post("/current/bakong/verify", response_model=VerifyBakongAccountResultDto)
async def verify_current_organization_bakong_account(
    verify_in: VerifyBakongAccountInput,
    user: TenantUser = Depends(require_store_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Checks a Bakong Account ID exists (NBC /v1/check_bakong_account), using the typed token or the store's saved one.
    NBC returns no owner name — only whether the account exists.
    """
    from app.core.bakong import BakongService
    from .payment_config import read_bakong_settings, open_store_secret
    token = None if _is_masked(verify_in.token) else (verify_in.token or "").strip() or None
    if not token:
        org = (await db.execute(select(Organization).where(Organization.id == user.organization_id))).scalar_one_or_none()
        token = open_store_secret(read_bakong_settings(org), "token", user.organization_id) if org else None
    res = await BakongService.check_bakong_account(verify_in.accountId.strip(), token=token)
    return VerifyBakongAccountResultDto(
        valid=bool(res.get("valid")),
        accountId=verify_in.accountId.strip(),
        errorCode=res.get("errorCode"),
        reason=res.get("reason"),
        message=res.get("message") or ("Account ID exists" if res.get("valid") else "Account not found on Bakong"),
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

    from .payment_config import resolve_store_payment_config, read_bakong_settings
    pay_cfg = await resolve_store_payment_config(db, target_id)
    bakong_account = read_bakong_settings(org).get("accountId")

    import os
    base_domain = os.getenv("APP_DOMAIN", "camtech.cam")
    gw_env = os.getenv("GATEWAY_URL", "")
    is_local = "localhost" in gw_env or "127.0.0.1" in gw_env

    if is_local:
        store_url = f"http://localhost:5001/?org={org.id}"
        mini_url = os.getenv("MINI_APP_URL") or f"http://localhost:5007/?org={org.id}"
        api_base = "http://localhost:4000/api/v1"
    else:
        admin_host = os.getenv("ADMIN_DOMAIN", f"adminconsol.{base_domain}")
        mini_host = os.getenv("MINI_DOMAIN", f"mini.{base_domain}")
        store_url = f"https://store.{base_domain}/?org={org.id}"
        if mini_host:
            mini_url = f"https://{mini_host}/?org={org.id}"
        else:
            mini_url = os.getenv("MINI_APP_URL") or f"https://{admin_host}/mini/?org={org.id}"
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
        paywayConfigured=pay_cfg.payway is not None,
        paywayMerchantId=pay_cfg.payway.merchant_id if pay_cfg.payway else None,
        bakongConfigured=bool(bakong_account),
        bakongAccountId=bakong_account,
        bakongEnabled=pay_cfg.bakong is not None,
    )

