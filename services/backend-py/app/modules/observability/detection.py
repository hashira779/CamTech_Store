# ==============================================================================
# Detection Engine  (Control Center spec §16, §17, §19)
# ==============================================================================
# Turns measured request telemetry into security events. This is what makes the
# Threat Center report real activity instead of staying permanently empty.
#
# Every detector is a query over obs_api_requests — rows that record requests
# the platform actually served. Nothing here is generated, sampled from a
# fixture, or inferred from a hand-written scenario.
#
# The discipline §17 demands, enforced structurally in the Finding type:
#
#   observed    measured counts. Facts. "17,912 responses were 401."
#   signals     which thresholds those facts crossed, each with its own
#               explanation, so an operator can audit the reasoning.
#   risk        a weighted heuristic. Ranking aid, never proof.
#   suggested   defensive actions an operator may take. Never auto-executed.
#
# A detection says "this pattern matches automated credential abuse", never
# "this person is an attacker". Heuristics are not intent, and an address is
# not an identity (§2, §18).
#
# All detectors are read-only over telemetry and produce no offensive
# capability: they count requests the platform already answered.
# ==============================================================================

from __future__ import annotations

import datetime
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.telemetry import get_logger

from .eventbus import EVENT_SECURITY, event_bus

logger = get_logger("mystore.observability.detection")

# Analysis window. Long enough for a slow-and-low pattern to accumulate, short
# enough that a live attack surfaces within one cycle.
WINDOW_MINUTES = int(os.getenv("OBS_DETECTION_WINDOW_MINUTES", "10"))

# How often the evaluator runs.
INTERVAL_SECONDS = int(os.getenv("OBS_DETECTION_INTERVAL_SECONDS", "60"))

# Suppression: having raised rule R for source S, stay quiet about that pair for
# this long. Without it an ongoing attack re-raises every cycle and buries the
# operator in duplicates of one event.
COOLDOWN_MINUTES = int(os.getenv("OBS_DETECTION_COOLDOWN_MINUTES", "15"))

SEVERITY_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}

# Route prefixes treated as authentication surface.
AUTH_ROUTE_PATTERN = "%/auth/%"


@dataclass
class Signal:
    """One threshold crossing, with its reasoning attached."""

    name: str
    observed: Any
    threshold: Any
    weight: int
    explanation: str

    def as_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "observed": self.observed,
            "threshold": self.threshold,
            "weight": self.weight,
            "explanation": self.explanation,
        }


@dataclass
class Finding:
    rule_id: str
    category: str
    severity: str
    title: str
    description: str
    source_ip: str
    affected_service: str
    window_start: datetime.datetime
    window_end: datetime.datetime
    observed: Dict[str, Any] = field(default_factory=dict)
    signals: List[Signal] = field(default_factory=list)
    suggested_actions: List[str] = field(default_factory=list)

    @property
    def risk_score(self) -> int:
        """Sum of triggered signal weights, capped at 100.

        Transparent by construction: the contributing signals travel with the
        score, so an operator can see exactly why it is what it is rather than
        being handed an unexplainable number.
        """
        return min(sum(s.weight for s in self.signals), 100)

    def signal_payload(self) -> Dict[str, Any]:
        """Stored in the security event's `signals` column and shown in the UI."""
        return {
            "observed": self.observed,
            "signals": [s.as_dict() for s in self.signals],
            "risk": {
                "score": self.risk_score,
                "method": "sum of triggered signal weights, capped at 100",
                "interpretation": (
                    "Ranking aid for triage. A high score means several detection "
                    "thresholds were crossed together, not that malicious intent "
                    "has been established."
                ),
            },
            "window": {
                "start": self.window_start.isoformat(),
                "end": self.window_end.isoformat(),
                "minutes": WINDOW_MINUTES,
            },
            "suggestedActions": self.suggested_actions,
            "disclaimer": (
                "Derived from observed request telemetry. Network address data is "
                "approximate network intelligence and does not identify a person "
                "or establish their location."
            ),
        }


# ── Detectors ────────────────────────────────────────────────────────────────
# Each returns Findings for the window. Thresholds are env-tunable so an
# operator can calibrate to their own traffic instead of living with ours.


