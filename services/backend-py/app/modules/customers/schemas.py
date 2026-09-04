from pydantic import BaseModel
from typing import Optional, List, Generic, TypeVar

T = TypeVar("T")

class PageMeta(BaseModel):
    page: int = 1
    limit: int = 50
    total: int = 0
    totalPages: int = 1

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    meta: PageMeta
    total: Optional[int] = None

class CustomerDto(BaseModel):
    id: str
    organizationId: Optional[str] = None
    code: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    type: str
    loyaltyPoints: Optional[int] = 0
    loyaltyTier: Optional[str] = "BRONZE"
    storeCredit: Optional[float] = 0.0
    creditBalance: Optional[float] = 0.0
    notes: Optional[str] = None
    isActive: bool = True
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class CustomerSyncInput(BaseModel):
    email: str
    name: str
    phone: Optional[str] = None
    avatarUrl: Optional[str] = None
    authProvider: Optional[str] = "google"

class CreateCustomerInput(BaseModel):
    name: str
    code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    type: str = "INDIVIDUAL"
    notes: Optional[str] = None


class UpdateCustomerInput(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    type: Optional[str] = None
    notes: Optional[str] = None
    isActive: Optional[bool] = None
