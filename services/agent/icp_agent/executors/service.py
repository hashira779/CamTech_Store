"""
Systemd service management executor.
"""
import subprocess
import logging
from typing import Dict, Any

logger = logging.getLogger("icp.agent.executor.service")

ALLOWED_ACTIONS = {"start", "stop", "restart", "status", "enable", "disable"}


def service_action(name: str, action: str) -> Dict[str, Any]:
    """Execute a systemctl action on a named service."""
    if action not in ALLOWED_ACTIONS:
        return {"success": False, "error": f"Action '{action}' not allowed. Use: {ALLOWED_ACTIONS}"}

    # Sanitize service name (no path traversal, no shell injection)
    safe_name = name.replace("/", "").replace(";", "").replace("&", "").replace("|", "").strip()
    if not safe_name:
        return {"success": False, "error": "Invalid service name"}

    cmd = ["systemctl", action, safe_name]
    logger.info("Executing: %s", " ".join(cmd))

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return {
            "success": result.returncode == 0,
            "command": " ".join(cmd),
            "exitCode": result.returncode,
            "stdout": result.stdout.strip()[-2000:] if result.stdout else "",
            "stderr": result.stderr.strip()[-2000:] if result.stderr else "",
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timed out after 30 seconds"}
    except Exception as e:
        logger.error("Service action failed: %s", e)
        return {"success": False, "error": str(e)}


def service_status(name: str) -> Dict[str, Any]:
    """Get detailed status of a systemd service."""
    safe_name = name.replace("/", "").replace(";", "").replace("&", "").strip()
    try:
        # Get status
        result = subprocess.run(
            ["systemctl", "is-active", safe_name],
            capture_output=True, text=True, timeout=10,
        )
        is_active = result.stdout.strip()

        # Get full status
        full = subprocess.run(
            ["systemctl", "status", safe_name, "--no-pager"],
            capture_output=True, text=True, timeout=10,
        )

        return {
            "name": safe_name,
            "active": is_active,
            "running": is_active == "active",
            "details": full.stdout.strip()[-3000:] if full.stdout else "",
        }
    except Exception as e:
        return {"name": safe_name, "active": "unknown", "running": False, "error": str(e)}


def service_logs(name: str, lines: int = 100) -> Dict[str, Any]:
    """Get recent journal logs for a systemd service."""
    safe_name = name.replace("/", "").replace(";", "").replace("&", "").strip()
    lines = min(lines, 500)  # Cap at 500 lines
    try:
        result = subprocess.run(
            ["journalctl", "-u", safe_name, "-n", str(lines), "--no-pager", "--output=short"],
            capture_output=True, text=True, timeout=15,
        )
        return {
            "success": True,
            "service": safe_name,
            "lines": result.stdout.strip()[-10000:] if result.stdout else "",
            "lineCount": len(result.stdout.strip().splitlines()) if result.stdout else 0,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def list_services() -> Dict[str, Any]:
    """List all systemd services with their status."""
    try:
        result = subprocess.run(
            ["systemctl", "list-units", "--type=service", "--no-pager", "--plain", "--all"],
            capture_output=True, text=True, timeout=15,
        )
        services = []
        for line in result.stdout.strip().splitlines():
            parts = line.split(None, 4)
            if len(parts) >= 4 and parts[0].endswith(".service"):
                services.append({
                    "name": parts[0].replace(".service", ""),
                    "loaded": parts[1],
                    "active": parts[2],
                    "sub": parts[3],
                    "description": parts[4] if len(parts) > 4 else "",
                })
        return {"success": True, "services": services, "total": len(services)}
    except Exception as e:
        return {"success": False, "services": [], "error": str(e)}
