"""
Docker container management executor.
"""
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("icp.agent.executor.docker")


def _get_client():
    try:
        import docker
        return docker.from_env()
    except Exception as e:
        logger.debug("Docker SDK not available: %s", e)
        return None


def container_action(container_id: str, action: str) -> Dict[str, Any]:
    """Execute an action on a Docker container (start, stop, restart)."""
    client = _get_client()
    if not client:
        return {"success": False, "error": "Docker not available"}

    allowed = {"start", "stop", "restart", "pause", "unpause"}
    if action not in allowed:
        return {"success": False, "error": f"Action '{action}' not allowed. Use: {allowed}"}

    try:
        container = client.containers.get(container_id)
        getattr(container, action)()
        container.reload()
        logger.info("Docker %s on %s (%s) succeeded", action, container.name, container_id)
        return {
            "success": True,
            "containerId": container.short_id,
            "containerName": container.name,
            "action": action,
            "newStatus": container.status,
        }
    except Exception as e:
        logger.error("Docker %s on %s failed: %s", action, container_id, e)
        return {"success": False, "error": str(e)}


def container_logs(container_id: str, tail: int = 100) -> Dict[str, Any]:
    """Get recent logs from a Docker container."""
    client = _get_client()
    if not client:
        return {"success": False, "error": "Docker not available"}

    tail = min(tail, 1000)
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
        return {
            "success": True,
            "containerId": container.short_id,
            "containerName": container.name,
            "logs": logs[-20000:],  # Cap at 20KB
            "lineCount": len(logs.splitlines()),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def docker_compose_action(
    action: str,
    project_dir: str = "/home/ubuntu-server/CamTech_Store",
    compose_file: str = "docker-compose.prod.yml",
    services: Optional[list] = None,
) -> Dict[str, Any]:
    """Execute a docker compose action."""
    import subprocess

    allowed = {"up", "down", "restart", "stop", "start", "pull"}
    if action not in allowed:
        return {"success": False, "error": f"Action '{action}' not allowed"}

    cmd = ["docker", "compose", "-f", compose_file]
    if action == "up":
        cmd += ["up", "-d"]
    else:
        cmd.append(action)

    if services:
        # Sanitize service names
        safe_services = [s.replace(";", "").replace("&", "").strip() for s in services]
        cmd.extend(safe_services)

    try:
        result = subprocess.run(
            cmd, cwd=project_dir,
            capture_output=True, text=True, timeout=120,
        )
        return {
            "success": result.returncode == 0,
            "command": " ".join(cmd),
            "exitCode": result.returncode,
            "stdout": result.stdout.strip()[-3000:],
            "stderr": result.stderr.strip()[-3000:],
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Docker compose command timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}
