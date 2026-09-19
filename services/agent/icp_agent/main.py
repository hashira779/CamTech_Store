"""
ICP Agent — Lightweight Infrastructure Control Platform Agent

A FastAPI application that runs on every managed server.
It collects system metrics, manages services/containers,
and executes approved commands from the central Control Center.

Security:
- Every request requires X-ICP-Agent-Key header
- Commands are validated against an allowlist
- Dangerous commands require break-glass tokens
- Full audit logging of all executed actions
"""
import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from icp_agent.auth import APIKeyAuthMiddleware
from icp_agent.config import AgentConfig
from icp_agent.heartbeat import heartbeat_loop

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
logger = logging.getLogger("icp.agent")


# ── Lifespan (start heartbeat) ────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start heartbeat background task
    task = asyncio.create_task(heartbeat_loop())
    logger.info(
        "ICP Agent started on %s:%d (hostname=%s)",
        AgentConfig.BIND_HOST,
        AgentConfig.BIND_PORT,
        AgentConfig.get_hostname(),
    )
    yield
    task.cancel()


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="ICP Agent",
    description="Infrastructure Control Platform Agent — manages this server",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(APIKeyAuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory command audit log (recent 200 entries) ──────────────────────────
_audit_log = []
MAX_AUDIT = 200


def _audit(action: str, details: dict, actor: str = "control-center"):
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "actor": actor,
        "action": action,
        "details": details,
    }
    _audit_log.insert(0, entry)
    if len(_audit_log) > MAX_AUDIT:
        _audit_log.pop()
    logger.info("[AUDIT] %s: %s", action, details)


# ── Request / Response Models ─────────────────────────────────────────────────
class CommandRequest(BaseModel):
    command: str = Field(..., min_length=1, max_length=500)
    breakGlassToken: Optional[str] = None


class ServiceActionRequest(BaseModel):
    action: str = Field(..., description="start, stop, restart")


class DockerActionRequest(BaseModel):
    action: str = Field(..., description="start, stop, restart, pause, unpause")


class RebootRequest(BaseModel):
    delaySeconds: int = Field(60, ge=5, le=600)
    breakGlassToken: str = Field(..., min_length=10)


# ═════════════════════════════════════════════════════════════════════════════
# HEALTH & SYSTEM INFO
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": "ICP Agent",
        "version": "1.0.0",
        "hostname": AgentConfig.get_hostname(),
    }


@app.get("/ready")
async def ready():
    return {"ready": True}


@app.get("/system/info")
async def system_info():
    from icp_agent.executors.system import get_system_info
    _audit("system.info", {"action": "read"})
    return get_system_info()


# ═════════════════════════════════════════════════════════════════════════════
# METRICS COLLECTION
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/metrics")
async def full_metrics():
    """Full system metrics snapshot — CPU, Memory, Disk, Network, Docker."""
    from icp_agent.collectors.cpu import collect_cpu_metrics
    from icp_agent.collectors.memory import collect_memory_metrics
    from icp_agent.collectors.disk import collect_disk_metrics
    from icp_agent.collectors.network import collect_network_metrics
    from icp_agent.collectors.docker_collector import collect_docker_metrics

    return {
        "hostname": AgentConfig.get_hostname(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cpu": collect_cpu_metrics(),
        "memory": collect_memory_metrics(),
        "disk": collect_disk_metrics(),
        "network": collect_network_metrics(),
        "docker": collect_docker_metrics(),
    }


@app.get("/metrics/cpu")
async def cpu_metrics():
    from icp_agent.collectors.cpu import collect_cpu_metrics
    return collect_cpu_metrics()


@app.get("/metrics/memory")
async def memory_metrics():
    from icp_agent.collectors.memory import collect_memory_metrics
    return collect_memory_metrics()


@app.get("/metrics/disk")
async def disk_metrics():
    from icp_agent.collectors.disk import collect_disk_metrics
    return collect_disk_metrics()


@app.get("/metrics/network")
async def network_metrics():
    from icp_agent.collectors.network import collect_network_metrics
    return collect_network_metrics()


@app.get("/metrics/docker")
async def docker_metrics():
    from icp_agent.collectors.docker_collector import collect_docker_metrics
    return collect_docker_metrics()


# ═════════════════════════════════════════════════════════════════════════════
# SYSTEMD SERVICE MANAGEMENT
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/services")
async def list_services():
    from icp_agent.executors.service import list_services as _list
    return _list()


@app.get("/services/{name}/status")
async def get_service_status(name: str):
    from icp_agent.executors.service import service_status
    return service_status(name)


@app.post("/services/{name}/{action}")
async def manage_service(name: str, action: str):
    from icp_agent.executors.service import service_action
    _audit(f"service.{action}", {"service": name})
    return service_action(name, action)


@app.get("/services/{name}/logs")
async def get_service_logs(name: str, lines: int = Query(100, ge=1, le=500)):
    from icp_agent.executors.service import service_logs
    return service_logs(name, lines)


# ═════════════════════════════════════════════════════════════════════════════
# DOCKER CONTAINER MANAGEMENT
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/docker/containers")
async def list_docker_containers():
    from icp_agent.collectors.docker_collector import collect_docker_metrics
    return collect_docker_metrics()


@app.post("/docker/{container_id}/{action}")
async def manage_docker_container(container_id: str, action: str):
    from icp_agent.executors.docker_exec import container_action
    _audit(f"docker.{action}", {"container": container_id})
    return container_action(container_id, action)


@app.get("/docker/{container_id}/logs")
async def get_docker_logs(container_id: str, tail: int = Query(100, ge=1, le=1000)):
    from icp_agent.executors.docker_exec import container_logs
    return container_logs(container_id, tail)


class DockerComposeRequest(BaseModel):
    services: Optional[list] = None


@app.post("/docker/compose/{action}")
async def docker_compose_command(action: str, body: Optional[DockerComposeRequest] = None):
    services = body.services if body else None
    from icp_agent.executors.docker_exec import docker_compose_action
    _audit(f"docker-compose.{action}", {"services": services})
    return docker_compose_action(action, services=services)


# ═════════════════════════════════════════════════════════════════════════════
# SYSTEM COMMANDS
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/system/reboot")
async def reboot(body: RebootRequest):
    """Reboot this server. Requires a break-glass token."""
    from icp_agent.executors.system import reboot_server
    _audit("system.reboot", {"delaySeconds": body.delaySeconds}, actor="break-glass")
    return reboot_server(delay_seconds=body.delaySeconds)


@app.post("/system/cancel-reboot")
async def cancel_pending_reboot():
    from icp_agent.executors.system import cancel_reboot
    _audit("system.cancel-reboot", {})
    return cancel_reboot()


@app.post("/exec")
async def execute_command(body: CommandRequest):
    """Execute an allowlisted command."""
    from icp_agent.executors.system import execute_allowed_command

    if AgentConfig.requires_break_glass(body.command):
        if not body.breakGlassToken:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This command requires a break-glass token. Activate break-glass from the Control Center first.",
            )

    _audit("exec", {"command": body.command})
    return execute_allowed_command(body.command)


# ═════════════════════════════════════════════════════════════════════════════
# AUDIT LOG
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/audit")
async def get_audit_log():
    return {"entries": _audit_log, "total": len(_audit_log)}


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "icp_agent.main:app",
        host=AgentConfig.BIND_HOST,
        port=AgentConfig.BIND_PORT,
        log_level="info",
    )
