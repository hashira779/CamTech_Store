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

class VariantDto(BaseModel):
    id: str
    productId: str
    sku: str
    name: Optional[str] = None
    barcode: Optional[str] = None
    unit: str = "piece"
    currency: str = "USD"
    costPrice: float = 0.0
    sellPrice: float = 0.0
    taxRatePct: float = 0.0
    marginPct: float = 0.0
    isActive: bool = True
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class ProductDto(BaseModel):
    id: str
    organizationId: str
    categoryId: Optional[str] = None
    brandId: Optional[str] = None
    type: str = "PHYSICAL"
    name: str
    description: Optional[str] = None
    isActive: bool = True
    variants: List[VariantDto] = []
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class CreateVariantInput(BaseModel):
    sku: str
    name: str
    barcode: Optional[str] = None
    costPrice: float = 0.0
    sellPrice: float = 0.0
    taxRatePct: float = 0.0

class CreateProductInput(BaseModel):
    name: str
    description: Optional[str] = None
    categoryId: Optional[str] = None
    brandId: Optional[str] = None
    variants: List[CreateVariantInput] = []

class CategoryDto(BaseModel):
    id: str
    organizationId: str
    parentId: Optional[str] = None
    name: str
    description: Optional[str] = None
    createdAt: Optional[str] = None
    childrenCount: Optional[int] = 0

class CategoryTreeNodeDto(BaseModel):
    id: str
    organizationId: str
    parentId: Optional[str] = None
    name: str
    description: Optional[str] = None
    children: List['CategoryTreeNodeDto'] = []

class CreateCategoryInput(BaseModel):
    name: str
    description: Optional[str] = None
    parentId: Optional[str] = None

class UpdateCategoryInput(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parentId: Optional[str] = None
