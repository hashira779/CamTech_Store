# ==============================================================================
# Observability Storage Ports & PostgreSQL Adapter  (spec §32, §33, §34)
# ==============================================================================
# Two narrow ports, one adapter:
#
#   TelemetrySink   the write path. Called by the ingestion worker only.
#   TelemetryQuery  the read path. Called by the query service only.
#
# Callers depend on the protocols, never on this module's concrete class, so
# moving logs to Loki or traces to Tempo later means adding an adapter rather
# than editing the capture path or the API (§32, dependency inversion in §34).
#
# Every aggregate below is computed from rows that were actually recorded. There
# are no fallback constants: an empty window returns zero and null percentiles,
# and the API surfaces that as an honest empty state. A monitoring platform that
# invents a number is worse than one that admits it has no data (§43).
# ==============================================================================

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional, Protocol, Sequence, runtime_checkable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from .records import ApiRequestRecord, LogEventRecord, SpanRecord

# Bucket widths the timeseries endpoint accepts. Whitelisted because the value
# is interpolated into the SQL interval literal; never accept a raw string.
BUCKET_INTERVALS: Dict[str, str] = {
    "10s": "10 seconds",
    "30s": "30 seconds",
    "1m": "1 minute",
    "5m": "5 minutes",
    "15m": "15 minutes",
    "1h": "1 hour",
    "6h": "6 hours",
    "1d": "1 day",
}

SEVERITIES: frozenset[str] = frozenset({"DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"})

MAX_PAGE_SIZE = 500


@runtime_checkable
class TelemetrySink(Protocol):
    """Write port. Implementations must be safe to call concurrently."""

    async def write_api_requests(self, records: Sequence[ApiRequestRecord]) -> int: ...
    async def write_spans(self, records: Sequence[SpanRecord]) -> int: ...
    async def write_log_events(self, records: Sequence[LogEventRecord]) -> int: ...


@runtime_checkable
class TelemetryQuery(Protocol):
    """Read port used by the query service."""

    async def traffic_summary(
        self, *, since: datetime.datetime, until: datetime.datetime, organization_id: Optional[str]
    ) -> Dict[str, Any]: ...


