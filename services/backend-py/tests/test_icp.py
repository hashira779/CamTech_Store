import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete

from app.main import app
from app.core.dependencies import get_current_user, TenantUser
from app.core.database import AsyncSessionLocal
from app.modules.organizations.models import Organization
from app.modules.infra.models import (
    InfraAgent,
    InfraScheduledTask,
    InfraCloudflareConfig,
    InfraAlertRule,
    InfraAlert,
    InfraNotificationChannel,
)


class MockInfraAdminUser:
    def __init__(self, org_id: str):
        self.id = "usr_icp_tester"
        self.organization_id = org_id
        self.email = "admin@camtech.cam"
        self.name = "ICP Lead Architect"
        self.roles = '["SUPER_ADMIN", "SECURITY_ADMIN", "ORG_ADMIN"]'
        self.location_id = None


@pytest.mark.asyncio
async def test_icp_full_suite():
    """Verify ICP agent registration, heartbeat, scheduler, cloudflare, and alerts."""
    # 1. Organization context
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Organization))
        org = res.scalars().first()
        if not org:
            org = Organization(name="ICP Test Org", slug=f"icp-org-{uuid.uuid4().hex[:6]}")
            session.add(org)
            await session.commit()
            await session.refresh(org)
        org_id = org.id

    mock_user = MockInfraAdminUser(org_id=org_id)
    tenant_user = TenantUser(user=mock_user, roles=["SUPER_ADMIN", "SECURITY_ADMIN", "ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # ── Test 1: Agent Fleet & Heartbeat ──
        reg_res = await client.post(
            "/api/v1/infra/agents/register",
            json={
                "hostname": "vps-test-node-01",
                "ipAddress": "10.1.0.99",
                "port": 9100,
                "apiKey": "super-secret-agent-key-12345",
                "osType": "linux",
                "tags": ["production", "vps"],
            },
        )
        assert reg_res.status_code == 200, reg_res.text
        agent_data = reg_res.json()["data"]
        agent_id = agent_data["id"]

        # Heartbeat
        hb_res = await client.post(
            "/api/v1/infra/agents/heartbeat",
            json={
                "agentId": agent_id,
                "hostname": "vps-test-node-01",
                "metrics": {
                    "cpu": {"percent": 15.4, "count": 4},
                    "memory": {"percent": 42.1, "usedMb": 3400, "totalMb": 8192},
                    "disk": {"percent": 28.0, "usedGb": 22, "totalGb": 80},
                },
            },
        )
        assert hb_res.status_code == 200

        # List Agents
        list_agents_res = await client.get("/api/v1/infra/agents")
        assert list_agents_res.status_code == 200
        agents = list_agents_res.json()["data"]
        assert any(a["id"] == agent_id for a in agents)

        # ── Test 2: Scheduler Module ──
        create_task_res = await client.post(
            "/api/v1/infra/tasks",
            json={
                "name": "Nightly Memory Cleanup",
                "description": "Auto-restart test task",
                "cronExpr": "0 4 * * *",
                "command": "system.restart:camtech-backend",
                "agentId": agent_id,
                "enabled": True,
            },
        )
        assert create_task_res.status_code == 200, create_task_res.text
        task_id = create_task_res.json()["data"]["id"]

        # List tasks
        tasks_res = await client.get("/api/v1/infra/tasks")
        assert tasks_res.status_code == 200
        tasks = tasks_res.json()["data"]
        assert any(t["id"] == task_id for t in tasks)

        # ── Test 3: Cloudflare Integration ──
        cf_cfg_res = await client.post(
            "/api/v1/infra/cloudflare/config",
            json={
                "zoneName": "camtech.cam",
                "zoneId": "zone-test-id-123",
                "apiToken": "mock-cf-token-abc",
            },
        )
        assert cf_cfg_res.status_code == 200

        cf_analytics_res = await client.get("/api/v1/infra/cloudflare/analytics")
        assert cf_analytics_res.status_code == 200

        # ── Test 4: Alert Rules & Channels ──
        rule_res = await client.post(
            "/api/v1/infra/alert-rules",
            json={
                "name": "High RAM Alert",
                "category": "INFRA",
                "severity": "HIGH",
                "condition": {"metric": "memory_pct", "op": ">", "threshold": 85},
                "cooldownSec": 300,
                "enabled": True,
            },
        )
        assert rule_res.status_code == 200
        rule_id = rule_res.json()["data"]["id"]

        channel_res = await client.post(
            "/api/v1/infra/notification-channels",
            json={
                "name": "NOC Telegram",
                "type": "TELEGRAM",
                "config": {"bot_token": "12345:dummy", "chat_id": "-100123"},
                "enabled": True,
            },
        )
        assert channel_res.status_code == 200
        channel_id = channel_res.json()["data"]["id"]

        # Clean up test rows
        async with AsyncSessionLocal() as session:
            await session.execute(delete(InfraNotificationChannel).where(InfraNotificationChannel.id == channel_id))
            await session.execute(delete(InfraAlertRule).where(InfraAlertRule.id == rule_id))
            await session.execute(delete(InfraCloudflareConfig).where(InfraCloudflareConfig.zone_id == "zone-test-id-123"))
            await session.execute(delete(InfraScheduledTask).where(InfraScheduledTask.id == task_id))
            await session.execute(delete(InfraAgent).where(InfraAgent.id == agent_id))
            await session.commit()

    app.dependency_overrides.clear()
