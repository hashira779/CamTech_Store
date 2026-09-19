"""
ICP Agent Configuration — loaded from environment or /etc/icp-agent/config.env
"""
import os
from pathlib import Path


def _load_env_file():
    """Load config from /etc/icp-agent/config.env if present."""
    for path in [
        Path("/etc/icp-agent/config.env"),
        Path.home() / ".icp-agent.env",
        Path(__file__).parent.parent / ".env",
    ]:
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip("'\""))
            break


_load_env_file()


class AgentConfig:
    """All agent settings with secure defaults."""

    # ── Identity ──────────────────────────────────────────────────────────────
    AGENT_ID: str = os.getenv("ICP_AGENT_ID", "")
    HOSTNAME: str = os.getenv("ICP_HOSTNAME", "")
    BIND_HOST: str = os.getenv("ICP_BIND_HOST", "0.0.0.0")
    BIND_PORT: int = int(os.getenv("ICP_BIND_PORT", "9100"))

    # ── Authentication ────────────────────────────────────────────────────────
    API_KEY: str = os.getenv("ICP_API_KEY", "")

    # ── Control Center ────────────────────────────────────────────────────────
    CONTROL_CENTER_URL: str = os.getenv("ICP_CONTROL_CENTER_URL", "http://localhost:4000")
    HEARTBEAT_INTERVAL: int = int(os.getenv("ICP_HEARTBEAT_INTERVAL", "30"))

    # ── Command Allowlist ─────────────────────────────────────────────────────
    # Only these command prefixes are allowed to be executed by the agent.
    # Anything not in this list is rejected with 403.
    ALLOWED_COMMANDS: list = [
        "systemctl restart",
        "systemctl stop",
        "systemctl start",
        "systemctl status",
        "journalctl",
        "docker restart",
        "docker stop",
        "docker start",
        "docker logs",
        "docker ps",
        "docker stats",
        "docker compose",
        "reboot",
        "shutdown",
        "uptime",
        "free",
        "df",
        "top -bn1",
        "ps aux",
        "cat /proc/loadavg",
        "cat /proc/uptime",
        "docker container prune",
        "docker image prune",
        "apt update",
        "apt upgrade -y",
    ]

    # ── Dangerous commands that require break-glass token ─────────────────────
    BREAK_GLASS_COMMANDS: list = [
        "reboot",
        "shutdown",
        "rm ",
        "mkfs",
        "dd ",
        "fdisk",
    ]

    @classmethod
    def is_command_allowed(cls, command: str) -> bool:
        """Check if a command is in the allowlist."""
        cmd = command.strip()
        return any(cmd.startswith(prefix) for prefix in cls.ALLOWED_COMMANDS)

    @classmethod
    def requires_break_glass(cls, command: str) -> bool:
        """Check if a command requires break-glass authorization."""
        cmd = command.strip()
        return any(cmd.startswith(prefix) for prefix in cls.BREAK_GLASS_COMMANDS)

    @classmethod
    def get_hostname(cls) -> str:
        """Get hostname from config or auto-detect."""
        if cls.HOSTNAME:
            return cls.HOSTNAME
        import socket
        return socket.gethostname()
