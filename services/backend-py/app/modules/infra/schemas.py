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
