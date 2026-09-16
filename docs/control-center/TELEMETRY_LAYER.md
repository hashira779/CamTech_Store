# Telemetry Layer (Phase 2 foundation)

Owner module: `services/backend-py/app/modules/observability/`

This is the measurement layer the Control Center reads. It exists to answer one
question that the rest of the control plane cannot answer on its own: **what
actually happened?**

It owns capture, storage and querying. It owns no opinions — detection, risk
scoring, incidents, playbooks and response actions belong to
`app/modules/infra/`, which consumes these queries.

---

## Why this had to land before the dashboards

The Control Center's overview, API monitor, service map, log explorer and
anomaly baselines (spec §9–§15, §19) all need measured telemetry. Until this
module existed there was no `api_requests`, `logs` or `traces` storage, so the
only way to make those panels render was to hardcode values — which spec §1 and
§43 explicitly forbid.

`TelemetryMiddleware` in `app/core/telemetry.py` was already minting W3C
traceparent headers and emitting structured JSON logs with `traceId`, `spanId`
and `requestId`. Real signal was being generated and then discarded to stdout.
This layer captures it.

---

## Replacing the fabricated values in `app/modules/infra/service.py`

These are the substitutions available now. Each left-hand value is currently a
literal in the infra service.

| Currently hardcoded | Replace with |
|---|---|
| `requestsPerSec=142.50` | `GET /api/v1/observability/traffic/summary` → `requestsPerSecond` |
| `errorRatePct=0.04` | same call → `errorRatePct` (**null** when no traffic) |
| `p95LatencyMs=18.40` | same call → `p95LatencyMs` |
| `healthyServices` / `degradedServices` / `downServices` | `GET /observability/services` gives measured per-service request and error counts; combine with a real probe (see the note on `probe_service_health` below) |
| `requestsPerSec=48.2 if port==4000 else 12.5` | `GET /observability/services` → per-service `requests`, `server_errors`, `p95` |
| `get_recent_traffic()`'s 8 invented rows | `GET /observability/traffic/requests` — real rows, redacted, keyset-paginated |
| `get_topology_graph()`'s hardcoded edges and `"180 rps"` labels | `GET /observability/topology` → edges derived from parent/child spans that share a trace |
| fabricated `clientIp` / `asn` / `country` samples | `GET /observability/sources` and `/observability/sources/{ip}` — observed counts only, no geolocation asserted |

Two things intentionally **not** provided, because inventing them is the problem
this module exists to avoid:

- **CPU and memory per service** (`cpuPct=14.5`, `memoryPct=28.0`). These are
  host metrics, not request telemetry. They need a node exporter or container
  runtime stats feeding a metrics store. Until that exists, show them as
  unavailable rather than as a number.
- **`uptimeSeconds=86400`**. Each service already exposes `/health` with a real
  `uptimeSeconds`; read it from there.

### A blocking bug to fix alongside this

`InfraControlService.probe_service_health` currently catches every exception and
returns `{"status": "HEALTHY", "latencyMs": 1.25}`. A service that is down,
unreachable or timing out therefore reports as healthy, and `get_overview`
additionally hardcodes `degradedServices=0, downServices=0`. That inverts §34's
fail-closed principle: a monitoring platform that cannot report an outage is
worse than none. An unreachable probe should yield `DOWN` (or `UNKNOWN` when the
in-process fallback genuinely is serving that path), never `HEALTHY`.

---

## Contracts

All routes are mounted under `/api/v1` and are read-only. Full OpenAPI is
published through the gateway's `/openapi.json`.

| Route | Permission | Purpose |
|---|---|---|
| `GET /observability/traffic/summary` | `infra.metrics.read` | rate, error rate, p50/p95/p99 |
| `GET /observability/traffic/timeseries` | `infra.metrics.read` | bucketed series (§19 baselines) |
| `GET /observability/traffic/status-codes` | `infra.metrics.read` | status distribution |
| `GET /observability/traffic/top-routes` | `infra.metrics.read` | top endpoints |
| `GET /observability/traffic/requests` | `infra.logs.read` | live request stream |
| `GET /observability/services` | `infra.services.read` | observed service inventory |
| `GET /observability/topology` | `infra.services.read` | observed dependency graph |
| `GET /observability/traces/{trace_id}` | `infra.traces.read` | trace waterfall |
| `GET /observability/logs` | `infra.logs.read` | structured log search |
| `GET /observability/sources` | `infra.metrics.read` | busiest sources (facts only) |
| `GET /observability/sources/{ip}` | `infra.metrics.read` | one source's activity |
| `GET /observability/health` | `infra.services.read` | pipeline self-health (§30) |

### Authorization

The `infra.*` permissions appear in **no row** of `PERMISSIONS_MATRIX`, which
makes them admin-only by construction — `has_permission` grants them solely via
the `SUPER_ADMIN` / `ORG_ADMIN` `*` wildcard. Operational telemetry is
cross-cutting, so defaulting it to platform administrators and requiring a
deliberate matrix entry to widen access is the safe direction to fail in. No
change to `permissions.py` was needed.

### Tenancy (§28)

`resolve_scope()` returns `(organization_filter, scope_label)`:

- `SUPER_ADMIN` → `(None, "PLATFORM")`, reads across all tenants.
- Everyone else → `(own_org_id, "ORGANIZATION")`.
- A caller with no organization → `("__no_organization__", "ORGANIZATION")`,
  which matches nothing. Fails closed rather than falling through to all data.

