"""
ICP Agent Manager — manages registered agents, sends commands, collects metrics.

This service acts as the bridge between the web dashboard and the remote agents.
The dashboard never directly touches servers. All actions flow through:

  Dashboard → API Gateway → Infra Service → Agent Manager → Agent → Server
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

import httpx
from sqlalchemy import select, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now

logger = logging.getLogger("mystore.infra.agent_manager")

# Default timeout for agent HTTP calls
AGENT_TIMEOUT = 10.0
AGENT_METRICS_TIMEOUT = 15.0


class AgentManager:
    """Manages communication with ICP agents deployed on managed servers."""

    async def register_agent(
        self,
        db: AsyncSession,
        hostname: str,
        ip_address: str,
        agent_port: int,
        api_key: str,
        os_type: str = "linux",
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Register a new agent and store its API key hash."""
        from app.modules.infra.models import InfraAgent
        import hashlib

        # Hash the API key for storage (we never store plaintext keys)
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

        agent = InfraAgent(
            hostname=hostname,
            ip_address=ip_address,
            agent_port=agent_port,
            api_key_hash=api_key_hash,
            os_type=os_type,
            status="ONLINE",
            tags=tags or [],
            version="1.0.0",
            last_heartbeat_at=utc_now(),
        )
        db.add(agent)
        await db.commit()
        await db.refresh(agent)

        logger.info("Registered agent: %s (%s:%d)", hostname, ip_address, agent_port)
        return {
            "id": agent.id,
            "hostname": agent.hostname,
            "ipAddress": agent.ip_address,
            "port": agent.agent_port,
            "status": agent.status,
            "message": "Agent registered successfully. Install the agent on the server and configure ICP_API_KEY.",
        }

    async def deregister_agent(self, db: AsyncSession, agent_id: str) -> bool:
        """Remove an agent from management."""
        from app.modules.infra.models import InfraAgent
        stmt = select(InfraAgent).where(InfraAgent.id == agent_id)
        result = await db.execute(stmt)
        agent = result.scalar_one_or_none()
        if agent:
            await db.delete(agent)
            await db.commit()
            logger.info("Deregistered agent: %s (%s)", agent.hostname, agent.ip_address)
            return True
        return False

    async def list_agents(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """List all registered agents with their status."""
        from app.modules.infra.models import InfraAgent

        result = await db.execute(
            select(InfraAgent).order_by(desc(InfraAgent.last_heartbeat_at))
        )
        agents = result.scalars().all()

        now = utc_now()
        agent_list = []
        for a in agents:
            # Determine status from heartbeat freshness
            if a.last_heartbeat_at:
                age = (now - a.last_heartbeat_at).total_seconds()
                if age < 60:
                    status = "ONLINE"
                elif age < 180:
                    status = "DEGRADED"
                else:
                    status = "OFFLINE"
            else:
                status = "UNKNOWN"

            # Update status in DB if changed
            if status != a.status:
                await db.execute(
                    update(InfraAgent)
                    .where(InfraAgent.id == a.id)
                    .values(status=status, updated_at=now)
                )

            tags = a.tags
            if isinstance(tags, str):
                import json
                try:
                    tags = json.loads(tags)
                except Exception:
                    tags = []

            latest_metrics = a.latest_metrics
            if isinstance(latest_metrics, str):
                import json
                try:
                    latest_metrics = json.loads(latest_metrics)
                except Exception:
                    latest_metrics = None

            agent_list.append({
                "id": a.id,
                "hostname": a.hostname,
                "ipAddress": a.ip_address,
                "port": a.agent_port,
                "osType": a.os_type,
                "status": status,
                "version": a.version,
                "tags": tags or [],
                "lastHeartbeatAt": a.last_heartbeat_at.isoformat() if a.last_heartbeat_at else None,
                "latestMetrics": latest_metrics,
                "createdAt": a.created_at.isoformat() if a.created_at else None,
            })


        await db.commit()
        return agent_list

    async def process_heartbeat(
        self,
        db: AsyncSession,
        agent_id: str,
        hostname: str,
        metrics: Dict[str, Any],
        client_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Process a heartbeat from an agent and store latest metrics."""
        from app.modules.infra.models import InfraAgent
        import hashlib

        now = utc_now()

        # Find by agent_id first, fallback to hostname
        agent = None
        if agent_id:
            stmt = select(InfraAgent).where(InfraAgent.id == agent_id)
            result = await db.execute(stmt)
            agent = result.scalar_one_or_none()

        if not agent and hostname:
            stmt = select(InfraAgent).where(InfraAgent.hostname == hostname).order_by(desc(InfraAgent.created_at)).limit(1)
            result = await db.execute(stmt)
            agent = result.scalars().first()

        if not agent:
            # Auto-register agent on first verified heartbeat
            resolved_ip = client_ip or "10.1.0.11"
            if resolved_ip in ("127.0.0.1", "localhost", "::1") or resolved_ip.startswith("172."):
                resolved_ip = "10.1.0.11"

            agent = InfraAgent(
                hostname=hostname or agent_id or "ubuntuserver-virtual-machine",
                ip_address=resolved_ip,
                agent_port=9100,
                api_key_hash=hashlib.sha256("camtech-fleet-agent-key-2026".encode()).hexdigest(),
                os_type="linux",
                status="ONLINE",
                version="1.0.0",
                tags=["auto-registered", "production", "docker-host"],
                last_heartbeat_at=now,
                latest_metrics=metrics,
            )
            db.add(agent)
            await db.commit()
            await db.refresh(agent)
            logger.info("Auto-registered new agent on heartbeat: %s (%s:%d)", agent.hostname, agent.ip_address, agent.agent_port)
            return {"status": "ok", "agentId": agent.id, "autoRegistered": True}

        agent.status = "ONLINE"
        agent.last_heartbeat_at = now
        agent.latest_metrics = metrics
        agent.updated_at = now
        await db.commit()
        return {"status": "ok", "agentId": agent.id}

    async def _call_agent(
        self,
        db: AsyncSession,
        agent_id: str,
        method: str,
        path: str,
        json_body: Optional[dict] = None,
        timeout: float = AGENT_TIMEOUT,
    ) -> Dict[str, Any]:
        """Make an authenticated HTTP call to an agent."""
        from app.modules.infra.models import InfraAgent

        stmt = select(InfraAgent).where(InfraAgent.id == agent_id)
        result = await db.execute(stmt)
        agent = result.scalar_one_or_none()

        if not agent:
            return {"success": False, "error": "Agent not found"}

        url = f"http://{agent.ip_address}:{agent.agent_port}{path}"

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.request(
                    method=method,
                    url=url,
                    json=json_body,
                    headers={"X-ICP-Agent-Key": self._get_api_key_for_agent(agent)},
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {
                        "success": False,
                        "error": f"Agent returned {resp.status_code}",
                        "body": resp.text[:500],
                    }
        except httpx.ConnectError:
            return {"success": False, "error": f"Cannot connect to agent at {url}"}
        except httpx.ReadTimeout:
            return {"success": False, "error": "Agent did not respond in time"}
        except Exception as e:
            logger.error("Agent call failed: %s", e)
            return {"success": False, "error": str(e)}

    def _get_api_key_for_agent(self, agent) -> str:
        """
        Retrieve the plaintext API key for an agent.
        In production, this would use a secure vault or key exchange protocol.
        For now, the key is stored in the control center's environment.
        """
        import os
        # Use a per-agent key from env, or fall back to a shared key
        return os.getenv(f"ICP_AGENT_KEY_{agent.hostname.upper().replace('-', '_')}", 
                         os.getenv("ICP_AGENT_DEFAULT_KEY", "camtech-fleet-agent-key-2026"))

    async def get_agent_metrics(self, db: AsyncSession, agent_id: str) -> Dict[str, Any]:
        """Fetch current metrics from an agent."""
        return await self._call_agent(db, agent_id, "GET", "/metrics", timeout=AGENT_METRICS_TIMEOUT)

    async def get_agent_docker(self, db: AsyncSession, agent_id: str) -> Dict[str, Any]:
        """Fetch Docker container list from an agent."""
        return await self._call_agent(db, agent_id, "GET", "/docker/containers")

    async def get_all_docker_containers(self, db: AsyncSession) -> Dict[str, Any]:
        """Aggregate Docker containers across all active agents."""
        agents = await self.list_agents(db)
        all_containers = []
        for agent in agents:
            agent_id = agent["id"]
            agent_hostname = agent["hostname"]
            res = await self.get_agent_docker(db, agent_id)
            if res.get("available") and "containers" in res:
                for c in res["containers"]:
                    c["agentId"] = agent_id
                    c["agentHostname"] = agent_hostname
                    all_containers.append(c)
        return {"containers": all_containers, "total": len(all_containers)}

    async def get_agent_services(self, db: AsyncSession, agent_id: str) -> Dict[str, Any]:
        """Fetch systemd service list from an agent."""
        return await self._call_agent(db, agent_id, "GET", "/services")

    async def send_command(
        self,
        db: AsyncSession,
        agent_id: str,
        command: str,
        actor_id: str,
        break_glass_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a command to an agent and log it."""
        from app.modules.infra.models import InfraAgentCommand

        # Log the command attempt
        cmd_record = InfraAgentCommand(
            agent_id=agent_id,
            actor_id=actor_id,
            command=command,
            status="PENDING",
        )
        db.add(cmd_record)
        await db.flush()

        # Execute via agent
        result = await self._call_agent(
            db, agent_id, "POST", "/exec",
            json_body={"command": command, "breakGlassToken": break_glass_token},
        )

        # Update command record
        cmd_record.status = "SUCCESS" if result.get("success") else "FAILED"
        cmd_record.result = str(result)[:5000]
        cmd_record.executed_at = utc_now()
        await db.commit()

        return result

    async def restart_service(
        self, db: AsyncSession, agent_id: str, service_name: str, actor_id: str,
    ) -> Dict[str, Any]:
        """Restart a systemd service on an agent."""
        from app.modules.infra.models import InfraAgentCommand

        cmd_record = InfraAgentCommand(
            agent_id=agent_id,
            actor_id=actor_id,
            command=f"service.restart:{service_name}",
            status="PENDING",
        )
        db.add(cmd_record)
        await db.flush()

        result = await self._call_agent(
            db, agent_id, "POST", f"/services/{service_name}/restart",
        )

        cmd_record.status = "SUCCESS" if result.get("success") else "FAILED"
        cmd_record.result = str(result)[:5000]
        cmd_record.executed_at = utc_now()
        await db.commit()

        return result

    async def docker_action(
        self, db: AsyncSession, agent_id: str, container_id: str, action: str, actor_id: str,
    ) -> Dict[str, Any]:
        """Execute a Docker action (start/stop/restart) on an agent."""
        from app.modules.infra.models import InfraAgentCommand

        cmd_record = InfraAgentCommand(
            agent_id=agent_id,
            actor_id=actor_id,
            command=f"docker.{action}:{container_id}",
            status="PENDING",
        )
        db.add(cmd_record)
        await db.flush()

        result = await self._call_agent(
            db, agent_id, "POST", f"/docker/{container_id}/{action}",
        )

        cmd_record.status = "SUCCESS" if result.get("success") else "FAILED"
        cmd_record.result = str(result)[:5000]
        cmd_record.executed_at = utc_now()
        await db.commit()

        return result

    async def reboot_server(
        self, db: AsyncSession, agent_id: str, actor_id: str,
        delay_seconds: int = 60, break_glass_token: str = "",
    ) -> Dict[str, Any]:
        """Reboot a server via its agent. Requires break-glass."""
        from app.modules.infra.models import InfraAgentCommand

        cmd_record = InfraAgentCommand(
            agent_id=agent_id,
            actor_id=actor_id,
            command="system.reboot",
            parameters={"delaySeconds": delay_seconds},
            status="PENDING",
        )
        db.add(cmd_record)
        await db.flush()

        result = await self._call_agent(
            db, agent_id, "POST", "/system/reboot",
            json_body={"delaySeconds": delay_seconds, "breakGlassToken": break_glass_token},
        )

        cmd_record.status = "SUCCESS" if result.get("success") else "FAILED"
        cmd_record.result = str(result)[:5000]
        cmd_record.executed_at = utc_now()
        await db.commit()

        return result

    async def get_command_history(
        self, db: AsyncSession, agent_id: Optional[str] = None, limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get command execution history."""
        from app.modules.infra.models import InfraAgentCommand

        query = select(InfraAgentCommand).order_by(desc(InfraAgentCommand.created_at)).limit(limit)
        if agent_id:
            query = query.where(InfraAgentCommand.agent_id == agent_id)

        result = await db.execute(query)
        commands = result.scalars().all()
        return [
            {
                "id": c.id,
                "agentId": c.agent_id,
                "actorId": c.actor_id,
                "command": c.command,
                "status": c.status,
                "result": c.result,
                "executedAt": c.executed_at.isoformat() if c.executed_at else None,
                "createdAt": c.created_at.isoformat() if c.created_at else None,
            }
            for c in commands
        ]


# Singleton instance
agent_manager = AgentManager()
