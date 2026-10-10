from datetime import datetime
from pydantic import BaseModel, Field
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

