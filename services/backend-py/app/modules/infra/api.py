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
    # ICP Schemas
    RegisterAgentRequest,
    AgentHeartbeatRequest,
    AgentSummarySchema,
    SendCommandRequest,
    AgentCommandSchema,
    ServiceActionRequest,
    DockerActionRequest,
    DockerComposeActionRequest,
    RebootServerRequest,
    CreateScheduledTaskRequest,
    UpdateScheduledTaskRequest,
    ScheduledTaskSchema,
    SaveCloudflareConfigRequest,
    CloudflareConfigSchema,
    CreateDnsRecordRequest,
    PurgeCacheRequest,
    CreateAlertRuleRequest,
    AlertRuleSchema,
    AlertSchema,
    CreateNotificationChannelRequest,
    NotificationChannelSchema,
)
from app.modules.infra.agent_manager import agent_manager
from app.modules.infra.scheduler_service import scheduler_service
from app.modules.infra.cloudflare_service import cloudflare_service
from app.modules.infra.alert_service import alert_service


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


# ═════════════════════════════════════════════════════════════════════════════
# ICP — Server Agent Fleet Management
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/agents", response_model=List[AgentSummarySchema], summary="List all managed server agents")
async def list_agents(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.list_agents(db)


@router.post("/agents/register", summary="Register a new server agent")
async def register_agent(
    payload: RegisterAgentRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.register_agent(
        db=db,
        hostname=payload.hostname,
        ip_address=payload.ipAddress,
        agent_port=payload.port,
        api_key=payload.apiKey,
        os_type=payload.osType,
        tags=payload.tags,
    )


@router.post("/agents/heartbeat", summary="Receive heartbeat and metrics from an agent")
async def agent_heartbeat(
    payload: AgentHeartbeatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    return await agent_manager.process_heartbeat(
        db=db,
        agent_id=payload.agentId or payload.hostname,
        hostname=payload.hostname,
        metrics=payload.metrics,
        client_ip=client_ip,
    )


@router.delete("/agents/{agent_id}", summary="Deregister an agent")
async def deregister_agent(
    agent_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    success = await agent_manager.deregister_agent(db, agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"status": "ok", "message": f"Agent {agent_id} deregistered"}


@router.get("/agents/{agent_id}/metrics", summary="Get real-time metrics directly from agent")
async def get_agent_metrics(
    agent_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.get_agent_metrics(db, agent_id)


@router.post("/agents/{agent_id}/command", summary="Execute approved command on agent")
async def send_agent_command(
    agent_id: str,
    payload: SendCommandRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.send_command(
        db=db,
        agent_id=agent_id,
        command=payload.command,
        actor_id=user.id,
        break_glass_token=payload.breakGlassToken,
    )


@router.get("/agents/{agent_id}/commands", summary="Get command execution history for agent")
async def get_command_history(
    agent_id: str,
    limit: int = 50,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.get_command_history(db, agent_id=agent_id, limit=limit)


# ── Server & Container Control ───────────────────────────────────────────────

@router.get("/docker/containers", summary="List all Docker containers across all agents")
async def get_all_docker_containers(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.get_all_docker_containers(db)


@router.get("/agents/{agent_id}/docker", summary="List Docker containers on managed server")
async def get_agent_docker(
    agent_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.get_agent_docker(db, agent_id)


@router.post("/agents/{agent_id}/docker/{container_id}/action", summary="Control Docker container (start/stop/restart)")
async def docker_container_action(
    agent_id: str,
    container_id: str,
    payload: DockerActionRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.docker_action(
        db=db,
        agent_id=agent_id,
        container_id=container_id,
        action=payload.action,
        actor_id=user.id,
    )


@router.get("/agents/{agent_id}/services", summary="List systemd services on managed server")
async def get_agent_services(
    agent_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.get_agent_services(db, agent_id)


@router.post("/agents/{agent_id}/service/{service_name}/action", summary="Control systemd service")
async def service_action(
    agent_id: str,
    service_name: str,
    payload: ServiceActionRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    if payload.action == "restart":
        return await agent_manager.restart_service(db, agent_id, service_name, user.id)
    return await agent_manager.send_command(
        db=db,
        agent_id=agent_id,
        command=f"service.{payload.action}:{service_name}",
        actor_id=user.id,
    )


@router.post("/agents/{agent_id}/system/reboot", summary="Reboot managed server (requires break-glass)")
async def reboot_server(
    agent_id: str,
    payload: RebootServerRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await agent_manager.reboot_server(
        db=db,
        agent_id=agent_id,
        actor_id=user.id,
        delay_seconds=payload.delaySeconds,
        break_glass_token=payload.breakGlassToken,
    )


# ═════════════════════════════════════════════════════════════════════════════
# ICP — Scheduler Module
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/tasks", response_model=List[ScheduledTaskSchema], summary="List all scheduled infrastructure tasks")
async def list_tasks(
    agent_id: Optional[str] = None,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await scheduler_service.list_tasks(db, agent_id=agent_id)


@router.post("/tasks", summary="Create a new scheduled task")
async def create_task(
    payload: CreateScheduledTaskRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await scheduler_service.create_task(
        db=db,
        name=payload.name,
        cron_expr=payload.cronExpr,
        command=payload.command,
        description=payload.description,
        agent_id=payload.agentId,
        parameters=payload.parameters,
        enabled=payload.enabled,
    )


@router.put("/tasks/{task_id}", summary="Update a scheduled task")
async def update_task(
    task_id: str,
    payload: UpdateScheduledTaskRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    res = await scheduler_service.update_task(db, task_id, payload.model_dump(exclude_unset=True))
    if not res:
        raise HTTPException(status_code=404, detail="Task not found")
    return res


@router.delete("/tasks/{task_id}", summary="Delete a scheduled task")
async def delete_task(
    task_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    success = await scheduler_service.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "ok"}


@router.post("/tasks/{task_id}/run", summary="Trigger immediate run of scheduled task")
async def run_task_now(
    task_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await scheduler_service.run_task_now(db, task_id, actor_id=user.id)


# ═════════════════════════════════════════════════════════════════════════════
# ICP — Cloudflare Integration
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/cloudflare/config", summary="Get Cloudflare zone config status")
async def get_cloudflare_config(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    cfg = await cloudflare_service.get_config(db)
    if not cfg:
        return {"configured": False}
    return {
        "configured": True,
        "zoneName": cfg.get("zoneName"),
        "zoneId": cfg.get("zoneId"),
        "accountId": cfg.get("accountId"),
        "enabled": cfg.get("enabled", True),
    }


@router.post("/cloudflare/config", summary="Save Cloudflare API credentials and zone ID")
async def save_cloudflare_config(
    payload: SaveCloudflareConfigRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await cloudflare_service.save_config(
        db=db,
        zone_name=payload.zoneName,
        zone_id=payload.zoneId,
        api_token=payload.apiToken,
        account_id=payload.accountId,
    )


@router.get("/cloudflare/dns", summary="List DNS records for active zone")
async def list_dns_records(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await cloudflare_service.list_dns_records(db)


@router.post("/cloudflare/dns", summary="Create a new DNS record")
async def create_dns_record(
    payload: CreateDnsRecordRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await cloudflare_service.create_dns_record(
        db=db,
        record_type=payload.type,
        name=payload.name,
        content=payload.content,
        ttl=payload.ttl,
        proxied=payload.proxied,
    )


@router.delete("/cloudflare/dns/{record_id}", summary="Delete a DNS record")
async def delete_dns_record(
    record_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await cloudflare_service.delete_dns_record(db, record_id)


@router.post("/cloudflare/purge-cache", summary="Purge Cloudflare edge cache")
async def purge_cloudflare_cache(
    payload: PurgeCacheRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await cloudflare_service.purge_cache(
        db=db,
        purge_everything=payload.purgeEverything,
        files=payload.files,
    )


@router.get("/cloudflare/analytics", summary="Get Cloudflare traffic and threat analytics")
async def get_cloudflare_analytics(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await cloudflare_service.get_analytics(db)


# ═════════════════════════════════════════════════════════════════════════════
# ICP — Alert Center & Notification Channels
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/alerts", response_model=List[AlertSchema], summary="List active and historical alerts")
async def list_alerts(
    status: Optional[str] = None,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await alert_service.list_alerts(db, status=status)


@router.post("/alerts/{alert_id}/acknowledge", summary="Acknowledge an alert")
async def acknowledge_alert(
    alert_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    res = await alert_service.acknowledge_alert(db, alert_id, actor_id=user.id)
    if not res:
        raise HTTPException(status_code=404, detail="Alert not found")
    return res


@router.post("/alerts/{alert_id}/resolve", summary="Resolve an alert")
async def resolve_alert(
    alert_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    res = await alert_service.resolve_alert(db, alert_id, actor_id=user.id)
    if not res:
        raise HTTPException(status_code=404, detail="Alert not found")
    return res


@router.get("/alert-rules", response_model=List[AlertRuleSchema], summary="List threshold alert rules")
async def list_alert_rules(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await alert_service.list_rules(db)


@router.post("/alert-rules", summary="Create a new threshold alert rule")
async def create_alert_rule(
    payload: CreateAlertRuleRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await alert_service.create_rule(
        db=db,
        name=payload.name,
        condition=payload.condition,
        description=payload.description,
        category=payload.category,
        severity=payload.severity,
        channels=payload.channels,
        cooldown_sec=payload.cooldownSec,
        enabled=payload.enabled,
    )


@router.delete("/alert-rules/{rule_id}", summary="Delete an alert rule")
async def delete_alert_rule(
    rule_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    success = await alert_service.delete_rule(db, rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "ok"}


@router.get("/notification-channels", response_model=List[NotificationChannelSchema], summary="List notification channels")
async def list_notification_channels(
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await alert_service.list_channels(db)


@router.post("/notification-channels", summary="Create a notification channel")
async def create_notification_channel(
    payload: CreateNotificationChannelRequest,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    return await alert_service.create_channel(
        db=db,
        name=payload.name,
        channel_type=payload.type,
        config=payload.config,
        enabled=payload.enabled,
    )


@router.delete("/notification-channels/{channel_id}", summary="Delete a notification channel")
async def delete_notification_channel(
    channel_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    success = await alert_service.delete_channel(db, channel_id)
    if not success:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"status": "ok"}


@router.post("/notification-channels/{channel_id}/test", summary="Send a test notification")
async def test_notification_channel(
    channel_id: str,
    user: TenantUser = Depends(require_infra_operator),
    db: AsyncSession = Depends(get_db),
):
    sent = await alert_service.send_notification(
        db=db,
        channel_id=channel_id,
        title="Test Notification from ICP",
        message="This is a test alert from the Infrastructure Control Platform. Your channel is working properly.",
        severity="LOW",
    )
    return {"sent": sent}

