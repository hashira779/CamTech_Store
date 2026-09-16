# ==============================================================================
# Observability API Schemas  (spec §33 — documented contracts)
# ==============================================================================
# Response models for the telemetry query API. Every numeric field is nullable
# where "no data" is a real possibility, so a caller can render an honest empty
# state instead of a zero that looks like a measurement (§43).
# ==============================================================================

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TrafficSummaryDto(BaseModel):
    windowStart: datetime.datetime
    windowEnd: datetime.datetime
    windowSeconds: float
    totalRequests: int
    serverErrors: int
    clientErrors: int
    rateLimited: int
    blocked: int
    requestsPerSecond: float
    # Null rather than 0.0 when no requests were observed in the window.
    errorRatePct: Optional[float] = None
    clientErrorRatePct: Optional[float] = None
    p50LatencyMs: Optional[float] = None
    p95LatencyMs: Optional[float] = None
    p99LatencyMs: Optional[float] = None
    maxLatencyMs: Optional[float] = None
    servicesSeen: int
    # Lets the UI distinguish "healthy and quiet" from "not being recorded".
    hasData: bool
    scope: str = Field(
        description="ORGANIZATION when scoped to the caller's tenant, PLATFORM when across all tenants."
    )


class StatusBucketDto(BaseModel):
    statusCode: int
    count: int


class RouteStatDto(BaseModel):
    route: str
    method: str
    requests: int
    server_errors: Optional[int] = None
    p95: Optional[float] = None
    avg_ms: Optional[float] = None


class ServiceStatDto(BaseModel):
    service: str
    requests: int
    server_errors: Optional[int] = None
    p95: Optional[float] = None
    last_seen: Optional[datetime.datetime] = None
    version: Optional[str] = None
    environment: Optional[str] = None
    instances_seen: Optional[int] = None


class SourceStatDto(BaseModel):
    """Observed activity for one source address.

    Counts only. Nothing here asserts intent, identity, or location — §18
    requires network data to be presented as approximate network intelligence.
    """

    clientIp: str
    requests: int
    unauthorized: Optional[int] = None
    forbidden: Optional[int] = None
    rate_limited_status: Optional[int] = None
    rate_limited: Optional[int] = None
    blocked: Optional[int] = None
    distinct_routes: Optional[int] = None
    first_seen: Optional[datetime.datetime] = None
    last_seen: Optional[datetime.datetime] = None


class ApiRequestDto(BaseModel):
    id: str
    occurredAt: datetime.datetime
    requestId: str
    traceId: str
    spanId: Optional[str] = None
    service: str
    environment: Optional[str] = None
    version: Optional[str] = None
    method: str
    route: str
    path: str
    query: Optional[str] = None
    statusCode: int
    durationMs: float
    errorCode: Optional[str] = None
    actorId: Optional[str] = None
    actorType: Optional[str] = None
    organizationId: Optional[str] = None
    clientIp: Optional[str] = None
    userAgent: Optional[str] = None
    rateLimited: bool = False
    blocked: bool = False


class TimeseriesPointDto(BaseModel):
    bucket: datetime.datetime
    requests: int
    server_errors: Optional[int] = None
    client_errors: Optional[int] = None
    rate_limited: Optional[int] = None
    p95: Optional[float] = None


class SpanDto(BaseModel):
    id: str
    occurredAt: datetime.datetime
    traceId: str
    spanId: str
    parentSpanId: Optional[str] = None
    name: str
    kind: str
    service: str
    environment: Optional[str] = None
    durationMs: float
    isError: bool = False
    statusMessage: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None


class TraceDto(BaseModel):
    traceId: str
    spans: List[SpanDto] = []
    requests: List[Dict[str, Any]] = []
    # True when the trace id matched nothing, so the UI can say so plainly
    # rather than rendering an empty waterfall that looks like a bug.
    found: bool = True


class LogEventDto(BaseModel):
    id: str
    occurredAt: datetime.datetime
    severity: str
    message: str
    logger: Optional[str] = None
    service: str
    environment: Optional[str] = None
    version: Optional[str] = None
    traceId: Optional[str] = None
    spanId: Optional[str] = None
    requestId: Optional[str] = None
    errorCode: Optional[str] = None
    fields: Optional[Dict[str, Any]] = None


class DependencyEdgeDto(BaseModel):
    """A service-to-service call observed via parent/child spans in one trace."""

    source: str
    target: str
    calls: int
    p95: Optional[float] = None
    errors: Optional[int] = None


class ObservedTopologyDto(BaseModel):
    windowStart: datetime.datetime
    windowEnd: datetime.datetime
    services: List[ServiceStatDto] = []
    edges: List[DependencyEdgeDto] = []
    # Stated explicitly because a topology derived from traffic only contains
    # what was exercised in the window — an idle service is absent, and that is
    # a fact about the window, not a gap in the data.
    derivedFrom: str = "observed traffic in window"


class PipelineHealthDto(BaseModel):
    """Health of the telemetry pipeline itself (§30, §39)."""

    accepted: int
    written: int
    droppedQueueFull: int
    writeErrors: int
    queueDepth: int
    queueCapacity: int
    running: bool
    healthy: bool
    lastWriteAt: Optional[datetime.datetime] = None
    lastError: Optional[str] = None
    lastErrorAt: Optional[datetime.datetime] = None
    ingestionEnabled: bool
    storage: Optional[Dict[str, Any]] = None
    # Present when ingestion is not running, so the operator is told why the
    # dashboards are empty instead of being left to guess.
    degradedReason: Optional[str] = None
