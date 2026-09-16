# ==============================================================================
# Security Detection & Real-Time Stream API  (spec §16, §17, §18, §27)
# ==============================================================================
# The operator-facing surface of the detection engine, plus the live SSE feed.
#
# Authorization uses `security.*` permissions, which — like `infra.*` — appear
# in no row of PERMISSIONS_MATRIX and are therefore admin-only by construction
# through the SUPER_ADMIN / ORG_ADMIN wildcard. Security detail must fail closed.
#
# Nothing here performs an offensive action, an external lookup, or any attempt
# to identify a person from a network address. It reports requests this platform
# served and the defensive measures already applied to them.
# ==============================================================================

from __future__ import annotations

import asyncio
import datetime
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from starlette.responses import StreamingResponse

from app.core.database import engine
from app.core.dependencies import RequirePermissions, TenantUser

from .detection import COOLDOWN_MINUTES, WINDOW_MINUTES, DetectionEngine
from .eventbus import envelope, event_bus
from .ingestion import get_ingestor
from .repository import PostgresTelemetryRepository
from .scheduler import get_scheduler

router = APIRouter(tags=["Security Detection & Real-Time"])

SEVERITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
MAX_WINDOW_MINUTES = 60 * 24 * 31


def _window(minutes: int) -> tuple[datetime.datetime, datetime.datetime]:
    end = datetime.datetime.utcnow()
    return end - datetime.timedelta(minutes=minutes), end


