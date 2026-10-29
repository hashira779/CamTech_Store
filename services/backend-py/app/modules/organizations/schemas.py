import re
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, model_validator
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
    # The ABA PayWay API key. Send the mask (or blank) back to keep the stored key.
    publicKey: Optional[str] = None
    rsaPublicKey: Optional[str] = None
    rsaPrivateKey: Optional[str] = None
    isProduction: Optional[bool] = False

    @field_validator("merchantId")
    @classmethod
    def validate_payway_merchant_id(cls, v: str) -> str:
        val = (v or "").strip()
        if not val:
            raise ValueError("ABA PayWay Merchant ID is required (from your PayWay merchant portal)")
        if len(val) > 32 or not re.match(r"^[A-Za-z0-9_\-]+$", val):
            raise ValueError("ABA PayWay Merchant ID must be letters, numbers, '-' or '_' (max 32)")
        return val

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

BAKONG_ACCOUNT_TYPES = ("INDIVIDUAL", "MERCHANT")
_PRINTABLE_ASCII = re.compile(r"^[\x20-\x7E]+$")


class BakongConfigDto(BaseModel):
    accountId: str
    accountType: str = "INDIVIDUAL"
    merchantName: str
    merchantId: Optional[str] = None
    acquiringBank: Optional[str] = None
    merchantCity: Optional[str] = "Phnom Penh"
    currency: Optional[str] = "USD"
    enabled: bool = True
    isConfigured: bool = True
    # When the account was last confirmed to exist via Bakong `check_bakong_account`.
    # (That API returns no owner name — the merchant name is what the store enters from its Bakong app.)
    accountVerifiedAt: Optional[str] = None
    accountName: Optional[str] = None
    # Secrets are write-only: GET returns only a mask such as "bk_live_••••••••1a2b".
    hasToken: bool = False
    tokenMasked: Optional[str] = None
    hasWebhookSecret: bool = False
    webhookSecretMasked: Optional[str] = None

class UpdateBakongConfigInput(BaseModel):
    """
    Values exactly as shown in the store's Bakong app. They are written into every KHQR:
    tag 29 (individual) or 30 (merchant) [00 account ID, 01 merchant ID, 02 acquiring bank],
    59 merchant name (max 25), 60 city (max 15). Any invalid value fails the save — nothing is stored.
    """
    accountId: str
    accountType: str = "INDIVIDUAL"
    merchantName: str
    merchantId: Optional[str] = None
    acquiringBank: Optional[str] = None
    merchantCity: Optional[str] = "Phnom Penh"
    currency: Optional[str] = "USD"
    enabled: Optional[bool] = True
    # Omit (or send the mask back) to keep the stored secret; send a new value to replace it.
    token: Optional[str] = None
    webhookSecret: Optional[str] = None

    @field_validator("accountId")
    @classmethod
    def validate_bakong_account_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Bakong Account ID is required")
        val = v.strip().lower()
        if len(val) < 3 or len(val) > 32:
            raise ValueError("Bakong Account ID must be between 3 and 32 characters")
        # KHQR needs the full Bakong ID with its bank suffix, exactly as the Bakong app shows it.
        if not re.match(r"^[a-z0-9_.\-]+@[a-z0-9_.\-]+$", val):
            raise ValueError("Bakong Account ID must look like name@bank (e.g. chhoy_ratha@aclb, 85512345678@wing) — copy it from your Bakong app")
        return val

    @field_validator("accountType")
    @classmethod
    def validate_account_type(cls, v: str) -> str:
        val = (v or "INDIVIDUAL").strip().upper()
        if val not in BAKONG_ACCOUNT_TYPES:
            raise ValueError("Account type must be INDIVIDUAL or MERCHANT")
        return val

    @field_validator("merchantId", "acquiringBank")
    @classmethod
    def validate_merchant_fields(cls, v: Optional[str], info) -> Optional[str]:
        if v is None or not v.strip():
            return None
        val = v.strip()
        label = "Merchant ID" if info.field_name == "merchantId" else "Acquiring bank"
        if len(val) > 32:
            raise ValueError(f"{label} cannot exceed 32 characters")
        if not _PRINTABLE_ASCII.match(val):
            raise ValueError(f"{label} must use English letters, numbers and symbols only")
        return val

    @model_validator(mode="after")
    def require_merchant_details(self):
        if self.accountType == "MERCHANT" and (not self.merchantId or not self.acquiringBank):
            raise ValueError("A MERCHANT account needs both the Merchant ID and the Acquiring Bank shown in your Bakong app")
        return self

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
    def validate_merchant_name(cls, v: str) -> str:
        val = (v or "").strip()
        if not val:
            raise ValueError("Merchant name is required — enter it exactly as shown in your Bakong app")
        if len(val) > 25:
            raise ValueError(f"Merchant name is {len(val)} characters; KHQR allows at most 25")
        if not _PRINTABLE_ASCII.match(val):
            raise ValueError("Merchant name must use English letters, numbers and symbols only (KHQR tag 59)")
        return val

    @field_validator("merchantCity")
    @classmethod
    def validate_merchant_city(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return "Phnom Penh"
        val = v.strip()
        if len(val) > 15:
            raise ValueError(f"Merchant city is {len(val)} characters; KHQR allows at most 15")
        if not _PRINTABLE_ASCII.match(val):
            raise ValueError("Merchant city must use English letters only (KHQR tag 60)")
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
    # TOKEN | NOT_FOUND | RATE_LIMITED | UNREACHABLE | FAILED (see BakongService._classify_failure)
    reason: Optional[str] = None
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

