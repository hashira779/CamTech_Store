import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete

from app.main import app
from app.microservices.infra_service import app as infra_ms_app
from app.microservices.gateway import gateway
from app.core.dependencies import get_current_user, TenantUser
from app.core.database import AsyncSessionLocal
from app.modules.organizations.models import Organization
from app.modules.infra.models import (
    InfraIncident,
    InfraIncidentTimeline,
    InfraBreakGlassSession,
)
from app.models.entities import AuditLog
from app.core.rate_limiter import ip_ban_list


class MockInfraAdminUser:
    def __init__(self, org_id: str):
        self.id = "usr_infra_test"
        self.organization_id = org_id
        self.email = "admin@camtech.cam"
        self.name = "NOC Lead Engineer"
        self.roles = '["SUPER_ADMIN", "SECURITY_ADMIN", "ORG_ADMIN"]'
        self.location_id = None


@pytest.mark.asyncio
async def test_infra_microservice_health():
    """Verify that standalone Infra Microservice (port 4009) boots and answers /health."""
    async with AsyncClient(transport=ASGITransport(app=infra_ms_app), base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert "Infra & Security" in data["service"]
        assert data["port"] == 4009
        assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_infra_control_full_lifecycle():
    """Verify full end-to-end telemetry, topology, IP ban, incident, and break-glass endpoints."""
    # 1. Resolve tenant context
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Organization))
        org = res.scalars().first()
        if not org:
            org = Organization(name="Infra Test Org", slug=f"infra-org-{uuid.uuid4().hex[:6]}")
            session.add(org)
            await session.commit()
            await session.refresh(org)
        org_id = org.id

    mock_user = MockInfraAdminUser(org_id=org_id)
    tenant_user = TenantUser(user=mock_user, roles=["SUPER_ADMIN", "SECURITY_ADMIN", "ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user

    test_ip = "198.51.100.42"
    created_incident_id = None
    created_break_glass_id = None

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 2. Operational Overview (GET /api/v1/infra/overview)
            res = await client.get("/api/v1/infra/overview")
            assert res.status_code == 200
            envelope = res.json()
            assert envelope["success"] is True
            overview = envelope["data"]
            assert "globalStatus" in overview
            assert "totalServices" in overview
            assert "activeIncidentsCount" in overview
            assert overview["totalServices"] >= 7

            # 3. Microservices Directory (GET /api/v1/infra/services)
            res = await client.get("/api/v1/infra/services")
            assert res.status_code == 200
            services = res.json()["data"]
            assert len(services) >= 7
            service_names = [s["name"] for s in services]
            assert "API Edge Gateway" in service_names
            assert "Infra & Security Control Center" in service_names

            # 4. Service Topology Graph (GET /api/v1/infra/topology)
            res = await client.get("/api/v1/infra/topology")
            assert res.status_code == 200
            topology = res.json()["data"]
            assert "nodes" in topology
            assert "edges" in topology
            assert len(topology["nodes"]) >= 7
            assert len(topology["edges"]) >= 5

            # 5. Live Edge Traffic (GET /api/v1/infra/traffic)
            res = await client.get("/api/v1/infra/traffic")
            assert res.status_code == 200
            traffic = res.json()["data"]
            assert isinstance(traffic, list)

            # 6. Threat Center IP Ban Lifecycle (POST / GET / DELETE)
            # A) Ban IP
            ban_res = await client.post("/api/v1/infra/security/bans", json={
                "ip": test_ip,
                "reason": "Automated security test ban",
                "durationHours": 1,
            })
            assert ban_res.status_code == 201
            assert "blocked" in ban_res.json()["data"]["message"].lower()

            # B) Verify IP is in Active Bans
            bans_res = await client.get("/api/v1/infra/security/bans")
            assert bans_res.status_code == 200
            active_bans = bans_res.json()["data"]["bans"]
            matching_ban = next((b for b in active_bans if b["ip"] == test_ip), None)
            assert matching_ban is not None
            assert matching_ban["reason"] in ["Automated security test ban", "in-memory ban"]

            # C) Unban IP
            unban_res = await client.delete(f"/api/v1/infra/security/bans/{test_ip}")
            assert unban_res.status_code == 200
            assert "unbanned" in unban_res.json()["data"]["message"].lower()

            # 7. Incident Declaration & Timeline (POST / GET /api/v1/infra/incidents)
            inc_payload = {
                "title": f"Test Sev-2 Outage {uuid.uuid4().hex[:6]}",
                "severity": "SEV2",
                "description": "Simulated failover incident verification",
                "affectedServices": ["gateway", "infra-control"],
            }
            inc_res = await client.post("/api/v1/infra/incidents", json=inc_payload)
            assert inc_res.status_code == 201
            created_incident = inc_res.json()["data"]
            created_incident_id = created_incident["id"]
            assert created_incident["title"] == inc_payload["title"]
            assert created_incident["status"] in ["DETECTED", "INVESTIGATING"]
            assert len(created_incident["timeline"]) >= 1

            # Verify incident appears in incident list
            inc_list_res = await client.get("/api/v1/infra/incidents")
            assert inc_list_res.status_code == 200
            incs = inc_list_res.json()["data"]
            found_inc = next((i for i in incs if i["id"] == created_incident_id), None)
            assert found_inc is not None

            # 8. Emergency Break-Glass Protocol Validation
            # A) Bad confirmation phrase rejection
            bad_bg_res = await client.post("/api/v1/infra/break-glass", json={
                "reason": "Test break glass",
                "confirmation": "WRONG_PHRASE",
            })
            assert bad_bg_res.status_code == 400

            # B) Valid Break-Glass Activation
            bg_res = await client.post("/api/v1/infra/break-glass", json={
                "reason": "Sev-1 Emergency Database Failover Hot-Patch",
                "confirmation": "I CONFIRM BREAK GLASS",
            })
            assert bg_res.status_code == 201
            bg_data = bg_res.json()["data"]
            created_break_glass_id = bg_data["sessionId"]
            assert bg_data["durationMinutes"] == 20

            # 9. Audit Trail (GET /api/v1/infra/audit)
            audit_res = await client.get("/api/v1/infra/audit")
            assert audit_res.status_code == 200
            audit_logs = audit_res.json()["data"]
            assert isinstance(audit_logs, list)
            # Find the break-glass audit entry
            bg_audit = next((l for l in audit_logs if l["isBreakGlass"] is True), None)
            assert bg_audit is not None

    finally:
        # Cleanup: Revert overrides, remove test DB rows, clear test IP from ban list
        app.dependency_overrides.pop(get_current_user, None)
        await ip_ban_list.unban(test_ip)

        async with AsyncSessionLocal() as clean_session:
            if created_incident_id:
                await clean_session.execute(
                    delete(InfraIncidentTimeline).where(InfraIncidentTimeline.incident_id == created_incident_id)
                )
                await clean_session.execute(
                    delete(InfraIncident).where(InfraIncident.id == created_incident_id)
                )
            if created_break_glass_id:
                await clean_session.execute(
                    delete(InfraBreakGlassSession).where(InfraBreakGlassSession.id == created_break_glass_id)
                )
            # Clean up test audit log entries created in this test run
            await clean_session.execute(
                delete(AuditLog).where(AuditLog.actor_id == "usr_infra_test")
            )
            await clean_session.commit()
