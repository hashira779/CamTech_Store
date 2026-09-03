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

class InventoryItemDto(BaseModel):
    id: str
    organizationId: str
    locationId: str
    locationName: str = "Central Store"
    variantId: str
    productVariantId: str
    sku: str
    productName: str
    variantName: Optional[str] = None
    stockOnHand: float
    availableQty: float
    reorderPoint: float
