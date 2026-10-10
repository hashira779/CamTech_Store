import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser

class MockOrgAdminUser:
    def __init__(self):
        self.id = "usr_org_admin"
        self.organization_id = "cmtk8h18o0000vkd0etmdacgw"
        self.email = "admin@demo.test"
        self.name = "Store Admin"
        self.roles = '["ORG_ADMIN"]'
        self.location_id = None

@pytest.fixture
def mock_org_admin():
    user = MockOrgAdminUser()
    tenant_user = TenantUser(user=user, roles=["ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_get_current_bakong_config(mock_org_admin):
    """Verify GET /api/v1/organizations/current/bakong returns Bakong config structure."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/organizations/current/bakong")
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        data = body["data"]
        assert "accountId" in data
        assert "merchantName" in data
        assert "enabled" in data
        assert "isConfigured" in data

@pytest.mark.asyncio
async def test_put_current_bakong_config(mock_org_admin):
    """Verify PUT /api/v1/organizations/current/bakong persists dynamic config without mock data."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "accountId": "test_store_user@aclb",
            "merchantName": "Test Dynamic Store",
            "merchantCity": "Siem Reap",
            "currency": "USD",
            "enabled": True,
        }
        res = await client.put("/api/v1/organizations/current/bakong", json=payload)
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        data = body["data"]
        assert data["accountId"] == "test_store_user@aclb"
        assert data["merchantName"] == "Test Dynamic Store"
        assert data["merchantCity"] == "Siem Reap"
        assert data["isConfigured"] is True

@pytest.mark.asyncio
async def test_channels_reflects_bakong_status(mock_org_admin):
    """Verify channels endpoint includes dynamic Bakong config status."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/organizations/current/channels")
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        data = body["data"]
        assert "bakongConfigured" in data
        assert "bakongAccountId" in data
        assert "bakongEnabled" in data
