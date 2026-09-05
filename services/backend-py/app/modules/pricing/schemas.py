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

class PriceResolveInput(BaseModel):
    basePrice: float = 0.0
    customerTier: str = "REGULAR"
    quantity: int = 1

class PromotionDto(BaseModel):
    id: str
    name: str
    code: str
    type: str
    value: float
    minSpend: float
    isActive: bool

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
