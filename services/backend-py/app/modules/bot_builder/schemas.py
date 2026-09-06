"""
Bot Builder — Pydantic Schemas.
Request/response models for all bot builder endpoints.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ─── Workflow Schemas ────────────────────────────────────────────────────────

class BotWorkflowDto(BaseModel):
    id: str
    organizationId: str
    botId: str
    name: str
    description: Optional[str] = None
    status: str  # DRAFT | PUBLISHED | PAUSED
    draftNodes: List[Dict[str, Any]] = []
    draftEdges: List[Dict[str, Any]] = []
    draftVariables: List[Dict[str, Any]] = []
    publishedVersionId: Optional[str] = None
    publishedVersionNumber: int = 0
    createdBy: Optional[str] = None
    createdAt: str
    updatedAt: Optional[str] = None


class CreateBotWorkflowInput(BaseModel):
    botId: Optional[str] = None
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    draftNodes: List[Dict[str, Any]] = []
    draftEdges: List[Dict[str, Any]] = []
    draftVariables: List[Dict[str, Any]] = []


class UpdateBotWorkflowInput(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    status: Optional[str] = None
    draftNodes: Optional[List[Dict[str, Any]]] = None
    draftEdges: Optional[List[Dict[str, Any]]] = None
    draftVariables: Optional[List[Dict[str, Any]]] = None


class PublishWorkflowInput(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=500)


# ─── Version Schemas ─────────────────────────────────────────────────────────

class BotWorkflowVersionDto(BaseModel):
    id: str
    organizationId: str
    workflowId: str
    versionNumber: int
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    variables: List[Dict[str, Any]] = []
    commands: List[Dict[str, Any]] = []
    publishedBy: Optional[str] = None
    publishedAt: str
    notes: Optional[str] = None


# ─── Command Schemas ─────────────────────────────────────────────────────────

class BotCommandDto(BaseModel):
    id: str
    organizationId: str
    botId: str
    command: str
    description: Optional[str] = None
    workflowId: Optional[str] = None
    scope: str = "default"
    isActive: bool = True
    createdAt: str
    updatedAt: Optional[str] = None


class CreateBotCommandInput(BaseModel):
    command: str = Field(min_length=1, max_length=50)
    description: Optional[str] = Field(default=None, max_length=200)
    workflowId: Optional[str] = None
    scope: str = "default"
    isActive: bool = True


class UpdateBotCommandInput(BaseModel):
    command: Optional[str] = Field(default=None, min_length=1, max_length=50)
    description: Optional[str] = Field(default=None, max_length=200)
    workflowId: Optional[str] = None
    scope: Optional[str] = None
    isActive: Optional[bool] = None


# ─── Execution Schemas ───────────────────────────────────────────────────────

class BotExecutionTraceItemDto(BaseModel):
    nodeId: str
    nodeName: str
    nodeType: str
    status: str  # SUCCESS | FAILED | SKIPPED
    inputData: Optional[Dict[str, Any]] = None
    outputData: Optional[Dict[str, Any]] = None
    errorMessage: Optional[str] = None
    durationMs: int = 0


class BotExecutionDto(BaseModel):
    id: str
    organizationId: str
    botId: str
    workflowId: Optional[str] = None
    workflowVersionId: Optional[str] = None
    versionNumber: Optional[int] = None
    telegramUserId: Optional[str] = None
    chatId: Optional[str] = None
    triggerType: str
    triggerData: Optional[Dict[str, Any]] = None
    executionTrace: List[BotExecutionTraceItemDto] = []
    status: str
    errorMessage: Optional[str] = None
    startedAt: str
    finishedAt: Optional[str] = None


# ─── Conversation State Schemas ──────────────────────────────────────────────

class BotConversationStateDto(BaseModel):
    id: str
    botId: str
    telegramUserId: str
    chatId: str
    workflowId: str
    workflowVersionId: Optional[str] = None
    currentNodeId: Optional[str] = None
    variables: Dict[str, Any] = {}
    waitingForInput: bool = False
    startedAt: str
    updatedAt: Optional[str] = None


# ─── Webhook Registration ───────────────────────────────────────────────────

class RegisterWebhookInput(BaseModel):
    webhookUrl: str = Field(min_length=10, max_length=500)
    secretToken: Optional[str] = Field(default=None, max_length=256)
