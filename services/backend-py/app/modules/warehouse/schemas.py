from pydantic import BaseModel
from typing import Optional, List

class StockTransferDto(BaseModel):
    id: str
    transferNumber: str
    fromLocationId: str
    toLocationId: str
    status: str
    createdAt: str

class PickingOrderItemDto(BaseModel):
    id: str
    variantId: str
    sku: str
    name: str
    quantity: float
    unitPrice: float
    zone: Optional[str] = "Zone A"
    bin: Optional[str] = "Bin 01"

class PickingOrderDto(BaseModel):
    id: str
    saleNumber: str
    customerName: str
    customerPhone: Optional[str] = None
    deliveryAddress: Optional[str] = None
    itemCount: int
    wmsStatus: str  # PENDING_PICKING, PICKED, DISPATCHED
    items: List[PickingOrderItemDto]
    createdAt: str

class FulfillPickingInput(BaseModel):
    notes: Optional[str] = None
    packerName: Optional[str] = None
