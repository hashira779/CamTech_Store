from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class WorkflowStepDto(BaseModel):
    id: str
    instanceId: str
    stepOrder: int
    name: str
    assignedRole: Optional[str] = None
    assignedToId: Optional[str] = None
    status: str
    decisionBy: Optional[str] = None
    decisionAt: Optional[str] = None
    comment: Optional[str] = None

class WorkflowLogDto(BaseModel):
    id: str
    instanceId: str
    actorId: Optional[str] = None
    action: str
    comment: Optional[str] = None
    createdAt: str

class WorkflowInstanceDto(BaseModel):
    id: str
    organizationId: str
    definitionId: Optional[str] = None
    entityType: str
    entityId: str
    title: str
    status: str
    submittedById: Optional[str] = None
    currentStep: int
    totalSteps: int
    metadata: Optional[Dict[str, Any]] = None
    steps: List[WorkflowStepDto] = []
    logs: List[WorkflowLogDto] = []
    createdAt: str
    updatedAt: str

class CreateWorkflowStepInput(BaseModel):
    stepOrder: int
    name: str
    assignedRole: Optional[str] = None
    assignedToId: Optional[str] = None

class SubmitApprovalInput(BaseModel):
    entityType: str
    entityId: str
    title: str
    definitionId: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    steps: Optional[List[CreateWorkflowStepInput]] = None

class ReviewWorkflowStepInput(BaseModel):
    action: str  # 'APPROVE' | 'REJECT'
    comment: Optional[str] = None

# Legacy / Approvals schemas
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
