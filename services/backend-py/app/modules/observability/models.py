# ==============================================================================
# Observability Storage Schema  (Control Center spec §31, §32)
# ==============================================================================
# High-volume telemetry is deliberately kept OUT of the transactional tables.
# One request to any service produces one row here, so at even modest traffic
# these tables outgrow the business schema by orders of magnitude. Mixing them
# would make routine vacuum, backup and restore of the business data hostage to
# telemetry volume.
#
# Scaling strategy (§31 "clear scaling strategy"):
#   - Declarative RANGE partitioning on the event timestamp, one partition per
#     month, so retention is a DROP PARTITION (instant, no bloat) rather than a
#     DELETE of millions of rows.
#   - A DEFAULT partition always exists, so an insert can never fail merely
#     because a time partition has not been provisioned yet. Losing telemetry
#     because of a missing partition would be a silent monitoring outage.
#   - BRIN indexes on the timestamp: for append-only time-ordered data they are
#     a fraction of the size of a btree and are what range scans actually need.
#
# Because the tables are partitioned, every primary key is composite and must
# include the partition key — Postgres requires the partition column in any
# unique constraint. Hence (id, occurredAt) rather than (id).
#
# Storage is reached only through app/modules/observability/repository.py, so
# the backend can be swapped for ClickHouse/Loki/Tempo later without touching
# callers (§32 "allow replacing the storage backend later").
# ==============================================================================

from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base
from app.core.datetime_utils import utc_now


def gen_id() -> str:
    return str(uuid.uuid4())


# Partition key column name as it exists in the database (camelCase, matching
# the convention used across this schema).
PARTITION_COLUMN = "occurredAt"


class ObsApiRequest(Base):
    """One HTTP request observed at a service boundary.

    Powers the API traffic monitor (§12), the request-rate / error-rate / p50,
    p95, p99 figures on the command centre (§9), per-service request stats in
    the service inspector (§11), and the traffic-anomaly baselines (§19).

    Nothing in this table is derived or estimated — each row is a request that
    actually happened, recorded by the middleware that served it.
    """

    __tablename__ = "obs_api_requests"
    __table_args__ = (
        # Range scans over time are the access pattern for every dashboard.
        Index("ix_obs_api_requests_occurred_brin", "occurredAt", postgresql_using="brin"),
        # "show me this trace" and "show me this request" lookups.
        Index("ix_obs_api_requests_trace", "traceId"),
        Index("ix_obs_api_requests_request", "requestId"),
        # Per-service and per-route aggregation, newest first.
        Index("ix_obs_api_requests_service_time", "service", "occurredAt"),
        Index("ix_obs_api_requests_route_time", "route", "occurredAt"),
        # Error triage: pull 5xx/4xx for a window without scanning everything.
        Index("ix_obs_api_requests_status_time", "statusCode", "occurredAt"),
        # Source investigation (§18) — group activity by origin.
        Index("ix_obs_api_requests_client_ip_time", "clientIp", "occurredAt"),
        # Tenant isolation checks (§28) are enforced in the query layer, but the
        # index is what makes a tenant-scoped read affordable.
        Index("ix_obs_api_requests_org_time", "organizationId", "occurredAt"),
        {
            "postgresql_partition_by": f'RANGE ("{PARTITION_COLUMN}")',
        },
    )

    id = Column(String, primary_key=True, default=gen_id)
    # Partition key. Part of the PK because Postgres requires it.
    occurred_at = Column(
        PARTITION_COLUMN,
        DateTime,
        primary_key=True,
        default=utc_now,
        server_default=func.now(),
        nullable=False,
    )

    # ── Correlation (§13). These are what let an operator walk from a request
    # to its trace, to a downstream span, to the log lines it emitted.
    request_id = Column("requestId", String, nullable=False)
    trace_id = Column("traceId", String, nullable=False)
    span_id = Column("spanId", String, nullable=True)
    correlation_id = Column("correlationId", String, nullable=True)

    # ── Origin of the observation
    service = Column(String, nullable=False)
    environment = Column(String, nullable=False, server_default="development")
    version = Column(String, nullable=True)
    instance = Column(String, nullable=True)

    # ── The request itself
    method = Column(String, nullable=False)
    # Templated route ("/api/v1/products/{id}") — the aggregation dimension.
    # Without templating, every id becomes its own "endpoint" and the top-N
    # endpoint lists become useless.
    route = Column(String, nullable=False)
    # Concrete path, redacted. Kept for investigation of a single request.
    path = Column(Text, nullable=False)
    query = Column(Text, nullable=True)
    status_code = Column("statusCode", Integer, nullable=False)
    duration_ms = Column("durationMs", Float, nullable=False)
    request_bytes = Column("requestBytes", Integer, nullable=True)
    response_bytes = Column("responseBytes", Integer, nullable=True)
    error_code = Column("errorCode", String, nullable=True)

    # ── Actor, only where already legitimately known (§2, §18). Never derived
    # from the network address.
    actor_id = Column("actorId", String, nullable=True)
    actor_type = Column("actorType", String, nullable=True)  # USER | DRIVER | SERVICE | API_KEY | ANON
    organization_id = Column("organizationId", String, nullable=True)

    # ── Network context. Approximate, and labelled as such everywhere it is
    # surfaced; an address is not an identity.
    client_ip = Column("clientIp", String, nullable=True)
    user_agent = Column("userAgent", Text, nullable=True)

    # ── Defensive outcome (§12 "rate-limit result", §19)
    rate_limited = Column("rateLimited", Boolean, nullable=False, default=False, server_default="false")
    blocked = Column(Boolean, nullable=False, default=False, server_default="false")

    # Sampling weight: 1 means "this row represents one request". If head
    # sampling is enabled the weight rises, and rate calculations multiply by it
    # so the reported totals stay truthful rather than silently undercounting.
    sample_weight = Column("sampleWeight", Integer, nullable=False, default=1, server_default="1")

    attributes = Column(JSONB, nullable=True)


