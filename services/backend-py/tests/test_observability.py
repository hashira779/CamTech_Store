"""Tests for the observability telemetry layer.

Weighted towards the two things that would do real damage if wrong:

  1. Redaction. This layer sees every request, so a gap here builds a
     permanent, searchable archive of credentials (§29).
  2. Honesty of aggregates. The control centre must be able to tell "no traffic"
     apart from "zero errors", because a fabricated number in a monitoring tool
     is worse than a blank panel (§43).

Capture resilience is covered too: telemetry must never raise into a request.
"""

from __future__ import annotations

import asyncio
import datetime
import uuid

import pytest

from app.modules.observability.classification import (
    Classification,
    REDACTED,
    classify_key,
    contains_secret,
    redact_headers,
    redact_mapping,
    redact_path,
    redact_query_string,
    scrub_value,
)
from app.modules.observability.ingestion import TelemetryIngestor
from app.modules.observability.partitioning import (
    month_windows,
    partition_names_for,
)
from app.modules.observability.records import ApiRequestRecord, LogEventRecord, SpanRecord
from app.modules.observability.service import (
    SCOPE_ORGANIZATION,
    SCOPE_PLATFORM,
    resolve_scope,
)

# A structurally valid JWT (signature is meaningless — only the shape matters).
SAMPLE_JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0"
    ".dQw4w9WgXcQdQw4w9WgXcQdQw4w9WgXcQ"
)


# ─── Redaction (§29) ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "key",
    [
        "authorization",
        "Authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
        "password",
        "userPassword",
        "refresh_token",
        "accessToken",
        "client_secret",
        "totp_code",
        "card_number",
        "passkey_blob",
        "x-telegram-bot-api-secret-token",
    ],
)
def test_credential_field_names_classify_as_secret(key):
    assert classify_key(key) is Classification.SECRET


def test_personal_and_tenant_fields_are_classified_but_retained():
    assert classify_key("clientIp") is Classification.SENSITIVE
    assert classify_key("userAgent") is Classification.SENSITIVE
    assert classify_key("organizationId") is Classification.CONFIDENTIAL
    assert classify_key("traceId") is Classification.INTERNAL
    assert classify_key("statusCode") is Classification.PUBLIC


@pytest.mark.parametrize(
    "value",
    [
        SAMPLE_JWT,
        f"Bearer {SAMPLE_JWT}",
        "Basic YWRtaW46c3VwZXJzZWNyZXQxMjM0",
        "sk_live_abc123DEF456",
        "sk_test_abc123DEF456",
        "$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123",
        "-----BEGIN PRIVATE KEY-----",
        "-----BEGIN RSA PRIVATE KEY-----",
    ],
)
def test_credential_shaped_values_are_scrubbed_regardless_of_field_name(value):
    """A credential in an unexpected field must still not be stored."""
    scrubbed = scrub_value(f"prefix {value} suffix")
    assert REDACTED in scrubbed
    assert not contains_secret(scrubbed)


def test_token_in_query_string_is_redacted_but_shape_is_kept():
    redacted = redact_query_string(f"token={SAMPLE_JWT}&page=2&sort=asc")
    assert f"token={REDACTED}" in redacted
    # The surrounding parameters survive — an operator still sees how the
    # endpoint was called.
    assert "page=2" in redacted
    assert "sort=asc" in redacted
    assert not contains_secret(redacted)


def test_every_secret_query_param_name_is_covered():
    query = "&".join(
        [
            "access_token=" + SAMPLE_JWT,
            "refresh_token=abc123def456ghi",
            "api_key=sk_live_zzz999",
            "password=hunter2",
            "secret=topsecretvalue",
        ]
    )
    redacted = redact_query_string(query)
    assert redacted.count(REDACTED) == 5
    assert "hunter2" not in redacted
    assert "topsecretvalue" not in redacted


def test_path_with_embedded_token_is_scrubbed():
    assert not contains_secret(redact_path(f"/api/v1/verify/{SAMPLE_JWT}"))


def test_secret_headers_are_replaced_not_dropped():
    """The key is retained so an investigator can see the header was sent."""
    result = redact_headers(
        [
            ("authorization", f"Bearer {SAMPLE_JWT}"),
            ("user-agent", "curl/8.0"),
            ("x-api-key", "sk_live_secret999"),
        ]
    )
    assert result["authorization"] == REDACTED
    assert result["x-api-key"] == REDACTED
    assert result["user-agent"] == "curl/8.0"


