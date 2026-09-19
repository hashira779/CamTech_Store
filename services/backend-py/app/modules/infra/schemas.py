from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class ApproximateGeoSchema(BaseModel):
    country: str = "Cambodia"
    countryCode: Optional[str] = "KH"
    region: Optional[str] = "Phnom Penh"
    city: Optional[str] = "Phnom Penh"
    asn: Optional[str] = "AS136173"
    org: Optional[str] = "SINET"


class InfraOverviewResponse(BaseModel):
    globalStatus: str = "HEALTHY"
    totalServices: int = 9
    healthyServices: int = 9
    degradedServices: int = 0
    downServices: int = 0
    requestsPerSec: float = 0.0
    errorRatePct: float = 0.0
    p95LatencyMs: float = 0.0
    activeIncidentsCount: int = 0
    blockedSourcesCount: int = 0
    breakGlassActive: bool = False
    breakGlassExpiresAt: Optional[datetime] = None


class InfraServiceNodeSchema(BaseModel):
    id: str
    name: str
    port: int
    role: str
    version: str
    status: str
    instancesCount: int = 1
    uptimeSeconds: int = 0
    requestsPerSec: float = 0.0
    errorRatePct: float = 0.0
    p95LatencyMs: float = 0.0
    cpuPct: float = 0.0
    memoryPct: float = 0.0
    dbPingMs: Optional[float] = None
    dependencies: List[str] = []


class TopologyNodeData(BaseModel):
    label: str
    name: str
    port: int
    type: str
    status: str
    rps: float
    p95: float
    errors: float


