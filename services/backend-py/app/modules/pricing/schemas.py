from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class TaxRateDto(BaseModel):
    id: str
    code: Optional[str] = None
    name: str
    ratePct: float
    isInclusive: bool
    isActive: bool = True

class TaxCalculateInput(BaseModel):
    amount: float = 0.0
    ratePct: float = 10.0
    isInclusive: bool = False

class PriceListDto(BaseModel):
    id: str
    name: str
    code: str
    currency: str
    isDefault: bool

class ResolvePriceLineInput(BaseModel):
    productVariantId: str
    quantity: float = 1.0

class PriceResolveInput(BaseModel):
    basePrice: Optional[float] = 0.0
    customerTier: Optional[str] = "REGULAR"
    quantity: Optional[int] = 1
    customerId: Optional[str] = None
    priceListId: Optional[str] = None
    lines: Optional[List[ResolvePriceLineInput]] = None

class ResolvedPriceLineDto(BaseModel):
    productVariantId: str
    quantity: float = 1.0
    basePrice: float = 0.0
    resolvedUnitPrice: float = 0.0
    savingsPerUnit: float = 0.0
    priceSource: str = "BASE_PRICE"
    tierMinQty: Optional[int] = None
    priceListName: Optional[str] = None

class PriceListAppliedSummary(BaseModel):
    id: str
    name: str
    code: str

class ResolvedPricesResultDto(BaseModel):
    priceListApplied: Optional[PriceListAppliedSummary] = None
    lines: List[ResolvedPriceLineDto] = []
    resolvedPrice: Optional[float] = None
    unitPrice: Optional[float] = None
    tier: Optional[str] = None
    quantity: Optional[int] = None

class PromotionDto(BaseModel):
    id: str
    organizationId: Optional[str] = None
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    type: str = "PERCENTAGE"
    scope: str = "ORDER"
    discountValue: float = 0.0
    value: float = 0.0
    minOrderAmount: Optional[float] = 0.0
    minSpend: Optional[float] = 0.0
    maxDiscountAmount: Optional[float] = None
    buyQuantity: Optional[int] = None
    getQuantity: Optional[int] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    usageLimit: Optional[int] = None
    currentUses: int = 0
    isActive: bool = True
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class CreatePromotionInput(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    type: str = "PERCENTAGE"
    scope: Optional[str] = "ORDER"
    discountValue: Optional[float] = None
    value: Optional[float] = None
    minOrderAmount: Optional[float] = None
    minSpend: Optional[float] = None
    maxDiscountAmount: Optional[float] = None
    buyQuantity: Optional[int] = None
    getQuantity: Optional[int] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    usageLimit: Optional[int] = None
    isActive: Optional[bool] = True

class UpdatePromotionInput(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    scope: Optional[str] = None
    discountValue: Optional[float] = None
    value: Optional[float] = None
    minOrderAmount: Optional[float] = None
    minSpend: Optional[float] = None
    maxDiscountAmount: Optional[float] = None
    buyQuantity: Optional[int] = None
    getQuantity: Optional[int] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    usageLimit: Optional[int] = None
    isActive: Optional[bool] = None

class PromotionEvaluateInput(BaseModel):
    type: str = "PERCENTAGE"
    value: float = 10.0
    cartTotal: float = 100.0
    items: List[Dict[str, Any]] = []
    minSpend: float = 0.0

class LoyaltyTxDto(BaseModel):
    id: str
    points: int
    type: str
    reference: Optional[str] = None
    date: str

class LoyaltySummaryDto(BaseModel):
    customerId: str
    pointsBalance: int
    tier: str
    dollarValue: float
    history: List[LoyaltyTxDto] = []
