import asyncio
import json
import logging
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.core.rate_limiter import ip_ban_list, AUTO_BAN_DURATION_SECONDS, PERM_BAN_DURATION_SECONDS
from app.modules.infra.service import infra_service_instance
from app.modules.infra.schemas import (
    InfraOverviewResponse,
    InfraServiceNodeSchema,
    InfraTopologyGraphResponse,
    ApiTrafficRequestSchema,
    SecurityEventSchema,
    IncidentSchema,
    CreateIncidentRequest,
    DeploymentCorrelationSchema,
    InfraAuditEntrySchema,
    BreakGlassActivationRequest,
)

logger = logging.getLogger("mystore.infra.api")

router = APIRouter(prefix="/infra", tags=["Infra & Security Control Center"])

AUTHORIZED_ROLES = {"SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN", "DEVOPS", "STAFF"}


def require_infra_operator(user: TenantUser = Depends(get_current_user)) -> TenantUser:
    """Restricts Control Center operations to authorized operations & security staff.

    The denial is self-diagnosing on purpose. A bare "access restricted" gave an
    operator no way to tell an intended restriction apart from a role that
    failed to resolve, which turned a role-mapping problem into an unexplainable
    403 on every panel at once. The caller is already authenticated and is
    being told only about their own roles, so this reveals nothing they could
    not read from their own token.
    """
    resolved = list(user.roles or [])
    if not any(r in AUTHORIZED_ROLES for r in resolved):
        logger.warning(
            "Infra Control Center access denied for user %s (roles=%s, required one of=%s)",
            getattr(user, "id", "unknown"),
            resolved,
            sorted(AUTHORIZED_ROLES),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Access restricted to authorized CamTech infrastructure & security personnel.",
                "yourRoles": resolved,
                "requiredAnyOf": sorted(AUTHORIZED_ROLES),
                # Distinguishes "you are not authorized" from "your roles did
                # not load", which are very different problems to chase.
                "hint": (
                    "No roles resolved for this account — check its user_roles rows "
                    "and the roles table."
                    if not resolved or resolved == ["CASHIER"]
                    else "This account's roles are not permitted on the Control Center."
                ),
            },
        )
    return user


# ── Operational Overview & Services ──────────────────────────────────────────

