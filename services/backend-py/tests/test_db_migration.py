import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser

class MockInfraAdminUser:
    def __init__(self):
        self.id = "usr_infra_admin"
        self.organization_id = "cmtk8h18o0000vkd0etmdacgw"
        self.email = "devops@camtech.cam"
        self.name = "Infra DevOps Admin"
        self.roles = '["SUPER_ADMIN", "DEVOPS"]'
        self.location_id = None

@pytest.fixture
def mock_infra_admin():
    user = MockInfraAdminUser()
    tenant_user = TenantUser(user=user, roles=["SUPER_ADMIN", "DEVOPS"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_get_active_database_status(mock_infra_admin):
    """Verify GET /api/v1/infra/database/status returns active PostgreSQL metrics."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/infra/database/status")
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        data = body["data"]
        assert "currentDsnMasked" in data
        assert "database" in data
        assert "pingLatencyMs" in data
        assert "tableCount" in data
        assert data["tableCount"] > 0
        assert data["status"] in ("HEALTHY", "DEGRADED")

@pytest.mark.asyncio
async def test_test_database_connection_success(mock_infra_admin):
    """Verify POST /api/v1/infra/database/test-connection against local database succeeds."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "host": "localhost",
            "port": 5432,
            "database": "camtechStore",
            "user": "camtech",
            "password": "camtech123",
            "sslMode": "disable",
            "environmentType": "LOCAL_NODE",
        }
        res = await client.post("/api/v1/infra/database/test-connection", json=payload)
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        data = body["data"]
        assert data["success"] is True
        assert data["databaseExists"] is True
        assert data["tableCount"] > 0
        assert data["latencyMs"] >= 0

@pytest.mark.asyncio
async def test_test_database_connection_invalid_host(mock_infra_admin):
    """Verify POST /api/v1/infra/database/test-connection against unreachable host fails gracefully."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "host": "192.0.2.1",  # Test-net unreachable IP
            "port": 5432,
            "database": "camtechStore",
            "user": "camtech",
            "password": "wrongpassword",
            "sslMode": "disable",
            "environmentType": "LOCAL_NODE",
        }
        res = await client.post("/api/v1/infra/database/test-connection", json=payload)
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        data = body["data"]
        # Failure is captured safely in DTO without crashing server
        assert data["success"] is False
        assert "failed" in data["message"].lower() or "timeout" in data["message"].lower()