class TopologyNodeSchema(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    data: TopologyNodeData


class TopologyEdgeSchema(BaseModel):
    id: str
    source: str
    target: str
    animated: bool = True
    label: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class InfraTopologyGraphResponse(BaseModel):
    nodes: List[TopologyNodeSchema]
    edges: List[TopologyEdgeSchema]


class ApiTrafficRequestSchema(BaseModel):
    requestId: str
    traceId: str
    timestamp: datetime
    method: str
    path: str
    targetService: str
    statusCode: int
    durationMs: float
    clientIp: str
    approximateGeo: Optional[ApproximateGeoSchema] = None
    userAgent: Optional[str] = None
    actorId: Optional[str] = None
    isRateLimited: bool = False


class SecurityEventSchema(BaseModel):
    id: str
    timestamp: datetime
    severity: str
    category: str
    ruleId: str
    title: str
    description: Optional[str] = None
    sourceIp: str
    approximateGeo: Optional[ApproximateGeoSchema] = None
    affectedService: str
    signals: Optional[Dict[str, Any]] = None
    defenseAction: Optional[Dict[str, Any]] = None


class IncidentTimelineSchema(BaseModel):
    id: str
    timestamp: datetime
    actor: str
    actionType: str
    description: str
    evidenceRef: Optional[str] = None


class IncidentSchema(BaseModel):
    id: str
    incidentNumber: str
    severity: str
    status: str
    title: str
    description: str
    affectedServices: List[str] = Field(default_factory=list)
    ownerId: Optional[str] = None
    firstSeenAt: datetime
    lastUpdatedAt: datetime
    resolvedAt: Optional[datetime] = None
    timeline: List[IncidentTimelineSchema] = []

    @field_validator("affectedServices", mode="before")
    @classmethod
    def parse_affected_services(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                return []
        return v


class CreateIncidentRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    severity: str = Field("SEV3", description="SEV1, SEV2, SEV3, or SEV4")
    description: str = Field(..., min_length=5)
    affectedServices: List[str] = Field(default_factory=list)


class DeploymentCorrelationSchema(BaseModel):
    id: str
    service: str
    version: str
    commitHash: str
    commitMessage: Optional[str] = None
    environment: str = "production"
    deployerName: str
    deployedAt: datetime
    rollbackState: str = "STABLE"
    errorRateDeltaPct: float = 0.0
    latencyDeltaMs: float = 0.0


class InfraAuditEntrySchema(BaseModel):
    id: str
    timestamp: datetime
    actorId: str
    action: str
    targetResource: str
    ip: Optional[str] = None
    reason: Optional[str] = None
    traceId: Optional[str] = None
    requestId: Optional[str] = None
    isBreakGlass: bool = False


class BreakGlassActivationRequest(BaseModel):
    reason: str = Field(..., min_length=10, description="Mandatory operational justification")
    confirmation: str = Field(..., description="Must type 'I CONFIRM BREAK GLASS'")


# ═════════════════════════════════════════════════════════════════════════════
# ICP — Infrastructure Control Platform Schemas
# ═════════════════════════════════════════════════════════════════════════════

class RegisterAgentRequest(BaseModel):
    hostname: str = Field(..., min_length=1, max_length=255)
    ipAddress: str = Field(..., min_length=1, max_length=45)
    port: int = Field(9100, ge=1, le=65535)
    apiKey: str = Field(..., min_length=8)
    osType: str = Field("linux", pattern="^(linux|windows|darwin)$")
    tags: List[str] = Field(default_factory=list)


class AgentHeartbeatRequest(BaseModel):
    agentId: Optional[str] = None
    hostname: str
    metrics: Dict[str, Any] = Field(default_factory=dict)


class AgentSummarySchema(BaseModel):
    id: str
    hostname: str
    ipAddress: str
    port: int
    osType: str
    status: str
    version: str
    tags: List[str] = Field(default_factory=list)
    lastHeartbeatAt: Optional[str] = None
    latestMetrics: Optional[Dict[str, Any]] = None
    createdAt: Optional[str] = None

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            import json
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        return v or []

    @field_validator("latestMetrics", mode="before")
    @classmethod
    def parse_metrics(cls, v):
        if isinstance(v, str):
            import json
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                return None
        return v



class SendCommandRequest(BaseModel):
    command: str = Field(..., min_length=1)
    breakGlassToken: Optional[str] = None


class AgentCommandSchema(BaseModel):
    id: str
    agentId: str
    actorId: str
    command: str
    status: str
    result: Optional[str] = None
    executedAt: Optional[str] = None
    createdAt: Optional[str] = None


class ServiceActionRequest(BaseModel):
    action: str = Field(..., pattern="^(start|stop|restart|status)$")


class DockerActionRequest(BaseModel):
    action: str = Field(..., pattern="^(start|stop|restart)$")


class DockerComposeActionRequest(BaseModel):
    projectName: str
    action: str = Field("restart", pattern="^(up|down|restart)$")


class RebootServerRequest(BaseModel):
    delaySeconds: int = Field(60, ge=0, le=3600)
    breakGlassToken: str = Field(..., min_length=1, description="Break-glass token required for server reboots")


class CreateScheduledTaskRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    agentId: Optional[str] = None
    cronExpr: str = Field(..., min_length=5, description="Standard cron expression, e.g. '0 4 * * *'")
    command: str = Field(..., min_length=1)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class UpdateScheduledTaskRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    agentId: Optional[str] = None
    cronExpr: Optional[str] = None
    command: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None


class ScheduledTaskSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    agentId: Optional[str] = None
    cronExpr: str
    command: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool
    lastRunAt: Optional[str] = None
    nextRunAt: Optional[str] = None
    lastResult: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    @field_validator("parameters", mode="before")
    @classmethod
    def parse_parameters(cls, v):
        if isinstance(v, str):
            import json
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return v or {}


class SaveCloudflareConfigRequest(BaseModel):
    zoneName: str = Field(..., min_length=1)
    zoneId: str = Field(..., min_length=1)
    apiToken: str = Field(..., min_length=1)
    accountId: Optional[str] = None


class CloudflareConfigSchema(BaseModel):
    id: str
    zoneName: str
    zoneId: str
    accountId: Optional[str] = None
    enabled: bool
    createdAt: Optional[str] = None


class CreateDnsRecordRequest(BaseModel):
    type: str = Field(..., pattern="^(A|AAAA|CNAME|TXT|MX|NS|SRV)$")
    name: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    ttl: int = Field(1, ge=1)
    proxied: bool = True


class PurgeCacheRequest(BaseModel):
    purgeEverything: bool = False
    files: Optional[List[str]] = None


class CreateAlertRuleRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    category: str = Field("INFRA", pattern="^(INFRA|SECURITY|DEPLOYMENT|AVAILABILITY|AGENT)$")
    severity: str = Field("HIGH", pattern="^(CRITICAL|HIGH|MEDIUM|LOW)$")
    condition: Dict[str, Any] = Field(..., description="e.g. {'metric': 'cpu_pct', 'op': '>', 'threshold': 90}")
    channels: List[str] = Field(default_factory=list)
    cooldownSec: int = Field(300, ge=60)
    enabled: bool = True


class AlertRuleSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: str
    severity: str
    condition: Dict[str, Any]
    channels: List[str] = Field(default_factory=list)
    cooldownSec: int
    enabled: bool
    createdAt: Optional[str] = None

    @field_validator("condition", mode="before")
    @classmethod
    def parse_condition(cls, v):
        if isinstance(v, str):
            import json
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return v or {}

    @field_validator("channels", mode="before")
    @classmethod
    def parse_channels(cls, v):
        if isinstance(v, str):
            import json
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        return v or []



class AlertSchema(BaseModel):
    id: str
    ruleId: Optional[str] = None
    agentId: Optional[str] = None
    severity: str
    status: str
    title: str
    description: Optional[str] = None
    firedAt: Optional[str] = None
    acknowledgedAt: Optional[str] = None
    acknowledgedBy: Optional[str] = None
    resolvedAt: Optional[str] = None


class CreateNotificationChannelRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(TELEGRAM|EMAIL|SLACK|WEBHOOK)$")
    config: Dict[str, Any] = Field(..., description="Channel specific secrets, e.g. bot_token, chat_id, webhook_url")
    enabled: bool = True


class NotificationChannelSchema(BaseModel):
    id: str
    name: str
    type: str
    config: Dict[str, Any]
    enabled: bool
    createdAt: Optional[str] = None

    @field_validator("config", mode="before")
    @classmethod
    def parse_config(cls, v):
        if isinstance(v, str):
            import json
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return v or {}


