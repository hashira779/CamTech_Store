# ==============================================================================
# Observability Query API  (spec §33, §28 tenancy, §6 permissions)
# ==============================================================================
# Read-only endpoints the Infra & Security Control Center calls to render real
# telemetry. No endpoint here mutates platform state.
#
# Authorization (§6, §34 "fail closed"): every route requires an `infra.*`
# permission. Those strings appear in no row of PERMISSIONS_MATRIX, which makes
# them admin-only by construction — `has_permission` grants them solely through
# the SUPER_ADMIN / ORG_ADMIN `*` wildcard. Operational telemetry exposes cross-
# cutting detail about the whole platform, so defaulting it to platform
# administrators and requiring a deliberate matrix entry to widen access is the
# safe direction to fail in.
#
# Tenancy (§28): a SUPER_ADMIN reads across all tenants; anyone else is pinned
# to their own organization. The scope applied is returned in the response so
# the operator can see which view they are looking at.
# ==============================================================================

from __future__ import annotations

import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.dependencies import RequirePermissions, TenantUser
from app.core.database import engine

from .ingestion import get_ingestor, ingestion_enabled
from .repository import BUCKET_INTERVALS, PostgresTelemetryRepository
from .schemas import (
    ApiRequestDto,
    DependencyEdgeDto,
    LogEventDto,
    ObservedTopologyDto,
    PipelineHealthDto,
    RouteStatDto,
    ServiceStatDto,
    SourceStatDto,
    StatusBucketDto,
    TimeseriesPointDto,
    TrafficSummaryDto,
    TraceDto,
)
from .service import ObservabilityQueryService, resolve_scope

router = APIRouter(tags=["Observability & Telemetry"])


def _repository() -> PostgresTelemetryRepository:
    return PostgresTelemetryRepository(engine)


def _service() -> ObservabilityQueryService:
    return ObservabilityQueryService(_repository())


# Longest window a single query may span. Bounded so one dashboard cannot ask
# for a year of telemetry and scan every partition.
MAX_WINDOW_MINUTES = 60 * 24 * 31


def _window(
    minutes: int,
    until: Optional[datetime.datetime] = None,
) -> tuple[datetime.datetime, datetime.datetime]:
    if minutes < 1:
        raise HTTPException(status_code=400, detail="minutes must be >= 1")
    if minutes > MAX_WINDOW_MINUTES:
        raise HTTPException(
            status_code=400,
            detail=f"minutes must be <= {MAX_WINDOW_MINUTES} (31 days)",
        )
    end = until or datetime.datetime.utcnow()
    return end - datetime.timedelta(minutes=minutes), end


# ── Traffic & API monitor (§12) ───────────────────────────────────────────────


@router.get("/observability/traffic/summary", response_model=TrafficSummaryDto)
async def traffic_summary(
    minutes: int = Query(15, ge=1, le=MAX_WINDOW_MINUTES),
    service: Optional[str] = Query(None),
    user: TenantUser = Depends(RequirePermissions(["infra.metrics.read"])),
):
    """Request rate, error rate and measured latency percentiles for a window."""
    since, until = _window(minutes)
    org, scope = resolve_scope(user)
    summary = await _service().traffic_summary(
        since=since, until=until, organization_id=org, service=service
    )
    return TrafficSummaryDto(**summary, scope=scope)


@router.get("/observability/traffic/timeseries", response_model=List[TimeseriesPointDto])
async def traffic_timeseries(
    minutes: int = Query(60, ge=1, le=MAX_WINDOW_MINUTES),
    bucket: str = Query("1m"),
    service: Optional[str] = Query(None),
    user: TenantUser = Depends(RequirePermissions(["infra.metrics.read"])),
):
    """Bucketed request/error/latency series for charts and anomaly baselines."""
    if bucket not in BUCKET_INTERVALS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported bucket '{bucket}'. Allowed: {sorted(BUCKET_INTERVALS)}",
        )
    since, until = _window(minutes)
    org, _ = resolve_scope(user)
    rows = await _repository().timeseries(
        since=since, until=until, bucket=bucket, organization_id=org, service=service
    )
    return [TimeseriesPointDto(**row) for row in rows]


