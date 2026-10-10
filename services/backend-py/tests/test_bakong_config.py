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
async def test_put_valid_bakong_config(mock_org_admin):
    """Verify PUT /api/v1/organizations/current/bakong validates and saves verified account."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "accountId": "store_admin@test",
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
        assert data["accountId"] == "store_admin@test"
        assert data["merchantName"] == "Test Dynamic Store"
        assert data["merchantCity"] == "Siem Reap"
        assert data["isConfigured"] is True

@pytest.mark.asyncio
async def test_put_invalid_bakong_account_format_fails(mock_org_admin):
    """Verify PUT rejects invalid account format with 422 Unprocessable Entity."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid with space and special characters
        payload = {
            "accountId": "invalid account with spaces!!!",
            "merchantName": "Test Store",
        }
        res = await client.put("/api/v1/organizations/current/bakong", json=payload)
        assert res.status_code in (400, 422)

@pytest.mark.asyncio
async def test_put_nonexistent_account_rejected_by_nbc(mock_org_admin):
    """Verify PUT rejects non-existent account with 400 Bad Request."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "accountId": "definitely_non_existent_123456789@devb",
            "merchantName": "Test Store",
        }
        res = await client.put("/api/v1/organizations/current/bakong", json=payload)
        # Should be rejected because account doesn't exist on NBC network!
        assert res.status_code == 400
        body = res.json()
        assert body["success"] is False
        assert "Verification Failed" in body["message"]

@pytest.mark.asyncio
async def test_verify_bakong_account_endpoint(mock_org_admin):
    """Verify POST /api/v1/organizations/current/bakong/verify returns live validation result."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Valid test account
        res = await client.post("/api/v1/organizations/current/bakong/verify", json={"accountId": "my_store@test"})
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["data"]["valid"] is True

        # Non-existent account
        res2 = await client.post("/api/v1/organizations/current/bakong/verify", json={"accountId": "non_existent_acc@devb"})
        assert res2.status_code == 200
        body2 = res2.json()
        assert body2["data"]["valid"] is False

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
