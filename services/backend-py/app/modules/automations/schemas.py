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

class DeveloperAppDto(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str

class ApiKeyDto(BaseModel):
    id: str
    name: str
    keyPrefix: str
    scopes: List[str]
    rateLimit: int
    status: str
    createdAt: str

from typing import Dict, Any

class TelegramBindingDto(BaseModel):
    id: str
    chatId: str
    chatTitle: Optional[str] = None
    role: str
    isActive: bool

class AutomationFlowDto(BaseModel):
    id: str
    organizationId: Optional[str] = None
    name: str
    description: Optional[str] = None
    isActive: bool
    triggerType: str
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    createdAt: str
    updatedAt: Optional[str] = None

class CreateFlowInput(BaseModel):
    name: str
    description: Optional[str] = None
    isActive: Optional[bool] = True
    triggerType: str = "MANUAL"
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

class FlowExecutionDto(BaseModel):
    id: str
    organizationId: Optional[str] = None
    flowId: str
    triggerType: str
    status: str
    triggerPayload: Optional[Dict[str, Any]] = None
    executionTrace: Optional[List[Dict[str, Any]]] = None
    startedAt: str
    finishedAt: Optional[str] = None