@router.get("/observability/traffic/status-codes", response_model=List[StatusBucketDto])
async def status_codes(
    minutes: int = Query(15, ge=1, le=MAX_WINDOW_MINUTES),
    service: Optional[str] = Query(None),
    user: TenantUser = Depends(RequirePermissions(["infra.metrics.read"])),
):
    since, until = _window(minutes)
    org, _ = resolve_scope(user)
    rows = await _repository().status_distribution(
        since=since, until=until, organization_id=org, service=service
    )
    return [StatusBucketDto(**row) for row in rows]


@router.get("/observability/traffic/top-routes", response_model=List[RouteStatDto])
async def top_routes(
    minutes: int = Query(15, ge=1, le=MAX_WINDOW_MINUTES),
    limit: int = Query(20, ge=1, le=200),
    service: Optional[str] = Query(None),
    user: TenantUser = Depends(RequirePermissions(["infra.metrics.read"])),
):
    since, until = _window(minutes)
    org, _ = resolve_scope(user)
    rows = await _repository().top_routes(
        since=since, until=until, organization_id=org, service=service, limit=limit
    )
    return [RouteStatDto(**row) for row in rows]


@router.get("/observability/traffic/requests", response_model=List[ApiRequestDto])
async def recent_requests(
    limit: int = Query(100, ge=1, le=500),
    service: Optional[str] = Query(None),
    min_status: Optional[int] = Query(None, ge=100, le=599),
    route_contains: Optional[str] = Query(None, max_length=200),
    trace_id: Optional[str] = Query(None, max_length=64),
    before: Optional[datetime.datetime] = Query(
        None, description="Keyset cursor: return requests strictly older than this timestamp."
    ),
    user: TenantUser = Depends(RequirePermissions(["infra.logs.read"])),
):
    """The live request stream. Sensitive values are redacted before storage,
    so nothing unredacted can be returned here."""
    org, _ = resolve_scope(user)
    rows = await _repository().recent_requests(
        limit=limit,
        organization_id=org,
        service=service,
        min_status=min_status,
        route_contains=route_contains,
        trace_id=trace_id,
        before=before,
    )
    return [ApiRequestDto(**row) for row in rows]


# ── Services & observed topology (§10, §11) ──────────────────────────────────


@router.get("/observability/services", response_model=List[ServiceStatDto])
async def observed_services(
    minutes: int = Query(15, ge=1, le=MAX_WINDOW_MINUTES),
    user: TenantUser = Depends(RequirePermissions(["infra.services.read"])),
):
    """Services that actually served traffic in the window.

    This is measured inventory. A configured service that served nothing is
    absent, which is itself a signal worth seeing.
    """
    since, until = _window(minutes)
    rows = await _repository().service_inventory(since=since, until=until)
    return [ServiceStatDto(**row) for row in rows]


@router.get("/observability/topology", response_model=ObservedTopologyDto)
async def observed_topology(
    minutes: int = Query(15, ge=1, le=MAX_WINDOW_MINUTES),
    user: TenantUser = Depends(RequirePermissions(["infra.services.read"])),
):
    """Service graph derived from parent/child spans sharing a trace.

    Edges are evidence of calls that happened, not a maintained diagram.
    """
    since, until = _window(minutes)
    repo = _repository()
    services = await repo.service_inventory(since=since, until=until)
    edges = await repo.observed_dependencies(since=since, until=until)
    return ObservedTopologyDto(
        windowStart=since,
        windowEnd=until,
        services=[ServiceStatDto(**row) for row in services],
        edges=[DependencyEdgeDto(**row) for row in edges],
    )


# ── Distributed tracing (§13) ────────────────────────────────────────────────


@router.get("/observability/traces/{trace_id}", response_model=TraceDto)
async def get_trace(
    trace_id: str,
    user: TenantUser = Depends(RequirePermissions(["infra.traces.read"])),
):
    """Every span and request row sharing a trace id, for the waterfall view."""
    if not trace_id or len(trace_id) > 64:
        raise HTTPException(status_code=400, detail="Invalid trace id")
    trace = await _repository().get_trace(trace_id)
    found = bool(trace["spans"] or trace["requests"])
    return TraceDto(
        traceId=trace_id,
        spans=trace["spans"],
        requests=trace["requests"],
        found=found,
    )


# ── Log explorer (§14) ───────────────────────────────────────────────────────


