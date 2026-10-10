import re
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any

class OrganizationSettingsDto(BaseModel):
    currency: str = "USD"
    timezone: str = "UTC"
    taxRatePct: float = 10.0
    businessType: str = "RETAIL"
    enabledModules: List[str] = Field(
        default_factory=lambda: ["products", "customers", "sales", "inventory", "locations"]
    )
    receiptHeader: Optional[str] = "Thank you for your business!"
    receiptFooter: Optional[str] = "Please keep your receipt for any exchanges."

class OrganizationDto(BaseModel):
    id: str
    name: str
    slug: str
    currency: str
    timezone: str
    taxRatePct: float
    businessType: str
    settings: OrganizationSettingsDto
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

class UpdateOrganizationSettingsInput(BaseModel):
    currency: Optional[str] = None
    timezone: Optional[str] = None
    taxRatePct: Optional[float] = None
    businessType: Optional[str] = None
    enabledModules: Optional[List[str]] = None
    receiptHeader: Optional[str] = None
    receiptFooter: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class UpdateOrganizationInput(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    taxRatePct: Optional[float] = None
    businessType: Optional[str] = None
    settings: Optional[Any] = None
    enabledModules: Optional[List[str]] = None
    receiptHeader: Optional[str] = None
    receiptFooter: Optional[str] = None

class PaywayConfigDto(BaseModel):
    id: str
    merchantId: str
    publicKey: str
    rsaPublicKey: Optional[str] = None
    isProduction: Optional[bool] = False
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

class UpdatePaywayConfigInput(BaseModel):
    merchantId: str
    publicKey: str
    rsaPublicKey: Optional[str] = None
    rsaPrivateKey: Optional[str] = None
    isProduction: Optional[bool] = False

class CreateOrganizationInput(BaseModel):
    name: str
    slug: Optional[str] = None
    currency: Optional[str] = "USD"
    timezone: Optional[str] = "UTC"
    taxRatePct: Optional[float] = 10.0
    businessType: Optional[str] = "CAFE"
    ownerEmail: Optional[str] = None
    ownerName: Optional[str] = None
    ownerPassword: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Store name cannot be empty")
        val = v.strip()
        if len(val) < 2:
            raise ValueError("Store name must be at least 2 characters")
        return val

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        val = v.strip().lower()
        if not re.match(r'^[a-z0-9\-]+$', val):
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return val

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return "USD"
        val = v.strip().upper()
        if val not in ("USD", "KHR"):
            raise ValueError("Currency must be either USD or KHR")
        return val

    @field_validator("taxRatePct")
    @classmethod
    def validate_tax_rate(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Tax rate must be between 0% and 100%")
        return v

class BakongConfigDto(BaseModel):
    accountId: str
    merchantName: str
    merchantCity: Optional[str] = "Phnom Penh"
    currency: Optional[str] = "USD"
    enabled: bool = True
    isConfigured: bool = True
    accountName: Optional[str] = None

class UpdateBakongConfigInput(BaseModel):
    accountId: str
    merchantName: Optional[str] = None
    merchantCity: Optional[str] = "Phnom Penh"
    currency: Optional[str] = "USD"
    enabled: Optional[bool] = True
    token: Optional[str] = None

    @field_validator("accountId")
    @classmethod
    def validate_bakong_account_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Bakong Account ID is required")
        val = v.strip().lower()
        if len(val) < 3 or len(val) > 64:
            raise ValueError("Bakong Account ID must be between 3 and 64 characters")
        if " " in val:
            raise ValueError("Bakong Account ID cannot contain spaces")
        # Must match either handle@bank (e.g. name@aclb, user@wing) or phone (855xxxxxxxxx) or phone@bank
        pattern = r'^[a-z0-9_\.\-]+(@[a-z0-9_\.\-]+)?$'
        if not re.match(pattern, val):
            raise ValueError("Invalid Bakong Account ID format. Examples: chhoy_ratha@aclb, 85512345678@wing, or phone number")
        return val

    @field_validator("currency")
    @classmethod
    def validate_bakong_currency(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return "USD"
        val = v.strip().upper()
        if val not in ("USD", "KHR"):
            raise ValueError("Currency must be either USD or KHR")
        return val

    @field_validator("merchantName")
    @classmethod
    def validate_merchant_name(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        val = v.strip()
        if len(val) > 50:
            raise ValueError("Merchant name cannot exceed 50 characters (EMVCo Tag 59 limit)")
        return val

    @field_validator("merchantCity")
    @classmethod
    def validate_merchant_city(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return "Phnom Penh"
        val = v.strip()
        if len(val) > 15:
            raise ValueError("Merchant city cannot exceed 15 characters (EMVCo Tag 60 limit)")
        return val

class VerifyBakongAccountInput(BaseModel):
    accountId: str
    token: Optional[str] = None

    @field_validator("accountId")
    @classmethod
    def validate_account(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Bakong Account ID is required")
        val = v.strip().lower()
        if " " in val:
            raise ValueError("Bakong Account ID cannot contain spaces")
        return val

class VerifyBakongAccountResultDto(BaseModel):
    valid: bool
    accountId: str
    accountName: Optional[str] = None
    currency: Optional[str] = None
    errorCode: Optional[int] = None
    message: str

class OrganizationChannelsDto(BaseModel):
    organizationId: str
    organizationName: str
    organizationSlug: str
    storefrontUrl: str
    telegramMiniAppUrl: str
    apiBaseUrl: str
    publicCatalogEndpoint: str
    checkoutEndpoint: str
    telegramBotAuthEndpoint: str
    paywayConfigured: bool
    paywayMerchantId: Optional[str] = None
    bakongConfigured: bool = False
    bakongAccountId: Optional[str] = None
    bakongEnabled: bool = False

