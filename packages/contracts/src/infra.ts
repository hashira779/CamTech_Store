// ==============================================================================
// CamTech Infra & Security Control Center — Shared TypeScript Contracts
// Domain: https://infra.camtech.cam
// ==============================================================================

export type ServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'MAINTENANCE';

export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';

export type IncidentStatus =
  | 'DETECTED'
  | 'INVESTIGATING'
  | 'MITIGATING'
  | 'MONITORING'
  | 'RESOLVED'
  | 'CLOSED';

export type SecurityEventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SecurityEventCategory =
  | 'AUTH_ABUSE'
  | 'RATE_LIMIT_VIOLATION'
  | 'SUSPICIOUS_SOURCE'
  | 'CREDENTIAL_SPRAY'
  | 'SESSION_ANOMALY'
  | 'WAF_BLOCK';

export interface ApproximateGeoDTO {
  country: string;
  countryCode?: string;
  region?: string;
  city?: string;
  asn?: string;
  org?: string;
}

export interface InfraOverviewDTO {
  globalStatus: ServiceHealthStatus;
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  downServices: number;
  requestsPerSec: number;
  errorRatePct: number;
  p95LatencyMs: number;
  activeIncidentsCount: number;
  blockedSourcesCount: number;
  breakGlassActive: boolean;
  breakGlassExpiresAt?: string | null;
}

export interface InfraServiceNodeDTO {
  id: string;
  name: string;
  port: number;
  role: string;
  version: string;
  status: ServiceHealthStatus;
  instancesCount: number;
  uptimeSeconds: number;
  requestsPerSec: number;
  errorRatePct: number;
  p95LatencyMs: number;
  cpuPct: number;
  memoryPct: number;
  dbPingMs?: number;
  dependencies: string[];
}

export interface TopologyNodeData {
  label: string;
  name: string;
  port: number;
  type: 'GATEWAY' | 'MICROSERVICE' | 'DATABASE' | 'CACHE' | 'PROXY';
  status: ServiceHealthStatus;
  rps: number;
  p95: number;
  errors: number;
}

export interface TopologyNodeDTO {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: TopologyNodeData;
}

export interface TopologyEdgeDTO {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  label?: string;
  data?: {
    rps?: number;
    latencyMs?: number;
    errorRate?: number;
  };
}

export interface InfraTopologyGraphDTO {
  nodes: TopologyNodeDTO[];
  edges: TopologyEdgeDTO[];
}

export interface ApiTrafficRequestDTO {
  requestId: string;
  traceId: string;
  timestamp: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  path: string;
  targetService: string;
  statusCode: number;
  durationMs: number;
  clientIp: string;
  approximateGeo?: ApproximateGeoDTO;
  userAgent?: string;
  actorId?: string;
  isRateLimited?: boolean;
}

export interface SecurityEventDTO {
  id: string;
  timestamp: string;
  severity: SecurityEventSeverity;
  category: SecurityEventCategory;
  ruleId: string;
  title: string;
  description: string;
  sourceIp: string;
  approximateGeo?: ApproximateGeoDTO;
  affectedService: string;
  signals: Record<string, any>;
  defenseAction?: {
    actionTaken: string;
    durationSeconds?: number;
    expiresAt?: string;
  };
}

export interface ActiveBanDTO {
  ip: string;
  reason: string;
  banned_by: string;
  banned_at: number;
  expires_at: number;
  duration_seconds: number;
  ttl_remaining_seconds: number;
}

export interface IncidentTimelineDTO {
  id: string;
  timestamp: string;
  actor: string;
  actionType: string;
  description: string;
  evidenceRef?: string;
}

export interface IncidentDTO {
  id: string;
  incidentNumber: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  affectedServices: string[];
  ownerId?: string;
  ownerName?: string;
  firstSeenAt: string;
  lastUpdatedAt: string;
  resolvedAt?: string | null;
  correlatedDeploymentId?: string;
  timeline: IncidentTimelineDTO[];
}

export interface DeploymentCorrelationDTO {
  id: string;
  service: string;
  version: string;
  commitHash: string;
  commitMessage: string;
  environment: string;
  deployerName: string;
  deployedAt: string;
  rollbackState: 'STABLE' | 'ROLLED_BACK' | 'CANARY';
  errorRateDeltaPct: number;
  latencyDeltaMs: number;
}

export interface InfraAuditEntryDTO {
  id: string;
  timestamp: string;
  actorId: string;
  actorName?: string;
  action: string;
  targetResource: string;
  ip: string;
  reason?: string;
  traceId?: string;
  requestId?: string;
  isBreakGlass: boolean;
}

export interface BreakGlassActivationRequest {
  reason: string;
  confirmation: string;
}

export interface CreateIncidentRequest {
  title: string;
  severity: IncidentSeverity;
  description: string;
  affectedServices: string[];
}
