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

class SaleLineItemInput(BaseModel):
    variantId: str
    quantity: float
    # Price and tax are resolved SERVER-SIDE from the product variant and are
    # never trusted from the client (spec §66/§106). Accepted but ignored, so
    # they are optional — a client need not (and should not) send a price.
    unitPrice: Optional[float] = None
    taxRatePct: Optional[float] = None

class SalePaymentInput(BaseModel):
    amount: float
    method: str  # CASH, KHQR, CARD, CREDIT
    reference: Optional[str] = None

class StoreCheckoutItemInput(BaseModel):
    id: str
    name: str
    price: float
    quantity: float
    sku: Optional[str] = None
    category: Optional[str] = None

class StoreCheckoutInput(BaseModel):
    customerEmail: str
    customerName: str
    customerPhone: Optional[str] = None
    deliveryAddress: Optional[str] = None
    paymentMethod: str = "KHQR"  # KHQR, COD, CASH, CARD, QR
    items: List[StoreCheckoutItemInput]
    notes: Optional[str] = None

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
