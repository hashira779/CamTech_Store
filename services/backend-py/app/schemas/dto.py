from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Generic, TypeVar
from decimal import Decimal
import datetime

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

# ==============================================================================
# 1. AUTH SCHEMAS
# ==============================================================================

class LoginRequest(BaseModel):
    email: str
    password: str

class UserDto(BaseModel):
    id: str
    organizationId: str
    email: str
    name: str
    roles: List[str]
    permissions: List[str] = []
    locationId: Optional[str] = None

class LoginResponse(BaseModel):
    accessToken: str
    refreshToken: Optional[str] = None
    user: UserDto

class RefreshTokenRequest(BaseModel):
    refreshToken: str

class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"

class OrganizationDto(BaseModel):
    id: str
    name: str
    slug: str
    currency: str
    timezone: str
    taxRatePct: float
    businessType: str
    settings: Optional[str] = None

class UpdateOrganizationInput(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    taxRatePct: Optional[float] = None
    businessType: Optional[str] = None
    settings: Optional[str] = None



# ==============================================================================
# 2. CATALOG & INVENTORY SCHEMAS
# ==============================================================================

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



# ==============================================================================
# 3. SALES & POS SCHEMAS
# ==============================================================================

class SaleLineItemInput(BaseModel):
    variantId: str
    quantity: float
    unitPrice: float
    taxRatePct: float = 0.0

class SalePaymentInput(BaseModel):
    amount: float
    method: str  # CASH, KHQR, CARD, CREDIT
    reference: Optional[str] = None

class CreateSaleInput(BaseModel):
    idempotencyKey: Optional[str] = None
    locationId: Optional[str] = None
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    channel: str = "POS"
    currency: str = "USD"
    items: List[SaleLineItemInput]
    payments: List[SalePaymentInput] = []

class SaleLineItemDto(BaseModel):
    id: str
    variantId: str
    sku: str
    name: str
    quantity: float
    unitPrice: float
    taxRatePct: float
    lineTotal: float

class SalePaymentDto(BaseModel):
    id: str
    amount: float
    method: str
    status: str
    reference: Optional[str] = None

class SaleDto(BaseModel):
    id: str
    idempotencyKey: Optional[str] = None
    saleNumber: str
    channel: str
    status: str
    subtotal: float
    taxTotal: float
    discountTotal: float
    grandTotal: float
    currency: str
    itemCount: int
    customerName: Optional[str] = None
    paymentStatus: str
    createdAt: str
    lineItems: List[SaleLineItemDto] = []
    payments: List[SalePaymentDto] = []


# ==============================================================================
# 4. CUSTOMERS & CRM
# ==============================================================================

class CustomerDto(BaseModel):
    id: str
    code: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    type: str
    notes: Optional[str] = None
    isActive: bool
    creditBalance: float

class CreateCustomerInput(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    type: str = "INDIVIDUAL"
    notes: Optional[str] = None

# ==============================================================================
# 5. FINANCE, ASSETS, TICKETS, WORKFLOWS
# ==============================================================================

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

class ServiceTicketDto(BaseModel):
    id: str
    ticketNumber: str
    subject: str
    description: str
    priority: str
    status: str
    createdAt: str

# ==============================================================================
# 6. INTEGRATIONS & FLOW AUTOMATION
# ==============================================================================

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

class TelegramBindingDto(BaseModel):
    id: str
    chatId: str
    chatTitle: Optional[str] = None
    role: str
    isActive: bool

class AutomationFlowDto(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    isActive: bool
    triggerType: str
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    createdAt: str

class CreateFlowInput(BaseModel):
    name: str
    description: Optional[str] = None
    isActive: Optional[bool] = True
    triggerType: str = "MANUAL"
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

class FlowExecutionDto(BaseModel):
    id: str
    flowId: str
    triggerType: str
    status: str
    triggerPayload: Dict[str, Any] = {}
    executionTrace: List[Dict[str, Any]] = []
    startedAt: str
    finishedAt: Optional[str] = None