def test_nested_mapping_is_redacted_at_depth():
    payload = {
        "user": {
            "email": "someone@example.com",
            "password": "hunter2",
            "profile": {"refresh_token": SAMPLE_JWT, "displayName": "Jane"},
        },
        "amount": 42,
    }
    result = redact_mapping(payload)

    assert result["user"]["password"] == REDACTED
    # Reached through two non-secret parents, so the walk descends and redacts
    # the leaf rather than the branch.
    assert result["user"]["profile"]["refresh_token"] == REDACTED
    # Non-secret siblings at every level survive.
    assert result["user"]["profile"]["displayName"] == "Jane"
    assert result["amount"] == 42


def test_a_secret_named_branch_is_redacted_whole():
    """A key like "tokens" or "credentials" redacts its entire subtree.

    Broader than strictly necessary, and deliberately so: a container named
    after a credential is far more likely to hold one in a shape we did not
    anticipate than to hold something worth keeping.
    """
    result = redact_mapping({"tokens": {"refresh": SAMPLE_JWT, "note": "keep?"}})
    assert result["tokens"] == REDACTED
    assert not contains_secret(str(result))


def test_redaction_bounds_value_length():
    """Bounds storage growth and the blast radius of an unexpected large body."""
    scrubbed = scrub_value("x" * 10_000)
    assert len(scrubbed) < 10_000
    assert scrubbed.endswith("[truncated]")


def test_truncation_cannot_leak_a_secret_tail():
    """Scrubbing runs before truncation, so a cut cannot smuggle a credential."""
    assert not contains_secret(scrub_value("y" * 2040 + SAMPLE_JWT))


def test_redact_mapping_handles_empty_and_none():
    assert redact_mapping(None) == {}
    assert redact_mapping({}) == {}


# ─── Route templating (§12 aggregation) ──────────────────────────────────────


def test_route_templating_collapses_identifier_segments():
    """Without this, every id is its own endpoint and top-N lists are noise."""
    from app.modules.observability.middleware import template_route

    class _Req:
        def __init__(self, path):
            self.scope = {}
            self.url = type("U", (), {"path": path})()

    assert template_route(_Req(f"/api/v1/products/{uuid.uuid4()}")) == "/api/v1/products/{uuid}"
    assert template_route(_Req("/api/v1/orders/12345")) == "/api/v1/orders/{id}"
    assert template_route(_Req("/api/v1/products")) == "/api/v1/products"
    assert template_route(_Req("/")) == "/"
    # An opaque token-like segment collapses...
    assert template_route(_Req("/api/v1/verify/aB3xQ9zK2mN7pR4tV6wY")) == "/api/v1/verify/{token}"


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/definitely-not-a-route",
        "/api/v1/product-categories",
        "/api/v1/purchase-order-line-items",
        "/api/v1/observability/traffic/summary",
    ],
)
def test_long_hyphenated_slugs_are_not_mistaken_for_identifiers(path):
    """Regression: a long slug must stay itself.

    An earlier heuristic matched any long [A-Za-z0-9_-] run and rewrote
    "definitely-not-a-route" to "{token}", which silently merged unrelated
    endpoints together in the top-endpoint rankings.
    """
    from app.modules.observability.middleware import template_route

    class _Req:
        def __init__(self, p):
            self.scope = {}
            self.url = type("U", (), {"path": p})()

    assert template_route(_Req(path)) == path


def test_router_template_is_preferred_over_heuristics():
    from app.modules.observability.middleware import template_route

    class _Route:
        path = "/api/v1/products/{product_id}"

    class _Req:
        scope = {"route": _Route()}
        url = type("U", (), {"path": "/api/v1/products/99"})()

    assert template_route(_Req()) == "/api/v1/products/{product_id}"


# ─── Ingestion resilience (§30) ──────────────────────────────────────────────


class _RecordingSink:
    def __init__(self):
        self.requests = []
        self.spans = []
        self.logs = []

    async def write_api_requests(self, records):
        self.requests.extend(records)
        return len(records)

    async def write_spans(self, records):
        self.spans.extend(records)
        return len(records)

    async def write_log_events(self, records):
        self.logs.extend(records)
        return len(records)


class _FailingSink(_RecordingSink):
    async def write_api_requests(self, records):
        raise RuntimeError("database unavailable")


def _request_record(i: int = 0) -> ApiRequestRecord:
    return ApiRequestRecord(
        occurred_at=datetime.datetime.utcnow(),
        request_id=f"req-{i}",
        trace_id=f"trace-{i}",
        service="test-service",
        method="GET",
        route="/api/v1/test",
        path="/api/v1/test",
        status_code=200,
        duration_ms=1.5,
    )


