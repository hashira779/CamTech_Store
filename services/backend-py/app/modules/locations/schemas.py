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

class LocationParentSummaryDto(BaseModel):
    id: str
    name: str
    type: str

class LocationDto(BaseModel):
    id: str
    organizationId: str
    parentId: Optional[str] = None
    type: str
    name: str
    code: Optional[str] = None
    isActive: bool = True
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    parent: Optional[LocationParentSummaryDto] = None
    childrenCount: Optional[int] = 0

class CreateLocationInput(BaseModel):
    name: str
    code: Optional[str] = None
    type: str = "BRANCH"
    parentId: Optional[str] = None

class UpdateLocationInput(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None
    parentId: Optional[str] = None

class LocationTreeNodeDto(BaseModel):
    id: str
    organizationId: str
    parentId: Optional[str] = None
    type: str
    name: str
    code: Optional[str] = None
    createdAt: Optional[str] = None
    children: List['LocationTreeNodeDto'] = []