def _threshold(name: str, default: int) -> int:
    try:
        return int(os.getenv(f"OBS_DETECT_{name}", str(default)))
    except ValueError:
        return default


class DetectionEngine:
    def __init__(self, engine: AsyncEngine):
        self._engine = engine

    async def _rows(self, sql: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [dict(r) for r in result.mappings().all()]

    # ── AUTH-001: repeated failed authentication from one source ─────────────

    async def detect_auth_brute_force(
        self, since: datetime.datetime, until: datetime.datetime
    ) -> List[Finding]:
        min_failures = _threshold("AUTH_FAILURES", 20)
        rows = await self._rows(
            """
            SELECT "clientIp",
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 401)::bigint AS failures,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" < 400)::bigint AS successes,
                   SUM("sampleWeight")::bigint AS total,
                   COUNT(DISTINCT route)::bigint AS routes,
                   MIN("occurredAt") AS first_seen,
                   MAX("occurredAt") AS last_seen,
                   MAX(service) AS service
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              AND "clientIp" IS NOT NULL
              AND route ILIKE :auth_pattern
            GROUP BY "clientIp"
            HAVING SUM("sampleWeight") FILTER (WHERE "statusCode" = 401) >= :min_failures
            """,
            {"since": since, "until": until, "auth_pattern": AUTH_ROUTE_PATTERN, "min_failures": min_failures},
        )

        findings = []
        for row in rows:
            failures = int(row["failures"] or 0)
            successes = int(row["successes"] or 0)
            duration = max((row["last_seen"] - row["first_seen"]).total_seconds(), 1.0)
            rate_per_min = round(failures / (duration / 60.0), 2)

            signals = [
                Signal(
                    "repeated_failed_authentication",
                    failures,
                    min_failures,
                    35,
                    f"{failures} authentication attempts returned 401 in the window.",
                )
            ]
            if successes == 0:
                signals.append(
                    Signal(
                        "no_successful_authentication",
                        successes,
                        0,
                        20,
                        "No attempt from this source succeeded, which is consistent with "
                        "guessing rather than a user mistyping a known password.",
                    )
                )
            if rate_per_min >= _threshold("AUTH_RATE_PER_MIN", 10):
                signals.append(
                    Signal(
                        "automated_request_rate",
                        rate_per_min,
                        _threshold("AUTH_RATE_PER_MIN", 10),
                        25,
                        f"{rate_per_min} failed attempts per minute exceeds a plausible "
                        "human typing rate, indicating automation.",
                    )
                )

            severity = "CRITICAL" if failures >= min_failures * 10 else ("HIGH" if failures >= min_failures * 3 else "MEDIUM")
            findings.append(
                Finding(
                    rule_id="AUTH-001",
                    category="AUTHENTICATION_ABUSE",
                    severity=severity,
                    title=f"Repeated authentication failures from {row['clientIp']}",
                    description=(
                        f"{failures} failed authentication attempts and {successes} successes "
                        f"observed from this source across {row['routes']} auth route(s)."
                    ),
                    source_ip=row["clientIp"],
                    affected_service=row["service"] or "auth-service",
                    window_start=since,
                    window_end=until,
                    observed={
                        "failedAuthentications": failures,
                        "successfulAuthentications": successes,
                        "totalRequests": int(row["total"] or 0),
                        "distinctAuthRoutes": int(row["routes"] or 0),
                        "failuresPerMinute": rate_per_min,
                        "firstSeen": row["first_seen"].isoformat(),
                        "lastSeen": row["last_seen"].isoformat(),
                    },
                    signals=signals,
                    suggested_actions=[
                        "Review the targeted accounts for successful logins from this source",
                        "Apply a stricter rate limit to this source",
                        "Block this source temporarily if the pattern continues",
                    ],
                )
            )
        return findings

    # ── ENUM-001: endpoint enumeration / scanning ────────────────────────────

    async def detect_endpoint_enumeration(
        self, since: datetime.datetime, until: datetime.datetime
    ) -> List[Finding]:
        min_missing_routes = _threshold("ENUM_ROUTES", 15)
        rows = await self._rows(
            """
            SELECT "clientIp",
                   COUNT(DISTINCT route) FILTER (WHERE "statusCode" = 404)::bigint AS missing_routes,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 404)::bigint AS not_found,
                   SUM("sampleWeight")::bigint AS total,
                   MAX(service) AS service,
                   MIN("occurredAt") AS first_seen,
                   MAX("occurredAt") AS last_seen
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              AND "clientIp" IS NOT NULL
            GROUP BY "clientIp"
            HAVING COUNT(DISTINCT route) FILTER (WHERE "statusCode" = 404) >= :min_routes
            """,
            {"since": since, "until": until, "min_routes": min_missing_routes},
        )

        findings = []
        for row in rows:
            missing = int(row["missing_routes"] or 0)
            total = int(row["total"] or 0)
            not_found = int(row["not_found"] or 0)
            miss_ratio = round((not_found / total) * 100, 1) if total else 0.0

            signals = [
                Signal(
                    "unusual_endpoint_enumeration",
                    missing,
                    min_missing_routes,
                    30,
                    f"Requests to {missing} distinct paths that do not exist — consistent "
                    "with probing for undocumented endpoints.",
                )
            ]
            if miss_ratio >= 70:
                signals.append(
                    Signal(
                        "majority_requests_not_found",
                        f"{miss_ratio}%",
                        "70%",
                        25,
                        f"{miss_ratio}% of this source's requests returned 404, so it is "
                        "not following links from a real application.",
                    )
                )
            findings.append(
                Finding(
                    rule_id="ENUM-001",
                    category="RECONNAISSANCE",
                    severity="HIGH" if miss_ratio >= 70 else "MEDIUM",
                    title=f"Endpoint enumeration from {row['clientIp']}",
                    description=(
                        f"{not_found} requests to {missing} distinct non-existent paths "
                        f"({miss_ratio}% of this source's traffic)."
                    ),
                    source_ip=row["clientIp"],
                    affected_service=row["service"] or "api-gateway",
                    window_start=since,
                    window_end=until,
                    observed={
                        "distinctMissingRoutes": missing,
                        "notFoundResponses": not_found,
                        "totalRequests": total,
                        "notFoundRatioPct": miss_ratio,
                        "firstSeen": row["first_seen"].isoformat(),
                        "lastSeen": row["last_seen"].isoformat(),
                    },
                    signals=signals,
                    suggested_actions=[
                        "Confirm no sensitive endpoint responded differently to this source",
                        "Apply a stricter rate limit to this source",
                    ],
                )
            )
        return findings

    # ── AUTHZ-001: repeated authorization failures ───────────────────────────

    async def detect_authorization_probing(
        self, since: datetime.datetime, until: datetime.datetime
    ) -> List[Finding]:
        min_denied = _threshold("AUTHZ_DENIALS", 15)
        rows = await self._rows(
            """
            SELECT "clientIp",
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 403)::bigint AS denied,
                   COUNT(DISTINCT route) FILTER (WHERE "statusCode" = 403)::bigint AS denied_routes,
                   MAX("actorId") AS actor_id,
                   MAX(service) AS service,
                   MIN("occurredAt") AS first_seen,
                   MAX("occurredAt") AS last_seen
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              AND "clientIp" IS NOT NULL
            GROUP BY "clientIp"
            HAVING SUM("sampleWeight") FILTER (WHERE "statusCode" = 403) >= :min_denied
            """,
            {"since": since, "until": until, "min_denied": min_denied},
        )

        findings = []
        for row in rows:
            denied = int(row["denied"] or 0)
            routes = int(row["denied_routes"] or 0)
            signals = [
                Signal(
                    "repeated_authorization_failure",
                    denied,
                    min_denied,
                    30,
                    f"{denied} requests were refused by authorization.",
                )
            ]
            if routes >= 5:
                signals.append(
                    Signal(
                        "breadth_of_denied_endpoints",
                        routes,
                        5,
                        25,
                        f"Denials span {routes} distinct endpoints, which looks like a "
                        "search for something reachable rather than one mis-clicked link.",
                    )
                )
            findings.append(
                Finding(
                    rule_id="AUTHZ-001",
                    category="PRIVILEGE_PROBING",
                    severity="HIGH" if routes >= 5 else "MEDIUM",
                    title=f"Repeated authorization denials from {row['clientIp']}",
                    description=(
                        f"{denied} forbidden responses across {routes} endpoint(s). "
                        "Authorization held in every case."
                    ),
                    source_ip=row["clientIp"],
                    affected_service=row["service"] or "api-gateway",
                    window_start=since,
                    window_end=until,
                    observed={
                        "deniedRequests": denied,
                        "distinctDeniedRoutes": routes,
                        # Only identity the platform already authenticated (§18).
                        "authenticatedActorId": row["actor_id"],
                        "firstSeen": row["first_seen"].isoformat(),
                        "lastSeen": row["last_seen"].isoformat(),
                    },
                    signals=signals,
                    suggested_actions=[
                        "Review whether the associated account's role assignment is correct",
                        "Check for a credential shared outside its intended scope",
                    ],
                )
            )
        return findings

    # ── RATE-001: sustained rate-limit violations ────────────────────────────

    async def detect_rate_limit_abuse(
        self, since: datetime.datetime, until: datetime.datetime
    ) -> List[Finding]:
        min_throttled = _threshold("THROTTLED", 25)
        rows = await self._rows(
            """
            SELECT "clientIp",
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 429 OR "rateLimited")::bigint AS throttled,
                   SUM("sampleWeight")::bigint AS total,
                   MAX(service) AS service,
                   MIN("occurredAt") AS first_seen,
                   MAX("occurredAt") AS last_seen
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              AND "clientIp" IS NOT NULL
            GROUP BY "clientIp"
            HAVING SUM("sampleWeight") FILTER (WHERE "statusCode" = 429 OR "rateLimited") >= :min_throttled
            """,
            {"since": since, "until": until, "min_throttled": min_throttled},
        )

        findings = []
        for row in rows:
            throttled = int(row["throttled"] or 0)
            total = int(row["total"] or 0)
            findings.append(
                Finding(
                    rule_id="RATE-001",
                    category="TRAFFIC_ABUSE",
                    severity="HIGH" if throttled >= min_throttled * 4 else "MEDIUM",
                    title=f"Sustained rate-limit violations from {row['clientIp']}",
                    description=(
                        f"{throttled} of {total} requests were throttled. The rate limiter "
                        "absorbed them; this is a record of defence working, not of a breach."
                    ),
                    source_ip=row["clientIp"],
                    affected_service=row["service"] or "api-gateway",
                    window_start=since,
                    window_end=until,
                    observed={
                        "throttledRequests": throttled,
                        "totalRequests": total,
                        "throttledRatioPct": round((throttled / total) * 100, 1) if total else 0.0,
                        "firstSeen": row["first_seen"].isoformat(),
                        "lastSeen": row["last_seen"].isoformat(),
                    },
                    signals=[
                        Signal(
                            "repeated_429_responses",
                            throttled,
                            min_throttled,
                            30,
                            f"{throttled} requests exceeded the configured rate limit and "
                            "continued after being throttled.",
                        )
                    ],
                    suggested_actions=[
                        "Confirm this is not a misconfigured first-party integration",
                        "Escalate to a temporary block if the source ignores throttling",
                    ],
                )
            )
        return findings

    # ── SPIKE-001: traffic anomaly against the source's own baseline (§19) ───

    async def detect_traffic_spike(
        self, since: datetime.datetime, until: datetime.datetime
    ) -> List[Finding]:
        multiple = float(os.getenv("OBS_DETECT_SPIKE_MULTIPLE", "8"))
        min_current = _threshold("SPIKE_MIN_REQUESTS", 100)
        # A source with no history is not spiking — it is new. Flagging "no
        # baseline" as an anomaly would fire on every first-time mobile user,
        # CI job and fresh integration, and an operator who learns the page
        # cries wolf stops reading it. A brand-new source therefore has to clear
        # a much higher absolute bar before it is worth anyone's attention.
        new_source_min = _threshold("SPIKE_NEW_SOURCE_MIN_REQUESTS", 1000)
        window_seconds = (until - since).total_seconds()
        baseline_start = since - datetime.timedelta(seconds=window_seconds * 6)

        rows = await self._rows(
            """
            WITH current AS (
                SELECT "clientIp", SUM("sampleWeight")::bigint AS requests
                FROM obs_api_requests
                WHERE "occurredAt" >= :since AND "occurredAt" < :until
                  AND "clientIp" IS NOT NULL
                GROUP BY "clientIp"
            ),
            baseline AS (
                SELECT "clientIp", SUM("sampleWeight")::numeric / 6 AS avg_requests
                FROM obs_api_requests
                WHERE "occurredAt" >= :baseline_start AND "occurredAt" < :since
                  AND "clientIp" IS NOT NULL
                GROUP BY "clientIp"
            )
            SELECT c."clientIp",
                   c.requests,
                   COALESCE(b.avg_requests, 0) AS baseline,
                   (b.avg_requests IS NOT NULL AND b.avg_requests > 0) AS has_baseline
            FROM current c
            LEFT JOIN baseline b ON b."clientIp" = c."clientIp"
            WHERE
              -- Known source: anomalous relative to its own recent behaviour.
              (b.avg_requests IS NOT NULL AND b.avg_requests > 0
               AND c.requests >= :min_current
               AND c.requests >= b.avg_requests * :multiple)
              -- Unknown source: no baseline to compare, so only extreme
              -- absolute volume qualifies.
              OR ((b.avg_requests IS NULL OR b.avg_requests = 0)
                  AND c.requests >= :new_source_min)
            """,
            {
                "since": since,
                "until": until,
                "baseline_start": baseline_start,
                "min_current": min_current,
                "multiple": multiple,
                "new_source_min": new_source_min,
            },
        )

        findings = []
        for row in rows:
            current = int(row["requests"] or 0)
            baseline = float(row["baseline"] or 0)
            has_baseline = bool(row["has_baseline"])
            delta = round(current / baseline, 1) if has_baseline and baseline > 0 else None

            if has_baseline:
                signal = Signal(
                    "abnormal_request_rate",
                    current,
                    f">= {multiple}x baseline ({round(baseline, 1)})",
                    30,
                    f"Volume is {delta}x this source's own recent average.",
                )
                description = (
                    f"{current} requests in this window against a prior average of "
                    f"{round(baseline, 1)} ({delta}x baseline)."
                )
                severity = "HIGH" if (delta or 0) >= multiple * 2 else "MEDIUM"
            else:
                # Stated plainly so nobody mistakes "new" for "anomalous".
                signal = Signal(
                    "high_volume_from_unknown_source",
                    current,
                    f">= {new_source_min} requests",
                    25,
                    f"{current} requests from a source with no prior recorded activity. "
                    "There is no baseline to compare against, so this is flagged on "
                    "absolute volume alone and may be a legitimate new client.",
                )
                description = (
                    f"{current} requests from a previously unseen source. No baseline "
                    "exists for comparison; flagged on absolute volume."
                )
                severity = "MEDIUM"

            findings.append(
                Finding(
                    rule_id="SPIKE-001",
                    category="TRAFFIC_ANOMALY",
                    severity=severity,
                    title=f"Traffic spike from {row['clientIp']}",
                    description=description,
                    source_ip=row["clientIp"],
                    affected_service="api-gateway",
                    window_start=since,
                    window_end=until,
                    observed={
                        "currentWindowRequests": current,
                        "baselineAveragePerWindow": round(baseline, 2) if has_baseline else None,
                        "deltaMultiple": delta,
                        "baselineWindows": 6,
                        "hasBaseline": has_baseline,
                    },
                    signals=[signal],
                    suggested_actions=[
                        "Check whether upstream CDN/WAF protection is engaged",
                        "Apply traffic shaping or a stricter rate limit",
                        "Application-level limits do not replace upstream DDoS protection",
                    ],
                )
            )
        return findings

    # ── SESS-001: one account seen from many sources ─────────────────────────

    async def detect_session_anomaly(
        self, since: datetime.datetime, until: datetime.datetime
    ) -> List[Finding]:
        min_ips = _threshold("ACTOR_DISTINCT_IPS", 5)
        rows = await self._rows(
            """
            SELECT "actorId",
                   COUNT(DISTINCT "clientIp")::bigint AS distinct_ips,
                   SUM("sampleWeight")::bigint AS requests,
                   MAX("clientIp") AS sample_ip,
                   MAX(service) AS service,
                   MIN("occurredAt") AS first_seen,
                   MAX("occurredAt") AS last_seen
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              AND "actorId" IS NOT NULL
              AND "clientIp" IS NOT NULL
            GROUP BY "actorId"
            HAVING COUNT(DISTINCT "clientIp") >= :min_ips
            """,
            {"since": since, "until": until, "min_ips": min_ips},
        )

        findings = []
        for row in rows:
            ips = int(row["distinct_ips"] or 0)
            findings.append(
                Finding(
                    rule_id="SESS-001",
                    category="SESSION_ANOMALY",
                    severity="MEDIUM",
                    title=f"Authenticated account active from {ips} sources",
                    description=(
                        f"One authenticated account made {row['requests']} requests from "
                        f"{ips} distinct network addresses. Mobile roaming and shared NAT "
                        "produce this pattern legitimately; so does a shared credential."
                    ),
                    source_ip=row["sample_ip"],
                    affected_service=row["service"] or "auth-service",
                    window_start=since,
                    window_end=until,
                    observed={
                        "authenticatedActorId": row["actorId"],
                        "distinctSourceAddresses": ips,
                        "requests": int(row["requests"] or 0),
                        "firstSeen": row["first_seen"].isoformat(),
                        "lastSeen": row["last_seen"].isoformat(),
                    },
                    signals=[
                        Signal(
                            "unusual_token_or_session_behaviour",
                            ips,
                            min_ips,
                            20,
                            f"The same account was used from {ips} addresses in "
                            f"{WINDOW_MINUTES} minutes.",
                        )
                    ],
                    suggested_actions=[
                        "Confirm with the account owner before acting — roaming is common",
                        "Revoke the account's sessions if the activity is unrecognised",
                    ],
                )
            )
        return findings

    # ── DIST-001: distributed authentication abuse across sources ────────────

    async def detect_distributed_auth_abuse(
        self, since: datetime.datetime, until: datetime.datetime
    ) -> List[Finding]:
        min_sources = _threshold("DIST_SOURCES", 10)
        min_failures = _threshold("DIST_FAILURES", 50)
        rows = await self._rows(
            """
            SELECT route,
                   COUNT(DISTINCT "clientIp")::bigint AS sources,
                   SUM("sampleWeight") FILTER (WHERE "statusCode" = 401)::bigint AS failures,
                   MAX(service) AS service
            FROM obs_api_requests
            WHERE "occurredAt" >= :since AND "occurredAt" < :until
              AND "statusCode" = 401
              AND "clientIp" IS NOT NULL
            GROUP BY route
            HAVING COUNT(DISTINCT "clientIp") >= :min_sources
               AND SUM("sampleWeight") FILTER (WHERE "statusCode" = 401) >= :min_failures
            """,
            {"since": since, "until": until, "min_sources": min_sources, "min_failures": min_failures},
        )

        findings = []
        for row in rows:
            sources = int(row["sources"] or 0)
            failures = int(row["failures"] or 0)
            findings.append(
                Finding(
                    rule_id="DIST-001",
                    category="AUTHENTICATION_ABUSE",
                    severity="CRITICAL",
                    title=f"Distributed authentication failures against {row['route']}",
                    description=(
                        f"{failures} failed authentications from {sources} distinct sources "
                        "against one endpoint — a pattern consistent with password spraying, "
                        "which per-source rate limits alone will not stop."
                    ),
                    # Distributed by nature: no single source characterises it.
                    source_ip="(distributed)",
                    affected_service=row["service"] or "auth-service",
                    window_start=since,
                    window_end=until,
                    observed={
                        "route": row["route"],
                        "distinctSources": sources,
                        "failedAuthentications": failures,
                    },
                    signals=[
                        Signal(
                            "password_spraying_pattern",
                            f"{sources} sources / {failures} failures",
                            f"{min_sources} sources / {min_failures} failures",
                            45,
                            "Failures are spread across many addresses, which defeats "
                            "per-source thresholds and points at a coordinated attempt.",
                        )
                    ],
                    suggested_actions=[
                        "Require step-up authentication on this endpoint",
                        "Engage upstream WAF rules rather than per-source limits",
                        "Review whether any account on this endpoint authenticated successfully",
                    ],
                )
            )
        return findings

    # ── Evaluation cycle ─────────────────────────────────────────────────────

    async def evaluate(
        self,
        *,
        until: Optional[datetime.datetime] = None,
        persist: bool = True,
    ) -> List[Finding]:
        """Run every detector over the window and persist what is new."""
        until = until or datetime.datetime.utcnow()
        since = until - datetime.timedelta(minutes=WINDOW_MINUTES)

        detectors = (
            self.detect_auth_brute_force,
            self.detect_distributed_auth_abuse,
            self.detect_endpoint_enumeration,
            self.detect_authorization_probing,
            self.detect_rate_limit_abuse,
            self.detect_traffic_spike,
            self.detect_session_anomaly,
        )

        findings: List[Finding] = []
        for detector in detectors:
            try:
                findings.extend(await detector(since, until))
            except Exception as exc:  # noqa: BLE001
                # One failing detector must not silence the others.
                logger.error("Detector %s failed: %s", detector.__name__, exc)

        findings.sort(key=lambda f: (-SEVERITY_ORDER.get(f.severity, 0), -f.risk_score))

        if persist and findings:
            findings = await self._persist(findings)
        return findings

    async def _persist(self, findings: Sequence[Finding]) -> List[Finding]:
        """Insert findings not already reported for the same rule and source."""
        cooldown_since = datetime.datetime.utcnow() - datetime.timedelta(minutes=COOLDOWN_MINUTES)
        stored: List[Finding] = []

        async with self._engine.begin() as conn:
            existing_rows = await conn.execute(
                text(
                    """
                    SELECT "ruleId", "sourceIp"
                    FROM infra_security_events
                    WHERE "createdAt" >= :cooldown_since
                    """
                ),
                {"cooldown_since": cooldown_since},
            )
            suppressed = {(r[0], r[1]) for r in existing_rows.fetchall()}

            for finding in findings:
                if (finding.rule_id, finding.source_ip) in suppressed:
                    continue
                await conn.execute(
                    text(
                        """
                        INSERT INTO infra_security_events (
                            id, severity, category, "ruleId", title, description,
                            "sourceIp", country, asn, "affectedService", signals,
                            "actionTaken", "createdAt"
                        ) VALUES (
                            :id, :severity, :category, :rule_id, :title, :description,
                            :source_ip, NULL, NULL, :affected_service, CAST(:signals AS json),
                            :action_taken, :created_at
                        )
                        """
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "severity": finding.severity,
                        "category": finding.category,
                        "rule_id": finding.rule_id,
                        "title": finding.title,
                        "description": finding.description,
                        "source_ip": finding.source_ip,
                        "affected_service": finding.affected_service,
                        "signals": __import__("json").dumps(finding.signal_payload(), default=str),
                        # Detection alone takes no action. Blocking and
                        # throttling stay operator-initiated and audited (§21).
                        "action_taken": "DETECTED_ONLY",
                        "created_at": datetime.datetime.utcnow(),
                    },
                )
                stored.append(finding)
                suppressed.add((finding.rule_id, finding.source_ip))

        for finding in stored:
            await event_bus.publish(
                EVENT_SECURITY,
                {
                    "ruleId": finding.rule_id,
                    "category": finding.category,
                    "severity": finding.severity,
                    "title": finding.title,
                    "description": finding.description,
                    "sourceIp": finding.source_ip,
                    "affectedService": finding.affected_service,
                    "riskScore": finding.risk_score,
                    "signals": finding.signal_payload(),
                },
            )

        if stored:
            logger.warning(
                "Detection cycle raised %s security event(s): %s",
                len(stored),
                ", ".join(f"{f.rule_id}/{f.severity}" for f in stored),
            )
        return stored
