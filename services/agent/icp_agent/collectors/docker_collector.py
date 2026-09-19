"""
Docker container metrics collector using the Docker SDK.
"""
import logging
from typing import Dict, Any, List

logger = logging.getLogger("icp.agent.docker")


def _get_docker_client():
    """Lazy import and create Docker client."""
    try:
        import docker
        return docker.from_env()
    except Exception as e:
        logger.debug("Docker SDK not available: %s", e)
        return None


def collect_docker_metrics() -> Dict[str, Any]:
    """Collect Docker container list with resource usage."""
    client = _get_docker_client()
    if not client:
        return {"available": False, "containers": [], "error": "Docker not available"}

    try:
        containers: List[Dict[str, Any]] = []
        for c in client.containers.list(all=True):
            info = {
                "id": c.short_id,
                "name": c.name,
                "image": str(c.image.tags[0]) if c.image.tags else str(c.image.short_id),
                "status": c.status,
                "state": c.attrs.get("State", {}).get("Status", "unknown"),
                "created": c.attrs.get("Created", ""),
                "ports": _format_ports(c.ports),
                "restartCount": c.attrs.get("RestartCount", 0),
            }

            # Get live resource stats (non-streaming) for running containers
            if c.status == "running":
                try:
                    stats = c.stats(stream=False)
                    info["cpuPercent"] = _calc_cpu_percent(stats)
                    info["memoryUsageMb"] = round(
                        stats.get("memory_stats", {}).get("usage", 0) / (1024 * 1024), 2
                    )
                    info["memoryLimitMb"] = round(
                        stats.get("memory_stats", {}).get("limit", 0) / (1024 * 1024), 2
                    )
                    mem_limit = stats.get("memory_stats", {}).get("limit", 0)
                    mem_usage = stats.get("memory_stats", {}).get("usage", 0)
                    info["memoryPercent"] = round(
                        (mem_usage / mem_limit * 100) if mem_limit > 0 else 0, 2
                    )
                except Exception:
                    info["cpuPercent"] = 0.0
                    info["memoryUsageMb"] = 0.0
                    info["memoryLimitMb"] = 0.0
                    info["memoryPercent"] = 0.0
            else:
                info["cpuPercent"] = 0.0
                info["memoryUsageMb"] = 0.0
                info["memoryLimitMb"] = 0.0
                info["memoryPercent"] = 0.0

            containers.append(info)

        # Docker system info
        docker_info = client.info()
        return {
            "available": True,
            "dockerVersion": docker_info.get("ServerVersion", "unknown"),
            "totalContainers": docker_info.get("Containers", 0),
            "runningContainers": docker_info.get("ContainersRunning", 0),
            "stoppedContainers": docker_info.get("ContainersStopped", 0),
            "totalImages": docker_info.get("Images", 0),
            "containers": containers,
        }
    except Exception as e:
        logger.error("Failed to collect Docker metrics: %s", e)
        return {"available": False, "containers": [], "error": str(e)}


def _format_ports(ports: dict) -> List[str]:
    """Format Docker port bindings into readable strings."""
    result = []
    if not ports:
        return result
    for container_port, bindings in ports.items():
        if bindings:
            for b in bindings:
                host = b.get("HostIp", "0.0.0.0")
                port = b.get("HostPort", "?")
                result.append(f"{host}:{port}->{container_port}")
        else:
            result.append(container_port)
    return result


def _calc_cpu_percent(stats: dict) -> float:
    """Calculate CPU percentage from Docker stats snapshot."""
    try:
        cpu = stats.get("cpu_stats", {})
        pre_cpu = stats.get("precpu_stats", {})
        cpu_delta = cpu.get("cpu_usage", {}).get("total_usage", 0) - \
                    pre_cpu.get("cpu_usage", {}).get("total_usage", 0)
        system_delta = cpu.get("system_cpu_usage", 0) - \
                       pre_cpu.get("system_cpu_usage", 0)
        num_cpus = len(cpu.get("cpu_usage", {}).get("percpu_usage", [1]))
        if system_delta > 0 and cpu_delta > 0:
            return round((cpu_delta / system_delta) * num_cpus * 100.0, 2)
    except Exception:
        pass
    return 0.0
