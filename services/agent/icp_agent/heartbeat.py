"""
Heartbeat sender — periodically reports agent health to the control center.
"""
import asyncio
import logging
import platform
import time
from datetime import datetime, timezone

import httpx

from icp_agent.config import AgentConfig

logger = logging.getLogger("icp.agent.heartbeat")


async def heartbeat_loop():
    """Send periodic heartbeat to control center with basic system metrics."""
    import psutil

    url = f"{AgentConfig.CONTROL_CENTER_URL}/api/v1/infra/agents/heartbeat"
    interval = AgentConfig.HEARTBEAT_INTERVAL

    logger.info("Starting heartbeat loop (interval=%ds, url=%s)", interval, url)

    while True:
        try:
            vm = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            cpu = psutil.cpu_percent(interval=0)
            load = psutil.getloadavg()
            boot = psutil.boot_time()
            uptime = int(time.time() - boot)

            payload = {
                "agentId": AgentConfig.AGENT_ID,
                "hostname": AgentConfig.get_hostname(),
                "os": platform.system(),
                "osRelease": platform.release(),
                "agentVersion": "1.0.0",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metrics": {
                    "cpuPercent": round(cpu, 2),
                    "memoryPercent": round(vm.percent, 2),
                    "memoryUsedMb": round(vm.used / (1024 * 1024), 2),
                    "memoryTotalMb": round(vm.total / (1024 * 1024), 2),
                    "diskPercent": round(disk.percent, 2),
                    "diskUsedGb": round(disk.used / (1024 ** 3), 2),
                    "diskTotalGb": round(disk.total / (1024 ** 3), 2),
                    "loadAvg1": round(load[0], 2),
                    "loadAvg5": round(load[1], 2),
                    "loadAvg15": round(load[2], 2),
                    "uptimeSeconds": uptime,
                    "processCount": len(psutil.pids()),
                },
            }

            # Add Docker container count if available
            try:
                import docker
                client = docker.from_env()
                payload["metrics"]["containerCount"] = len(client.containers.list())
                payload["metrics"]["containerRunning"] = len(
                    client.containers.list(filters={"status": "running"})
                )
            except Exception:
                payload["metrics"]["containerCount"] = 0
                payload["metrics"]["containerRunning"] = 0

            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    url,
                    json=payload,
                    headers={"X-ICP-Agent-Key": AgentConfig.API_KEY},
                )
                if resp.status_code == 200:
                    logger.debug("Heartbeat sent successfully")
                else:
                    logger.warning("Heartbeat response: %d %s", resp.status_code, resp.text[:200])

        except httpx.ConnectError:
            logger.debug("Control center unreachable at %s — will retry", url)
        except Exception as e:
            logger.error("Heartbeat error: %s", e)

        await asyncio.sleep(interval)