@router.get("/observability/logs", response_model=List[LogEventDto])
async def search_logs(
    minutes: int = Query(60, ge=1, le=MAX_WINDOW_MINUTES),
    severity: Optional[List[str]] = Query(None),
    service: Optional[str] = Query(None),
    trace_id: Optional[str] = Query(None, max_length=64),
    request_id: Optional[str] = Query(None, max_length=64),
    contains: Optional[str] = Query(None, max_length=200),
    limit: int = Query(200, ge=1, le=500),
    before: Optional[datetime.datetime] = Query(None),
    user: TenantUser = Depends(RequirePermissions(["infra.logs.read"])),
):
    since, until = _window(minutes)
    org, _ = resolve_scope(user)
    rows = await _repository().search_logs(
        since=since,
        until=until,
        severities=severity,
        service=service,
        trace_id=trace_id,
        request_id=request_id,
        contains=contains,
        organization_id=org,
        limit=limit,
        before=before,
    )
    return [LogEventDto(**row) for row in rows]


# ── Source intelligence, observed facts only (§18) ───────────────────────────


@router.get("/observability/sources", response_model=List[SourceStatDto])
async def top_sources(
    minutes: int = Query(60, ge=1, le=MAX_WINDOW_MINUTES),
    limit: int = Query(20, ge=1, le=200),
    user: TenantUser = Depends(RequirePermissions(["infra.metrics.read"])),
):
    """Busiest source addresses by observed request count.

    Returns counts and timings only. Characterising a source as suspicious is
    the detection layer's job; §17 requires observed facts to stay separable
    from inference, so no risk verdict is attached here.
    """
    since, until = _window(minutes)
    org, _ = resolve_scope(user)
    rows = await _repository().top_sources(
        since=since, until=until, organization_id=org, limit=limit
    )
    return [SourceStatDto(**row) for row in rows]


@router.get("/observability/sources/{client_ip}")
async def source_activity(
    client_ip: str,
    minutes: int = Query(60 * 24, ge=1, le=MAX_WINDOW_MINUTES),
    user: TenantUser = Depends(RequirePermissions(["infra.metrics.read"])),
):
    """Everything observed from one source address.

    Facts only: request counts, response codes, endpoints touched and the
    defensive actions already applied. No geolocation is asserted here and no
    attempt is made to identify a person from an address (§2, §18).
    """
    if not client_ip or len(client_ip) > 64:
        raise HTTPException(status_code=400, detail="Invalid source address")
    since, until = _window(minutes)
    activity = await _repository().source_activity(
        client_ip=client_ip, since=since, until=until
    )
    activity["disclaimer"] = (
        "Observed request telemetry only. A network address is not an identity "
        "and does not establish a person's location."
    )
    return activity


# ── Pipeline self-monitoring (§30, §39) ──────────────────────────────────────


@router.get("/observability/health", response_model=PipelineHealthDto)
async def pipeline_health(
    user: TenantUser = Depends(RequirePermissions(["infra.services.read"])),
):
    """Health of the telemetry pipeline itself.

    The monitoring platform must not be able to fail silently (§30): if
    ingestion has stopped or is dropping records, that is reported here and the
    control centre can show the dashboards as unreliable rather than empty.
    """
    ingestor = get_ingestor()
    enabled = ingestion_enabled()

    if ingestor is None:
        return PipelineHealthDto(
            accepted=0,
            written=0,
            droppedQueueFull=0,
            writeErrors=0,
            queueDepth=0,
            queueCapacity=0,
            running=False,
            healthy=False,
            ingestionEnabled=enabled,
            degradedReason=(
                "Ingestion is disabled by configuration (OBS_INGESTION_ENABLED)."
                if not enabled
                else "Ingestion has not started in this process; no telemetry is being recorded."
            ),
        )

    stats = ingestor.stats().as_dict()
    storage = None
    try:
        storage = await _repository().storage_stats()
    except Exception:  # noqa: BLE001 - health must not fail because of a sub-probe
        storage = {"error": "storage statistics unavailable"}

    degraded: Optional[str] = None
    if stats["droppedQueueFull"]:
        degraded = (
            f"{stats['droppedQueueFull']} record(s) dropped because the buffer was full — "
            "reported traffic understates actual traffic."
        )
    elif stats["writeErrors"]:
        degraded = f"{stats['writeErrors']} batch write failure(s); see lastError."
    elif not stats["running"]:
        degraded = "Ingestion worker is not running."

    return PipelineHealthDto(
        **stats,
        ingestionEnabled=enabled,
        storage=storage,
        degradedReason=degraded,
    )