async def test_offer_is_non_blocking_and_drops_when_full():
    """A saturated buffer must drop and count, never block the request path."""
    ingestor = TelemetryIngestor(_RecordingSink(), capacity=3)

    assert all(ingestor.offer(_request_record(i)) for i in range(3))
    # Fourth does not raise and does not hang.
    assert ingestor.offer(_request_record(4)) is False

    stats = ingestor.stats()
    assert stats.accepted == 3
    assert stats.dropped_queue_full == 1
    # The drop is visible to the control centre, not silent.
    assert stats.as_dict()["healthy"] is False


async def test_records_are_flushed_to_the_sink():
    sink = _RecordingSink()
    ingestor = TelemetryIngestor(sink, capacity=100)
    await ingestor.start()

    for i in range(5):
        ingestor.offer(_request_record(i))
    ingestor.offer(
        SpanRecord(
            occurred_at=datetime.datetime.utcnow(),
            trace_id="t1",
            span_id="s1",
            name="span",
            service="test-service",
            duration_ms=2.0,
        )
    )
    ingestor.offer(
        LogEventRecord(
            occurred_at=datetime.datetime.utcnow(),
            severity="ERROR",
            message="boom",
            service="test-service",
        )
    )

    await ingestor.stop(drain_timeout=5.0)

    assert len(sink.requests) == 5
    assert len(sink.spans) == 1
    assert len(sink.logs) == 1
    assert ingestor.stats().written == 7


async def test_sink_failure_is_recorded_and_does_not_kill_the_worker():
    """A broken database must degrade telemetry, not crash the pipeline."""
    ingestor = TelemetryIngestor(_FailingSink(), capacity=50)
    await ingestor.start()

    ingestor.offer(_request_record(1))
    await asyncio.sleep(1.4)  # allow one flush cycle

    stats = ingestor.stats()
    assert stats.write_errors >= 1
    assert stats.last_error is not None
    assert stats.running is True  # still alive and accepting

    # And it keeps accepting work rather than refusing.
    assert ingestor.offer(_request_record(2)) is True
    await ingestor.stop(drain_timeout=3.0)


async def test_stats_expose_queue_capacity_for_self_monitoring():
    ingestor = TelemetryIngestor(_RecordingSink(), capacity=7)
    payload = ingestor.stats().as_dict()
    assert payload["queueCapacity"] == 7
    assert set(payload) >= {
        "accepted",
        "written",
        "droppedQueueFull",
        "writeErrors",
        "queueDepth",
        "queueCapacity",
        "running",
        "healthy",
    }


# ─── Partition planning (§31) ────────────────────────────────────────────────


def test_month_windows_are_contiguous_and_month_aligned():
    windows = month_windows(datetime.datetime(2026, 11, 17, 13, 5), months_ahead=2)
    assert len(windows) == 3
    assert windows[0][0] == datetime.datetime(2026, 11, 1)
    # No gaps: each window ends exactly where the next begins.
    for (_, upper), (next_lower, _) in zip(windows, windows[1:]):
        assert upper == next_lower


def test_month_windows_roll_over_a_year_boundary():
    windows = month_windows(datetime.datetime(2026, 12, 3), months_ahead=1)
    assert windows[1][0] == datetime.datetime(2027, 1, 1)


def test_partition_plan_always_includes_the_default_catch_all():
    """The DEFAULT partition is what stops a missing month from losing data."""
    names = partition_names_for("obs_api_requests", datetime.datetime(2026, 9, 16))
    assert "obs_api_requests_default" in names
    assert "obs_api_requests_2026_09" in names


# ─── Tenant scoping (§28, fail closed per §34) ───────────────────────────────


class _User:
    def __init__(self, roles, organization_id="org-1"):
        self.roles = roles
        self.organization_id = organization_id
        self.id = "user-1"


def test_super_admin_reads_across_tenants():
    org, scope = resolve_scope(_User(["SUPER_ADMIN"]))
    assert org is None
    assert scope == SCOPE_PLATFORM


def test_org_admin_is_pinned_to_its_own_tenant():
    """ORG_ADMIN administers one organization, not the platform."""
    org, scope = resolve_scope(_User(["ORG_ADMIN"], organization_id="org-7"))
    assert org == "org-7"
    assert scope == SCOPE_ORGANIZATION


def test_caller_without_an_organization_sees_nothing():
    """Fails closed: an unscoped caller must not fall through to all tenants."""
    org, scope = resolve_scope(_User(["MANAGER"], organization_id=None))
    assert org == "__no_organization__"
    assert scope == SCOPE_ORGANIZATION
    assert org is not None


# ─── Aggregate honesty (§43) ─────────────────────────────────────────────────