async def _fetch(sql: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    async with engine.connect() as conn:
        result = await conn.execute(text(sql), params)
        return [dict(r) for r in result.mappings().all()]


# ── Detections (§16, §17) ────────────────────────────────────────────────────


@router.get("/observability/security/events")
async def security_events(
    minutes: int = Query(60 * 24, ge=1, le=MAX_WINDOW_MINUTES),
    severity: Optional[List[str]] = Query(None),
    rule_id: Optional[str] = Query(None, max_length=32),
    source_ip: Optional[str] = Query(None, max_length=64),
    limit: int = Query(100, ge=1, le=500),
    user: TenantUser = Depends(RequirePermissions(["security.events.read"])),
):
    """Security events raised by the detection engine.

    Each event carries the measured facts behind it, every signal that crossed
    threshold with its own explanation, and a risk score that is a triage aid
    rather than a finding of intent (§17).
    """
    since, until = _window(minutes)
    clauses: List[str] = []
    params: Dict[str, Any] = {"since": since, "until": until, "limit": limit}

    if severity:
        valid = [s.upper() for s in severity if s.upper() in SEVERITIES]
        if valid:
            clauses.append("AND severity = ANY(:severities)")
            params["severities"] = valid
    if rule_id:
        clauses.append('AND "ruleId" = :rule_id')
        params["rule_id"] = rule_id
    if source_ip:
        clauses.append('AND "sourceIp" = :source_ip')
        params["source_ip"] = source_ip

    events = await _fetch(
        f"""
        SELECT id, severity, category, "ruleId", title, description,
               "sourceIp", country, asn, "affectedService", signals,
               "actionTaken", "createdAt"
        FROM infra_security_events
        WHERE "createdAt" >= :since AND "createdAt" < :until
          {" ".join(clauses)}
        ORDER BY "createdAt" DESC
        LIMIT :limit
        """,
        params,
    )

    scheduler = get_scheduler()
    return {
        "windowStart": since,
        "windowEnd": until,
        "count": len(events),
        "events": events,
        # So the console can distinguish "nothing detected" from "detection is
        # not running" — presenting a stale empty list as reassurance would be
        # the worst failure mode this page has (§30).
        "detectionStatus": scheduler.stats() if scheduler else {
            "running": False,
            "healthy": False,
            "note": "Detection scheduler is not running in this process; this list may be stale.",
        },
        "evidenceBasis": (
            "Derived from obs_api_requests — requests the platform actually served. "
            "Signals are threshold crossings, not conclusions."
        ),
    }


@router.get("/observability/security/rules")
async def detection_rules(
    user: TenantUser = Depends(RequirePermissions(["security.events.read"])),
):
    """The detector catalogue, so thresholds are auditable rather than opaque."""
    return {
        "windowMinutes": WINDOW_MINUTES,
        "cooldownMinutes": COOLDOWN_MINUTES,
        "rules": [
            {
                "ruleId": "AUTH-001",
                "category": "AUTHENTICATION_ABUSE",
                "detects": "Repeated failed authentication from a single source",
                "signals": ["repeated_failed_authentication", "no_successful_authentication", "automated_request_rate"],
            },
            {
                "ruleId": "DIST-001",
                "category": "AUTHENTICATION_ABUSE",
                "detects": "Password spraying: failures spread across many sources against one endpoint",
                "signals": ["password_spraying_pattern"],
                "note": "Per-source rate limits do not stop this pattern.",
            },
            {
                "ruleId": "ENUM-001",
                "category": "RECONNAISSANCE",
                "detects": "Probing for undocumented endpoints (many distinct 404s)",
                "signals": ["unusual_endpoint_enumeration", "majority_requests_not_found"],
            },
            {
                "ruleId": "AUTHZ-001",
                "category": "PRIVILEGE_PROBING",
                "detects": "Repeated authorization denials across multiple endpoints",
                "signals": ["repeated_authorization_failure", "breadth_of_denied_endpoints"],
            },
            {
                "ruleId": "RATE-001",
                "category": "TRAFFIC_ABUSE",
                "detects": "Sustained rate-limit violations",
                "signals": ["repeated_429_responses"],
            },
            {
                "ruleId": "SPIKE-001",
                "category": "TRAFFIC_ANOMALY",
                "detects": "Request volume far above the source's own recent baseline",
                "signals": ["abnormal_request_rate"],
                "note": "Application-level limits do not replace upstream CDN/WAF DDoS protection.",
            },
            {
                "ruleId": "SESS-001",
                "category": "SESSION_ANOMALY",
                "detects": "One authenticated account active from many network addresses",
                "signals": ["unusual_token_or_session_behaviour"],
                "note": "Mobile roaming and shared NAT produce this legitimately; confirm before acting.",
            },
        ],
        "policy": {
            "automatedAction": (
                "Detection records and alerts only. Blocking, throttling and account "
                "actions remain operator-initiated, confirmed and audited (§21)."
            ),
            "riskScore": "Sum of triggered signal weights, capped at 100. A ranking aid, not proof of intent.",
        },
    }


@router.post("/observability/security/evaluate")
async def run_detection_now(
    user: TenantUser = Depends(RequirePermissions(["security.events.read"])),
):
    """Run every detector immediately rather than waiting for the next cycle.

    Read-only over telemetry; records new events and takes no defensive action.
    """
    findings = await DetectionEngine(engine).evaluate()
    return {
        "evaluatedAt": datetime.datetime.utcnow(),
        "newEvents": len(findings),
        "findings": [
            {
                "ruleId": f.rule_id,
                "severity": f.severity,
                "category": f.category,
                "title": f.title,
                "description": f.description,
                "sourceIp": f.source_ip,
                "affectedService": f.affected_service,
                "riskScore": f.risk_score,
                "signals": f.signal_payload(),
            }
            for f in findings
        ],
    }


# ── Source dossier (§18) ─────────────────────────────────────────────────────


@router.get("/observability/sources/{client_ip}/dossier")
async def source_dossier(
    client_ip: str,
    minutes: int = Query(60 * 24, ge=1, le=MAX_WINDOW_MINUTES),
    user: TenantUser = Depends(RequirePermissions(["security.events.read"])),
):
    """Everything this platform observed about one source address, in one place.

    The scope is deliberate and bounded: request telemetry we recorded, the
    detections it triggered, and the defensive measures already applied. No
    external lookup is performed, and no attempt is made to determine a person,
    an organisation, a location, or any contact detail from an address. Only
    accounts CamTech's own systems already authenticated are shown.
    """
    if not client_ip or len(client_ip) > 64:
        raise HTTPException(status_code=400, detail="Invalid source address")

    since, until = _window(minutes)
    repo = PostgresTelemetryRepository(engine)
    activity = await repo.source_activity(client_ip=client_ip, since=since, until=until)
    params = {"ip": client_ip, "since": since, "until": until}

    detections = await _fetch(
        """
        SELECT id, severity, category, "ruleId", title, description,
               signals, "actionTaken", "createdAt"
        FROM infra_security_events
        WHERE "sourceIp" = :ip AND "createdAt" >= :since
        ORDER BY "createdAt" DESC LIMIT 50
        """,
        {"ip": client_ip, "since": since},
    )
    user_agents = await _fetch(
        """
        SELECT "userAgent", SUM("sampleWeight")::bigint AS requests,
               MIN("occurredAt") AS first_seen, MAX("occurredAt") AS last_seen
        FROM obs_api_requests
        WHERE "clientIp" = :ip AND "occurredAt" >= :since AND "occurredAt" < :until
          AND "userAgent" IS NOT NULL
        GROUP BY "userAgent" ORDER BY requests DESC LIMIT 10
        """,
        params,
    )
    authenticated_actors = await _fetch(
        """
        SELECT "actorId", "actorType", "organizationId",
               SUM("sampleWeight")::bigint AS requests,
               MAX("occurredAt") AS last_seen
        FROM obs_api_requests
        WHERE "clientIp" = :ip AND "occurredAt" >= :since AND "occurredAt" < :until
          AND "actorId" IS NOT NULL
        GROUP BY "actorId", "actorType", "organizationId"
        ORDER BY requests DESC LIMIT 20
        """,
        params,
    )
    per_minute = await _fetch(
        """
        SELECT date_bin(INTERVAL '1 minute', "occurredAt", :since) AS bucket,
               SUM("sampleWeight")::bigint AS requests,
               SUM("sampleWeight") FILTER (WHERE "statusCode" >= 400)::bigint AS errors
        FROM obs_api_requests
        WHERE "clientIp" = :ip AND "occurredAt" >= :since AND "occurredAt" < :until
        GROUP BY bucket ORDER BY bucket DESC LIMIT 240
        """,
        params,
    )
    timeline = await _fetch(
        """
        SELECT "occurredAt", method, route, "statusCode", "durationMs",
               "traceId", "requestId", "rateLimited", blocked
        FROM obs_api_requests
        WHERE "clientIp" = :ip AND "occurredAt" >= :since AND "occurredAt" < :until
        ORDER BY "occurredAt" DESC LIMIT 100
        """,
        params,
    )

    # Defensive measures already in force for this source.
    defensive_state: Dict[str, Any]
    try:
        from app.core.rate_limiter import ip_ban_list

        banned = await ip_ban_list.is_banned(client_ip)
        defensive_state = {"blocked": bool(banned)}
        if hasattr(ip_ban_list, "get_ban_details"):
            defensive_state["details"] = await ip_ban_list.get_ban_details(client_ip)
    except Exception:  # noqa: BLE001 - dossier must render even if Redis is down
        defensive_state = {"blocked": None, "note": "Ban state unavailable (Redis unreachable)."}

    return {
        "clientIp": client_ip,
        "windowStart": since,
        "windowEnd": until,
        "observed": activity.get("totals", {}),
        "routesTouched": activity.get("routes", []),
        "userAgents": user_agents,
        "authenticatedActors": authenticated_actors,
        "requestsPerMinute": per_minute,
        "requestTimeline": timeline,
        "detections": detections,
        "defensiveState": defensive_state,
        "limits": {
            "identity": (
                "A network address is not an identity. No attempt is made to determine a "
                "person, organisation, location or contact detail from it."
            ),
            "geolocation": (
                "No geolocation is asserted. Network or ASN data added later must be "
                "labelled approximate network intelligence."
            ),
            "evidence": "Every figure is a count of requests this platform served.",
            "redaction": "Credentials are removed before storage, so none can appear here.",
        },
    }


# ── Live stream (§27) ────────────────────────────────────────────────────────


@router.get("/observability/stream")
async def observability_stream(
    request: Request,
    user: TenantUser = Depends(RequirePermissions(["infra.services.read"])),
):
    """Live Server-Sent Events feed of detections and pipeline state.

    Pushes as things happen rather than on a poll. Events carry a versioned
    envelope so the console can evolve without a flag day. A slow client has
    events dropped rather than applying back-pressure to the detectors.
    """

    async def generator():
        async with event_bus.subscribe() as queue:
            ingestor = get_ingestor()
            scheduler = get_scheduler()
            hello = envelope(
                "CONNECTED",
                {
                    "message": "CamTech Control Center live stream",
                    "pipeline": ingestor.stats().as_dict() if ingestor else None,
                    "detection": scheduler.stats() if scheduler else None,
                    "bus": event_bus.stats(),
                },
            )
            yield f"data: {json.dumps(hello, default=str)}\n\n"

            while True:
                if await request.is_disconnected():
                    return
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # Comment frame keeps the Cloudflare tunnel and nginx from
                    # dropping an idle connection; EventSource ignores it.
                    yield ": keep-alive\n\n"
                    continue
                yield f"data: {json.dumps(message, default=str)}\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # nginx buffers proxied responses by default, which would hold
            # events back until a buffer filled and defeat the whole point.
            "X-Accel-Buffering": "no",
        },
    )