@router.get("/overview", response_model=InfraOverviewResponse, summary="Get global infrastructure & security status")
async def get_overview(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await infra_service_instance.get_overview(db)


@router.get("/services", response_model=List[InfraServiceNodeSchema], summary="List all registered platform microservices")
async def list_services(
    user: TenantUser = Depends(require_infra_operator),
):
    return await infra_service_instance.get_services()


@router.get("/topology", response_model=InfraTopologyGraphResponse, summary="Get live service topology graph for XYFlow")
async def get_topology(
    user: TenantUser = Depends(require_infra_operator),
):
    return infra_service_instance.get_topology_graph()


# ── Observability & Live API Traffic ─────────────────────────────────────────

@router.get("/traffic", response_model=List[ApiTrafficRequestSchema], summary="Get recent API edge requests and latency")
async def get_traffic(
    user: TenantUser = Depends(require_infra_operator),
):
    return await infra_service_instance.get_recent_traffic()


# ── Threat Center & IP Bans ──────────────────────────────────────────────────

@router.get("/security/events", response_model=List[SecurityEventSchema], summary="Get security threat signals & detections")
async def list_security_events(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await infra_service_instance.get_security_events(db)


@router.get("/security/bans", summary="List all currently active IP bans")
async def list_active_bans(
    user: TenantUser = Depends(require_infra_operator),
):
    bans = await ip_ban_list.list_bans()
    return {"total": len(bans), "bans": sorted(bans, key=lambda b: b.get("banned_at", 0), reverse=True)}


@router.post("/security/bans", status_code=status.HTTP_201_CREATED, summary="Enact a defensive IP block")
async def ban_ip_address(
    body: Dict[str, Any],
    user: TenantUser = Depends(require_infra_operator),
):
    ip = str(body.get("ip", "")).strip()
    reason = str(body.get("reason", "Manual defensive block from Control Center")).strip()
    duration_hours = body.get("durationHours")
    duration_seconds = int(float(duration_hours) * 3600) if duration_hours else PERM_BAN_DURATION_SECONDS

    if not ip:
        raise HTTPException(status_code=400, detail="Valid IP address is required.")

    metadata = await ip_ban_list.ban(ip, duration_seconds=duration_seconds, reason=reason, admin_id=user.id)
    return {"message": f"IP {ip} successfully blocked across edge reverse proxy and microservices.", "ban": metadata}


@router.delete("/security/bans/{ip}", summary="Remove an IP block")
async def unban_ip_address(
    ip: str,
    user: TenantUser = Depends(require_infra_operator),
):
    existed = await ip_ban_list.unban(ip.strip(), admin_id=user.id)
    if not existed:
        raise HTTPException(status_code=404, detail=f"IP {ip} was not found in active ban registry.")
    return {"message": f"IP {ip} successfully unbanned."}


# ── Incidents & Deployments ──────────────────────────────────────────────────

@router.get("/incidents", response_model=List[IncidentSchema], summary="List all operational incidents")
async def list_incidents(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await infra_service_instance.get_incidents(db)


@router.post("/incidents", response_model=IncidentSchema, status_code=status.HTTP_201_CREATED, summary="Declare a new incident")
async def declare_incident(
    body: CreateIncidentRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await infra_service_instance.create_incident(
        db=db,
        title=body.title,
        severity=body.severity,
        description=body.description,
        affected_services=body.affectedServices,
        actor_id=user.name or user.email or user.id,
    )


@router.delete("/incidents/{incident_id}", summary="Delete an incident (Admin Only)")
async def delete_incident(
    incident_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    success = await infra_service_instance.delete_incident(db, incident_id)
    if not success:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"message": "Incident deleted successfully"}


@router.get("/deployments", response_model=List[DeploymentCorrelationSchema], summary="List recent service deployments")
async def list_deployments(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await infra_service_instance.get_deployments(db)


# ── Audit & Emergency Break-Glass ────────────────────────────────────────────

@router.get("/audit", response_model=List[InfraAuditEntrySchema], summary="Query administrative audit logs")
async def get_audit_trail(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await infra_service_instance.get_audit_logs(db)


@router.post("/break-glass", status_code=status.HTTP_201_CREATED, summary="Activate 20-minute emergency break-glass protocol")
async def activate_emergency_break_glass(
    body: BreakGlassActivationRequest,
    request: Request,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    if body.confirmation != "I CONFIRM BREAK GLASS":
        raise HTTPException(
            status_code=400,
            detail="Must enter exact confirmation phrase: 'I CONFIRM BREAK GLASS'",
        )
    client_ip = (
        request.headers.get("X-Real-IP")
        or (request.headers.get("X-Forwarded-For") or "").split(",")[0]
        or (request.client.host if request.client else "unknown")
    )
    return await infra_service_instance.activate_break_glass(
        db=db,
        actor_id=user.id,
        actor_email=user.email or user.name,
        reason=body.reason,
        ip=client_ip,
    )


# ── Real-Time Streaming (SSE) ────────────────────────────────────────────────

@router.get("/events/stream", summary="Real-time Server-Sent Events stream for NOC/SOC")
async def stream_infra_events(
    request: Request,
    token: Optional[str] = None,
):
    """
    Continuous Server-Sent Events (SSE) telemetry connection.

    Subscribes to the observability event bus, so detections reach the console
    the moment they are raised rather than on the next poll. Previously this
    generator only emitted heartbeats, which meant the stream was a live
    connection carrying no live data.

    Heartbeats are kept between events to hold the Cloudflare tunnel open.
    """
    from app.modules.observability.eventbus import envelope, event_bus
    from app.modules.observability.ingestion import get_ingestor
    from app.modules.observability.scheduler import get_scheduler

    async def event_generator():
        async with event_bus.subscribe() as queue:
            ingestor = get_ingestor()
            scheduler = get_scheduler()
            hello = envelope(
                "CONNECTED",
                {
                    "message": "CamTech NOC/SOC Telemetry Stream Active",
                    # Surfaced on connect so the console can immediately warn
                    # that the feed is degraded instead of showing an empty
                    # Threat Center as though it were an all-clear.
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
                    # Comment frame: EventSource ignores it, proxies do not.
                    yield ": ping\n\n"
                    continue
                yield f"data: {json.dumps(message, default=str)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