class ObsSpan(Base):
    """A single span of work within a trace (§13).

    Spans are what make the waterfall view possible: gateway → auth → sales →
    postgres, each with its own duration and parent. They share `traceId` with
    ObsApiRequest, which is the join that lets a request drill into its trace.
    """

    __tablename__ = "obs_spans"
    __table_args__ = (
        Index("ix_obs_spans_occurred_brin", "occurredAt", postgresql_using="brin"),
        # Reconstructing one trace is the dominant read.
        Index("ix_obs_spans_trace", "traceId", "occurredAt"),
        Index("ix_obs_spans_parent", "parentSpanId"),
        Index("ix_obs_spans_service_time", "service", "occurredAt"),
        # Find failing spans without scanning a whole partition.
        Index("ix_obs_spans_error_time", "isError", "occurredAt"),
        {
            "postgresql_partition_by": f'RANGE ("{PARTITION_COLUMN}")',
        },
    )

    id = Column(String, primary_key=True, default=gen_id)
    occurred_at = Column(
        PARTITION_COLUMN,
        DateTime,
        primary_key=True,
        default=utc_now,
        server_default=func.now(),
        nullable=False,
    )

    trace_id = Column("traceId", String, nullable=False)
    span_id = Column("spanId", String, nullable=False)
    parent_span_id = Column("parentSpanId", String, nullable=True)

    name = Column(String, nullable=False)
    kind = Column(String, nullable=False, server_default="INTERNAL")  # SERVER|CLIENT|INTERNAL|PRODUCER|CONSUMER
    service = Column(String, nullable=False)
    environment = Column(String, nullable=False, server_default="development")

    duration_ms = Column("durationMs", Float, nullable=False)
    is_error = Column("isError", Boolean, nullable=False, default=False, server_default="false")
    status_message = Column("statusMessage", Text, nullable=True)

    organization_id = Column("organizationId", String, nullable=True)
    attributes = Column(JSONB, nullable=True)


class ObsLogEvent(Base):
    """A structured log line (§14).

    The existing TelemetryMiddleware already emits JSON logs carrying traceId,
    spanId and requestId — this table is where they become searchable and
    correlatable instead of only reaching stdout.
    """

    __tablename__ = "obs_log_events"
    __table_args__ = (
        Index("ix_obs_log_events_occurred_brin", "occurredAt", postgresql_using="brin"),
        Index("ix_obs_log_events_trace", "traceId"),
        Index("ix_obs_log_events_request", "requestId"),
        Index("ix_obs_log_events_service_time", "service", "occurredAt"),
        # Severity filtering is the first thing an operator reaches for.
        Index("ix_obs_log_events_severity_time", "severity", "occurredAt"),
        {
            "postgresql_partition_by": f'RANGE ("{PARTITION_COLUMN}")',
        },
    )

    id = Column(String, primary_key=True, default=gen_id)
    occurred_at = Column(
        PARTITION_COLUMN,
        DateTime,
        primary_key=True,
        default=utc_now,
        server_default=func.now(),
        nullable=False,
    )

    severity = Column(String, nullable=False)  # DEBUG|INFO|WARN|ERROR|CRITICAL
    message = Column(Text, nullable=False)
    logger = Column(String, nullable=True)

    service = Column(String, nullable=False)
    environment = Column(String, nullable=False, server_default="development")
    version = Column(String, nullable=True)

    trace_id = Column("traceId", String, nullable=True)
    span_id = Column("spanId", String, nullable=True)
    request_id = Column("requestId", String, nullable=True)

    actor_id = Column("actorId", String, nullable=True)
    organization_id = Column("organizationId", String, nullable=True)
    error_code = Column("errorCode", String, nullable=True)

    # Remaining structured fields, already redacted. Rendered as readable
    # key/value pairs by the log explorer rather than as a raw JSON blob.
    fields = Column(JSONB, nullable=True)


# Tables that carry a time partition and therefore need partition management.
PARTITIONED_TABLES: tuple[str, ...] = (
    ObsApiRequest.__tablename__,
    ObsSpan.__tablename__,
    ObsLogEvent.__tablename__,
)