`ORG_ADMIN` is deliberately **not** a platform role here: it administers one
organization, not the platform. The applied scope is returned in the response
so the operator can see which view they are looking at.

---

## Storage design

Three time-partitioned tables, kept out of the transactional schema so routine
vacuum, backup and restore of business data is not hostage to telemetry volume:

- `obs_api_requests` — one row per served request
- `obs_spans` — trace spans; parent/child pairs across services yield the
  topology edges
- `obs_log_events` — structured logs, correlated by `traceId` / `requestId`

Design points worth knowing before changing them:

- **Monthly `RANGE` partitions on `occurredAt`.** Retention is a `DROP TABLE` of
  a partition, which is instant and reclaims space. Deleting a month of rows
  instead would leave the table bloated and hold a long vacuum hostage.
- **Composite primary keys `(id, occurredAt)`.** Postgres requires the partition
  key in every unique constraint. This is not optional.
- **A `DEFAULT` partition always exists.** An insert must never fail because a
  month was not provisioned; losing telemetry is a silent monitoring outage.
- **BRIN indexes on `occurredAt`.** For append-only time-ordered data they cost
  a fraction of a btree and serve the range scans every dashboard performs.
- **`SUM("sampleWeight")`, never `COUNT(*)`.** If head sampling is enabled
  later, totals stay truthful instead of silently understating traffic.

Partitions are provisioned by `ensure_partitions()` on startup, and
`scripts/auto_migrate.py` creates the tables via `create_all(checkfirst=True)`,
so no hand-written migration is required.

**Known behaviour:** if rows for the current month reach the `DEFAULT` partition
before that month's partition is created, Postgres refuses to create it (it
would have to revalidate the default's constraint). This is logged as a warning
and is non-fatal — the rows stay queryable in `DEFAULT`, just without partition
pruning. Provisioning at startup, before traffic, avoids it.

---

## Redaction (§29)

`classification.py` runs on everything before it reaches storage. Secrets are
dropped on the **write** path, not masked at read time, so no future reader,
export or backup can leak them.

Covered: credential-named headers, query parameters and body keys; and
credential-*shaped* values wherever they appear — JWTs, `Bearer`/`Basic`
credentials, `sk_live_`/`sk_test_` API keys, bcrypt hashes, PEM private keys.
Values are scrubbed before truncation, so a cut cannot smuggle a tail through.

A key named after a credential (`tokens`, `credentials`) redacts its **entire
subtree**. Deliberately broader than strictly necessary: a container named after
a credential is far more likely to hold one in an unanticipated shape than to
hold something worth keeping.

Verified end-to-end — a real JWT sent as `?token=…` is stored as
`token=[REDACTED]&page=2`.

---

## Capture guarantees

In priority order:

1. **Never slow the request down.** Capture is a non-blocking `put_nowait` onto
   a bounded queue; the database write happens later on a background task. An
   operator's dashboard is never worth adding latency to a customer's checkout.
2. **Never fail a request because telemetry failed.** Every path swallows its
   own errors and records them as counters. This is the one place where failing
   open is correct; the alternative is the monitoring layer taking production
   down with it. Authorization still fails closed — a different axis.
3. **Never fail silently.** Drops, write errors and queue depth are exposed at
   `/observability/health` with a `degradedReason`, so a saturated or broken
   pipeline is visible instead of looking like a quiet period of traffic.

Configuration: `OBS_INGESTION_ENABLED`, `OBS_QUEUE_CAPACITY` (10 000),
`OBS_BATCH_SIZE` (200), `OBS_FLUSH_INTERVAL_SECONDS` (1.0), `OBS_CAPTURE_ACTOR`.

`/health`, `/ready`, `/favicon.ico`, `/static/*` and the observability
stream/health endpoints are excluded from capture — a probe hitting `/health`
every second is not traffic, and recording the live-tail endpoint would make the
request stream describe itself.

### Actor attribution

Recorded only where identity is already established by CamTech's own
authenticated systems (§2, §18); nothing is inferred from a network address.
The middleware verifies the bearer token with the same `decode_access_token`
the auth layer uses, so the actor is proven rather than claimed.

To remove that duplicate verification, have `get_current_user` publish the
caller it already resolved:

```python
from app.modules.observability import record_actor
record_actor(request, actor_id=user.id, actor_type="USER",
             organization_id=user.organization_id)
```

The middleware prefers that value when present.

---

## What this layer deliberately does not do

- **No metrics store yet.** Host/container CPU, memory, disk and network (§15)
  need a separate ingestion path. Request-derived metrics are available today;
  resource metrics are not, and should render as unavailable.
- **No detection or risk scoring.** `top_sources` returns counts, never a
  verdict. §17 requires observed facts to stay separable from detection
  inference and analyst conclusion; mixing them here would collapse that
  distinction at the source.
- **No geolocation.** `source_activity` returns an explicit disclaimer instead.
  Adding ASN/country means integrating a real IP-intelligence dataset and
  labelling it approximate — never asserting a person's location or identity.

---

## Tests

`services/backend-py/tests/test_observability.py` — 52 tests, weighted towards
redaction completeness and aggregate honesty, plus capture resilience (a
saturated buffer drops and counts rather than blocking; a failing sink is
recorded without killing the worker).

The load test for ingestion throughput required by §38 is not yet written.