async def test_empty_window_reports_no_data_rather_than_zeros():
    """The distinction the whole layer exists to preserve: an empty window must
    not look like a measured zero-error, zero-latency system."""
    from app.core.database import Base, engine
    from app.modules.observability.repository import PostgresTelemetryRepository

    tables = [Base.metadata.tables[t] for t in ("obs_api_requests", "obs_spans", "obs_log_events")]
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=tables, checkfirst=True)

    repo = PostgresTelemetryRepository(engine)
    # A window far in the past, guaranteed to hold nothing.
    until = datetime.datetime.utcnow() - datetime.timedelta(days=3650)
    since = until - datetime.timedelta(minutes=5)

    summary = await repo.traffic_summary(since=since, until=until, organization_id=None)

    assert summary["hasData"] is False
    assert summary["totalRequests"] == 0
    # None, not 0.0 — there is no error rate to report.
    assert summary["errorRatePct"] is None
    assert summary["p95LatencyMs"] is None
    assert summary["p99LatencyMs"] is None


async def test_recorded_requests_produce_real_percentiles():
    from app.core.database import Base, engine
    from app.modules.observability.repository import PostgresTelemetryRepository

    tables = [Base.metadata.tables[t] for t in ("obs_api_requests", "obs_spans", "obs_log_events")]
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=tables, checkfirst=True)

    repo = PostgresTelemetryRepository(engine)
    marker_org = f"obs-test-{uuid.uuid4().hex[:8]}"
    now = datetime.datetime.utcnow()

    # Durations 1..100ms; 10 of them are 5xx.
    records = [
        ApiRequestRecord(
            occurred_at=now - datetime.timedelta(seconds=i),
            request_id=f"r{i}",
            trace_id=f"t{i}",
            service="svc-under-test",
            method="GET",
            route="/api/v1/thing",
            path="/api/v1/thing",
            status_code=500 if i < 10 else 200,
            duration_ms=float(i + 1),
            organization_id=marker_org,
        )
        for i in range(100)
    ]
    written = await repo.write_api_requests(records)
    assert written == 100

    summary = await repo.traffic_summary(
        since=now - datetime.timedelta(minutes=5),
        until=now + datetime.timedelta(seconds=5),
        organization_id=marker_org,
    )

    assert summary["hasData"] is True
    assert summary["totalRequests"] == 100
    assert summary["serverErrors"] == 10
    assert summary["errorRatePct"] == pytest.approx(10.0, abs=0.01)
    # Real percentile_cont over 1..100, not an estimate or a constant.
    assert summary["p50LatencyMs"] == pytest.approx(50.5, abs=1.0)
    assert summary["p95LatencyMs"] == pytest.approx(95.05, abs=1.0)
    assert summary["p50LatencyMs"] < summary["p95LatencyMs"] < summary["p99LatencyMs"]


async def test_topology_edges_are_derived_from_real_parent_child_spans():
    """§10's graph must be evidence of calls that happened, not a diagram."""
    from app.core.database import Base, engine
    from app.modules.observability.repository import PostgresTelemetryRepository

    tables = [Base.metadata.tables[t] for t in ("obs_api_requests", "obs_spans", "obs_log_events")]
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=tables, checkfirst=True)

    repo = PostgresTelemetryRepository(engine)
    now = datetime.datetime.utcnow()
    trace = f"tr-{uuid.uuid4().hex[:10]}"
    upstream = f"upstream-{uuid.uuid4().hex[:6]}"
    downstream = f"downstream-{uuid.uuid4().hex[:6]}"

    await repo.write_spans(
        [
            SpanRecord(
                occurred_at=now,
                trace_id=trace,
                span_id="parent-1",
                name="GET /",
                service=upstream,
                duration_ms=30.0,
                kind="SERVER",
            ),
            SpanRecord(
                occurred_at=now,
                trace_id=trace,
                span_id="child-1",
                parent_span_id="parent-1",
                name="call",
                service=downstream,
                duration_ms=12.0,
                kind="CLIENT",
            ),
        ]
    )

    edges = await repo.observed_dependencies(
        since=now - datetime.timedelta(minutes=5),
        until=now + datetime.timedelta(seconds=5),
    )
    discovered = {(e["source"], e["target"]) for e in edges}
    assert (upstream, downstream) in discovered

    trace_detail = await repo.get_trace(trace)
    assert len(trace_detail["spans"]) == 2


async def test_unsupported_timeseries_bucket_is_rejected():
    """Bucket reaches a SQL interval literal, so only whitelisted values pass."""
    from app.core.database import engine
    from app.modules.observability.repository import PostgresTelemetryRepository

    repo = PostgresTelemetryRepository(engine)
    now = datetime.datetime.utcnow()
    with pytest.raises(ValueError):
        await repo.timeseries(
            since=now - datetime.timedelta(minutes=5),
            until=now,
            bucket="1 minute'; DROP TABLE obs_api_requests; --",
        )
