from pydantic import BaseModel
from typing import Optional

class ApprovalRequestDto(BaseModel):
    id: str
    entityType: str
    entityId: str
    stepNumber: int
    totalSteps: int
    status: str
    submittedById: Optional[str] = None
    createdAt: str

class ApprovalDecisionInput(BaseModel):
    decision: str = "APPROVED"

class ApprovalSignResponse(BaseModel):
    id: str
    status: str
    approvedBy: str
