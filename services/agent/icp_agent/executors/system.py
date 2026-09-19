"""
System-level executor — reboot, shutdown, uptime, and general command execution.
"""
import subprocess
import time
import platform
import logging
from typing import Dict, Any
from datetime import datetime, timezone

from icp_agent.config import AgentConfig

logger = logging.getLogger("icp.agent.executor.system")


def get_system_info() -> Dict[str, Any]:
    """Get comprehensive system information."""
    import psutil

    boot_time = datetime.fromtimestamp(psutil.boot_time(), tz=timezone.utc)
    uptime_secs = int(time.time() - psutil.boot_time())

    return {
        "hostname": platform.node(),
        "os": platform.system(),
        "osRelease": platform.release(),
        "osVersion": platform.version(),
        "architecture": platform.machine(),
        "pythonVersion": platform.python_version(),
        "bootTime": boot_time.isoformat(),
        "uptimeSeconds": uptime_secs,
        "uptimeHuman": _format_uptime(uptime_secs),
        "processCount": len(psutil.pids()),
        "users": [
            {"name": u.name, "terminal": u.terminal or "", "host": u.host}
            for u in psutil.users()
        ],
    }


def reboot_server(delay_seconds: int = 5) -> Dict[str, Any]:
    """Schedule a server reboot. Requires break-glass confirmation."""
    logger.critical("[SYSTEM] Server reboot initiated with %ds delay", delay_seconds)
    try:
        # Schedule reboot with delay
        result = subprocess.run(
            ["shutdown", "-r", f"+{max(1, delay_seconds // 60)}",
             "ICP Agent: Scheduled reboot from Control Center"],
            capture_output=True, text=True, timeout=10,
        )
        return {
            "success": result.returncode == 0,
            "message": f"Server reboot scheduled in {delay_seconds} seconds",
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except Exception as e:
        logger.error("Reboot failed: %s", e)
        return {"success": False, "error": str(e)}


def cancel_reboot() -> Dict[str, Any]:
    """Cancel a pending reboot."""
    try:
        result = subprocess.run(
            ["shutdown", "-c", "ICP Agent: Reboot cancelled by Control Center"],
            capture_output=True, text=True, timeout=10,
        )
        return {"success": True, "message": "Pending reboot cancelled"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def execute_allowed_command(command: str) -> Dict[str, Any]:
    """
    Execute a command ONLY if it's in the allowlist.
    This is the core security gate — no arbitrary shell execution.
    """
    if not AgentConfig.is_command_allowed(command):
        logger.warning("[SECURITY] Blocked non-allowlisted command: %s", command)
        return {
            "success": False,
            "error": "Command not in allowlist",
            "command": command,
            "hint": "Only pre-approved commands can be executed. Contact admin to update the allowlist.",
        }

    logger.info("Executing allowlisted command: %s", command)
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return {
            "success": result.returncode == 0,
            "command": command,
            "exitCode": result.returncode,
            "stdout": result.stdout.strip()[-5000:] if result.stdout else "",
            "stderr": result.stderr.strip()[-5000:] if result.stderr else "",
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "command": command, "error": "Command timed out after 60 seconds"}
    except Exception as e:
        return {"success": False, "command": command, "error": str(e)}


def _format_uptime(seconds: int) -> str:
    """Format uptime seconds into human-readable string."""
    days, remainder = divmod(seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, secs = divmod(remainder, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    return " ".join(parts)
