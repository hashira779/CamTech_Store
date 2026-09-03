from pydantic import BaseModel
from typing import Optional, List

class StockTransferDto(BaseModel):
    id: str
    transferNumber: str
    fromLocationId: str
    toLocationId: str
    status: str
    createdAt: str
