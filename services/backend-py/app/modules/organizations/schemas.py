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
