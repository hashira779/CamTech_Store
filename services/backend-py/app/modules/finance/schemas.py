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

class AccountDto(BaseModel):
    id: str
    organizationId: Optional[str] = None
    code: str
    name: str
    type: str
    category: Optional[str] = "GENERAL"
    balance: Optional[float] = 0.0
    currency: str = "USD"
    description: Optional[str] = None
    isSystem: bool = False
    isActive: bool = True
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class CreateAccountInput(BaseModel):
    code: str
    name: str
    type: str
    currency: Optional[str] = "USD"
    description: Optional[str] = None

class UpdateAccountInput(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    isActive: Optional[bool] = None

class JournalLineItemInput(BaseModel):
    accountId: str
    debit: float = 0.0
    credit: float = 0.0
    memo: Optional[str] = None

class CreateJournalEntryInput(BaseModel):
    description: str
    postingDate: Optional[str] = None
    sourceType: Optional[str] = "MANUAL"
    lines: List[JournalLineItemInput]

class JournalLineDto(BaseModel):
    id: str
    accountId: str
    accountCode: Optional[str] = None
    accountName: Optional[str] = None
    debit: float
    credit: float
    description: Optional[str] = None
    memo: Optional[str] = None

class JournalEntryDto(BaseModel):
    id: str
    entryNumber: str
    date: str
    memo: Optional[str] = None
    status: str
    lines: List[JournalLineDto] = []

class FixedAssetDto(BaseModel):
    id: str
    assetNumber: str
    name: str
    category: str
    purchaseCost: float
    salvageValue: float
    usefulLifeMonths: int
    depreciationMethod: str
    accumulatedDepreciation: float
    bookValue: float
    status: str
