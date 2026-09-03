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
    code: str
    name: str
    type: str
    category: str
    isActive: bool
    currency: str

class JournalLineDto(BaseModel):
    id: str
    accountId: str
    debit: float
    credit: float
    description: Optional[str] = None

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