class PostgresTelemetryRepository:
    """PostgreSQL-backed adapter for both ports.

    Uses the engine directly rather than the request-scoped session: telemetry
    writes must not join a business transaction. If they did, a rollback in the
    request would erase the record of that request having happened, and a slow
    telemetry write would extend a business transaction's lock hold.
    """

    def __init__(self, engine: AsyncEngine):
        self._engine = engine

    # ── Write path ────────────────────────────────────────────────────────────

    async def write_api_requests(self, records: Sequence[ApiRequestRecord]) -> int:
        if not records:
            return 0
        statement = text(
            """
            INSERT INTO obs_api_requests (
                id, "occurredAt", "requestId", "traceId", "spanId", "correlationId",
                service, environment, version, instance,
                method, route, path, query, "statusCode", "durationMs",
                "requestBytes", "responseBytes", "errorCode",
                "actorId", "actorType", "organizationId",
                "clientIp", "userAgent", "rateLimited", blocked, "sampleWeight", attributes
            ) VALUES (
                gen_random_uuid()::text, :occurred_at, :request_id, :trace_id, :span_id, :correlation_id,
                :service, :environment, :version, :instance,
                :method, :route, :path, :query, :status_code, :duration_ms,
                :request_bytes, :response_bytes, :error_code,
                :actor_id, :actor_type, :organization_id,
                :client_ip, :user_agent, :rate_limited, :blocked, :sample_weight,
                CAST(:attributes AS jsonb)
            )
            """
        )
        payload = [
            {
                "occurred_at": r.occurred_at,
                "request_id": r.request_id,
                "trace_id": r.trace_id,
                "span_id": r.span_id,
                "correlation_id": r.correlation_id,
                "service": r.service,
                "environment": r.environment,
                "version": r.version,
                "instance": r.instance,
                "method": r.method,
                "route": r.route,
                "path": r.path,
                "query": r.query,
                "status_code": r.status_code,
                "duration_ms": r.duration_ms,
                "request_bytes": r.request_bytes,
                "response_bytes": r.response_bytes,
                "error_code": r.error_code,
                "actor_id": r.actor_id,
                "actor_type": r.actor_type,
                "organization_id": r.organization_id,
                "client_ip": r.client_ip,
                "user_agent": r.user_agent,
                "rate_limited": r.rate_limited,
                "blocked": r.blocked,
                "sample_weight": r.sample_weight,
                "attributes": _json_or_none(r.attributes),
            }
            for r in records
        ]
        async with self._engine.begin() as conn:
            await conn.execute(statement, payload)
        return len(payload)

    async def write_spans(self, records: Sequence[SpanRecord]) -> int:
        if not records:
            return 0
        statement = text(
            """
            INSERT INTO obs_spans (
                id, "occurredAt", "traceId", "spanId", "parentSpanId",
                name, kind, service, environment,
                "durationMs", "isError", "statusMessage", "organizationId", attributes
            ) VALUES (
                gen_random_uuid()::text, :occurred_at, :trace_id, :span_id, :parent_span_id,
                :name, :kind, :service, :environment,
                :duration_ms, :is_error, :status_message, :organization_id,
                CAST(:attributes AS jsonb)
            )
            """
        )
        payload = [
            {
                "occurred_at": r.occurred_at,
                "trace_id": r.trace_id,
                "span_id": r.span_id,
                "parent_span_id": r.parent_span_id,
                "name": r.name,
                "kind": r.kind,
                "service": r.service,
                "environment": r.environment,
                "duration_ms": r.duration_ms,
                "is_error": r.is_error,
                "status_message": r.status_message,
                "organization_id": r.organization_id,
                "attributes": _json_or_none(r.attributes),
            }
            for r in records
        ]
        async with self._engine.begin() as conn:
            await conn.execute(statement, payload)
        return len(payload)

    async def write_log_events(self, records: Sequence[LogEventRecord]) -> int:
        if not records:
            return 0
        statement = text(
            """
            INSERT INTO obs_log_events (
                id, "occurredAt", severity, message, logger,
                service, environment, version,
                "traceId", "spanId", "requestId",
                "actorId", "organizationId", "errorCode", fields
            ) VALUES (
                gen_random_uuid()::text, :occurred_at, :severity, :message, :logger,
                :service, :environment, :version,
                :trace_id, :span_id, :request_id,
                :actor_id, :organization_id, :error_code,
                CAST(:fields AS jsonb)
            )
            """
        )
        payload = [
            {
                "occurred_at": r.occurred_at,
                "severity": r.severity,
                "message": r.message,
                "logger": r.logger,
                "service": r.service,
                "environment": r.environment,
                "version": r.version,
                "trace_id": r.trace_id,
                "span_id": r.span_id,
                "request_id": r.request_id,
                "actor_id": r.actor_id,
                "organization_id": r.organization_id,
                "error_code": r.error_code,
                "fields": _json_or_none(r.fields),
            }
            for r in records
        ]
        async with self._engine.begin() as conn:
            await conn.execute(statement, payload)
        return len(payload)

    # ── Read path ─────────────────────────────────────────────────────────────

    async def traffic_summary(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
        organization_id: Optional[str] = None,
        service: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Request volume, error rate and true latency percentiles for a window.

        Counts use SUM("sampleWeight") rather than COUNT(*) so that enabling
        head sampling later does not quietly understate traffic.
        """
        window_seconds = max((until - since).total_seconds(), 1.0)
        rows = await self._fetch_all(
            f"""
            SELECT
                COALESCE(SUM("sampleWeight"), 0)                                   AS total,
                COALESCE(SUM("sampleWeight") FILTER (WHERE "statusCode" >= 500), 0) AS server_errors,
                COALESCE(SUM("sampleWeight") FILTER (WHERE "statusCode" >= 400
                                                       AND "statusCode" < 500), 0)  AS client_errors,
                COALESCE(SUM("sampleWeight") FILTER (WHERE "rateLimited"), 0)       AS rate_limited,
                COALESCE(SUM("sampleWeight") FILTER (WHERE blocked), 0)             AS blocked,
                percentile_cont(0.50) WITHIN GROUP (ORDER BY "durationMs")          AS p50,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")          AS p95,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY "durationMs")          AS p99,
                MAX("durationMs")                                                   AS max_ms,
                COUNT(DISTINCT service)                                             AS services_seen
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              {self._org_clause(organization_id)}
              {self._service_clause(service)}
            """,
            self._params(since, until, organization_id, service),
        )
        row = rows[0] if rows else {}
        total = int(row.get("total") or 0)
        server_errors = int(row.get("server_errors") or 0)
        client_errors = int(row.get("client_errors") or 0)

        return {
            "windowStart": since,
            "windowEnd": until,
            "windowSeconds": round(window_seconds, 2),
            "totalRequests": total,
            "serverErrors": server_errors,
            "clientErrors": client_errors,
            "rateLimited": int(row.get("rate_limited") or 0),
            "blocked": int(row.get("blocked") or 0),
            # None, not 0, when there is no data — the caller must be able to
            # tell "no traffic" apart from "zero errors".
            "requestsPerSecond": round(total / window_seconds, 3) if total else 0.0,
            "errorRatePct": round((server_errors / total) * 100, 3) if total else None,
            "clientErrorRatePct": round((client_errors / total) * 100, 3) if total else None,
            "p50LatencyMs": _round_or_none(row.get("p50")),
            "p95LatencyMs": _round_or_none(row.get("p95")),
            "p99LatencyMs": _round_or_none(row.get("p99")),
            "maxLatencyMs": _round_or_none(row.get("max_ms")),
            "servicesSeen": int(row.get("services_seen") or 0),
            "hasData": total > 0,
        }

    async def status_distribution(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
        organization_id: Optional[str] = None,
        service: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        return await self._fetch_all(
            f"""
            SELECT "statusCode" AS "statusCode",
                   SUM("sampleWeight")::bigint AS count
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              {self._org_clause(organization_id)}
              {self._service_clause(service)}
            GROUP BY "statusCode"
            ORDER BY "statusCode"
            """,
            self._params(since, until, organization_id, service),
        )

    async def top_routes(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
        organization_id: Optional[str] = None,
        service: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        return await self._fetch_all(
            f"""
            SELECT route,
                   method,
                   SUM("sampleWeight")::bigint AS requests,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" >= 500)::bigint AS server_errors,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95,
                   AVG("durationMs") AS avg_ms
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              {self._org_clause(organization_id)}
              {self._service_clause(service)}
            GROUP BY route, method
            ORDER BY requests DESC
            LIMIT :limit
            """,
            {**self._params(since, until, organization_id, service), "limit": _clamp(limit)},
        )

    async def top_services(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
        organization_id: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        return await self._fetch_all(
            f"""
            SELECT service,
                   SUM("sampleWeight")::bigint AS requests,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" >= 500)::bigint AS server_errors,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95,
                   MAX("occurredAt") AS last_seen
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              {self._org_clause(organization_id)}
            GROUP BY service
            ORDER BY requests DESC
            LIMIT :limit
            """,
            {**self._params(since, until, organization_id, None), "limit": _clamp(limit)},
        )

    async def top_sources(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
        organization_id: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Busiest source addresses in a window.

        Returns observed counts only. Any characterisation of a source as
        suspicious belongs to the detection layer, not to this query — §17
        requires observed facts to stay separable from inference.
        """
        return await self._fetch_all(
            f"""
            SELECT "clientIp" AS "clientIp",
                   SUM("sampleWeight")::bigint AS requests,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 401)::bigint AS unauthorized,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 403)::bigint AS forbidden,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 429)::bigint AS rate_limited_status,
                   SUM("sampleWeight") FILTER (WHERE "rateLimited")::bigint AS rate_limited,
                   SUM("sampleWeight") FILTER (WHERE blocked)::bigint AS blocked,
                   COUNT(DISTINCT route)::bigint AS distinct_routes,
                   MIN("occurredAt") AS first_seen,
                   MAX("occurredAt") AS last_seen
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              AND "clientIp" IS NOT NULL
              {self._org_clause(organization_id)}
            GROUP BY "clientIp"
            ORDER BY requests DESC
            LIMIT :limit
            """,
            {**self._params(since, until, organization_id, None), "limit": _clamp(limit)},
        )

    async def recent_requests(
        self,
        *,
        limit: int = 100,
        organization_id: Optional[str] = None,
        service: Optional[str] = None,
        min_status: Optional[int] = None,
        route_contains: Optional[str] = None,
        trace_id: Optional[str] = None,
        before: Optional[datetime.datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Newest requests first — the live request stream in §12.

        `before` gives keyset pagination; OFFSET over a partitioned, constantly
        growing table degrades badly and skips rows arriving mid-scroll.
        """
        clauses = []
        params: Dict[str, Any] = {"limit": _clamp(limit)}
        if organization_id:
            clauses.append('AND "organizationId" = :organization_id')
            params["organization_id"] = organization_id
        if service:
            clauses.append("AND service = :service")
            params["service"] = service
        if min_status is not None:
            clauses.append('AND "statusCode" >= :min_status')
            params["min_status"] = int(min_status)
        if route_contains:
            clauses.append("AND route ILIKE :route_contains")
            params["route_contains"] = f"%{route_contains}%"
        if trace_id:
            clauses.append('AND "traceId" = :trace_id')
            params["trace_id"] = trace_id
        if before:
            clauses.append('AND "occurredAt" < :before')
            params["before"] = before

        return await self._fetch_all(
            f"""
            SELECT id, "occurredAt", "requestId", "traceId", "spanId",
                   service, environment, version,
                   method, route, path, query, "statusCode", "durationMs",
                   "errorCode", "actorId", "actorType", "organizationId",
                   "clientIp", "userAgent", "rateLimited", blocked
            FROM obs_api_requests
            WHERE 1 = 1
              {" ".join(clauses)}
            ORDER BY "occurredAt" DESC
            LIMIT :limit
            """,
            params,
        )

    async def timeseries(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
        bucket: str = "1m",
        organization_id: Optional[str] = None,
        service: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Bucketed request/error/latency series for charts and §19 baselines."""
        interval = BUCKET_INTERVALS.get(bucket)
        if interval is None:
            raise ValueError(f"Unsupported bucket '{bucket}'. Allowed: {sorted(BUCKET_INTERVALS)}")

        return await self._fetch_all(
            f"""
            SELECT date_bin(INTERVAL '{interval}', "occurredAt", :since) AS bucket,
                   SUM("sampleWeight")::bigint AS requests,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" >= 500)::bigint AS server_errors,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" >= 400
                                                 AND "statusCode" < 500)::bigint AS client_errors,
                   SUM("sampleWeight") FILTER (WHERE "rateLimited")::bigint AS rate_limited,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              {self._org_clause(organization_id)}
              {self._service_clause(service)}
            GROUP BY bucket
            ORDER BY bucket
            """,
            self._params(since, until, organization_id, service),
        )

    async def service_inventory(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
    ) -> List[Dict[str, Any]]:
        """Services that have actually served traffic in the window.

        This is observed inventory, as opposed to a configured list of services
        that may or may not exist. A service absent here served no requests —
        which is information, not an error.
        """
        return await self._fetch_all(
            """
            SELECT service,
                   MAX(version) AS version,
                   MAX(environment) AS environment,
                   SUM("sampleWeight")::bigint AS requests,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" >= 500)::bigint AS server_errors,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95,
                   COUNT(DISTINCT instance)::bigint AS instances_seen,
                   MAX("occurredAt") AS last_seen
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
            GROUP BY service
            ORDER BY requests DESC
            """,
            {"since": since, "until": until},
        )

    async def observed_dependencies(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
    ) -> List[Dict[str, Any]]:
        """Service-to-service edges inferred from shared traces (§10).

        A parent span in service A with a child span in service B is evidence of
        a real call from A to B, so the topology is derived from traffic that
        happened rather than from a hand-maintained diagram.
        """
        return await self._fetch_all(
            """
            SELECT parent.service AS source,
                   child.service  AS target,
                   COUNT(*)::bigint AS calls,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY child."durationMs") AS p95,
                   SUM(CASE WHEN child."isError" THEN 1 ELSE 0 END)::bigint AS errors
            FROM obs_spans child
            JOIN obs_spans parent
              ON parent."spanId" = child."parentSpanId"
             AND parent."traceId" = child."traceId"
            WHERE child."occurredAt" >= :since AND child."occurredAt" < :until
              AND parent.service <> child.service
            GROUP BY parent.service, child.service
            ORDER BY calls DESC
            """,
            {"since": since, "until": until},
        )

    async def get_trace(self, trace_id: str) -> Dict[str, Any]:
        """Every span and request row sharing a trace id, for the waterfall."""
        spans = await self._fetch_all(
            """
            SELECT id, "occurredAt", "traceId", "spanId", "parentSpanId",
                   name, kind, service, environment,
                   "durationMs", "isError", "statusMessage", attributes
            FROM obs_spans
            WHERE "traceId" = :trace_id
            ORDER BY "occurredAt" ASC
            """,
            {"trace_id": trace_id},
        )
        requests = await self._fetch_all(
            """
            SELECT id, "occurredAt", "requestId", "traceId", "spanId",
                   service, method, route, path, "statusCode", "durationMs", "errorCode"
            FROM obs_api_requests
            WHERE "traceId" = :trace_id
            ORDER BY "occurredAt" ASC
            """,
            {"trace_id": trace_id},
        )
        return {"traceId": trace_id, "spans": spans, "requests": requests}

    async def search_logs(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
        severities: Optional[Sequence[str]] = None,
        service: Optional[str] = None,
        trace_id: Optional[str] = None,
        request_id: Optional[str] = None,
        contains: Optional[str] = None,
        organization_id: Optional[str] = None,
        limit: int = 200,
        before: Optional[datetime.datetime] = None,
    ) -> List[Dict[str, Any]]:
        clauses = []
        params: Dict[str, Any] = {"since": since, "until": until, "limit": _clamp(limit)}

        if severities:
            # Whitelist: the values reach an IN clause.
            valid = [s.upper() for s in severities if s.upper() in SEVERITIES]
            if valid:
                clauses.append("AND severity = ANY(:severities)")
                params["severities"] = valid
        if service:
            clauses.append("AND service = :service")
            params["service"] = service
        if trace_id:
            clauses.append('AND "traceId" = :trace_id')
            params["trace_id"] = trace_id
        if request_id:
            clauses.append('AND "requestId" = :request_id')
            params["request_id"] = request_id
        if contains:
            clauses.append("AND message ILIKE :contains")
            params["contains"] = f"%{contains}%"
        if organization_id:
            clauses.append('AND "organizationId" = :organization_id')
            params["organization_id"] = organization_id
        if before:
            clauses.append('AND "occurredAt" < :before')
            params["before"] = before

        return await self._fetch_all(
            f"""
            SELECT id, "occurredAt", severity, message, logger,
                   service, environment, version,
                   "traceId", "spanId", "requestId", "errorCode", fields
            FROM obs_log_events
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              {" ".join(clauses)}
            ORDER BY "occurredAt" DESC
            LIMIT :limit
            """,
            params,
        )

    async def source_activity(
        self,
        *,
        client_ip: str,
        since: datetime.datetime,
        until: datetime.datetime,
    ) -> Dict[str, Any]:
        """Everything observed from one source address (§18).

        Facts only: counts, timings, endpoints touched, defensive actions taken.
        No attribution, no identity inference — an address is not a person.
        """
        totals = await self._fetch_all(
            """
            SELECT SUM("sampleWeight")::bigint AS requests,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 401)::bigint AS unauthorized,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 403)::bigint AS forbidden,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 429)::bigint AS throttled,
                   SUM("sampleWeight") FILTER (WHERE "rateLimited")::bigint AS rate_limited,
                   SUM("sampleWeight") FILTER (WHERE blocked)::bigint AS blocked,
                   COUNT(DISTINCT route)::bigint AS distinct_routes,
                   COUNT(DISTINCT service)::bigint AS distinct_services,
                   MIN("occurredAt") AS first_seen,
                   MAX("occurredAt") AS last_seen
            FROM obs_api_requests
            WHERE "clientIp" = :client_ip
              AND "occurredAt" >= :since AND "occurredAt" < :until
            """,
            {"client_ip": client_ip, "since": since, "until": until},
        )
        routes = await self._fetch_all(
            """
            SELECT route, method, "statusCode" AS "statusCode",
                   SUM("sampleWeight")::bigint AS requests
            FROM obs_api_requests
            WHERE "clientIp" = :client_ip
              AND "occurredAt" >= :since AND "occurredAt" < :until
            GROUP BY route, method, "statusCode"
            ORDER BY requests DESC
            LIMIT 50
            """,
            {"client_ip": client_ip, "since": since, "until": until},
        )
        return {
            "clientIp": client_ip,
            "windowStart": since,
            "windowEnd": until,
            "totals": totals[0] if totals else {},
            "routes": routes,
        }

    async def storage_stats(self) -> Dict[str, Any]:
        """Row counts and on-disk size per telemetry table, for §30 self-health.

        Uses the planner's row estimate rather than COUNT(*): an exact count on
        a partitioned telemetry table is a full scan, and running that on every
        health poll would make the monitoring platform its own worst tenant.
        """
        return {
            "tables": await self._fetch_all(
                """
                SELECT c.relname AS "table",
                       GREATEST(c.reltuples, 0)::bigint AS "estimatedRows",
                       pg_size_pretty(pg_total_relation_size(c.oid)) AS "totalSize",
                       pg_total_relation_size(c.oid) AS "totalBytes"
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = ANY (current_schemas(false))
                  AND c.relname IN ('obs_api_requests', 'obs_spans', 'obs_log_events')
                ORDER BY c.relname
                """,
                {},
            )
        }

    # ── Internals ─────────────────────────────────────────────────────────────

    @staticmethod
    def _org_clause(organization_id: Optional[str]) -> str:
        return 'AND "organizationId" = :organization_id' if organization_id else ""

    @staticmethod
    def _service_clause(service: Optional[str]) -> str:
        return "AND service = :service" if service else ""

    @staticmethod
    def _params(
        since: datetime.datetime,
        until: datetime.datetime,
        organization_id: Optional[str],
        service: Optional[str],
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"since": since, "until": until}
        if organization_id:
            params["organization_id"] = organization_id
        if service:
            params["service"] = service
        return params

    async def _fetch_all(self, sql: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [dict(row) for row in result.mappings().all()]


def _clamp(limit: int) -> int:
    return max(1, min(int(limit), MAX_PAGE_SIZE))


def _round_or_none(value: Any) -> Optional[float]:
    return round(float(value), 2) if value is not None else None


def _json_or_none(value: Optional[Dict[str, Any]]) -> Optional[str]:
    if not value:
        return None
    import json

    return json.dumps(value, default=str)
