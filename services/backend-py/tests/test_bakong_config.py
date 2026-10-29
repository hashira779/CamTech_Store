import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.main import app
from app.core.database import engine
from app.core.dependencies import get_current_user, TenantUser

class MockOrgAdminUser:
    def __init__(self):
        self.id = "usr_org_admin"
        self.organization_id = "cmtk8h18o0000vkd0etmdacgw"
        self.email = "admin@demo.test"
        self.name = "Store Admin"
        self.roles = '["ORG_ADMIN"]'
        self.location_id = None

@pytest_asyncio.fixture
async def mock_org_admin():
    user = MockOrgAdminUser()
    tenant_user = TenantUser(user=user, roles=["ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    # These tests save Bakong settings on the demo store: put the store's real config back afterwards.
    async with engine.begin() as conn:
        original = (await conn.execute(text("select settings from organizations where id=:id"), {"id": user.organization_id})).scalar()
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)
    async with engine.begin() as conn:
        await conn.execute(text("update organizations set settings=:s where id=:id"), {"s": original, "id": user.organization_id})
        await conn.execute(text("delete from audit_logs where \"actorId\"='usr_org_admin' and action='PAYMENT_CREDENTIAL_REPLACED'"))

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
            "accountId": "no_such_acct_9871@devb",
            "merchantName": "Test Store",
        }
        res = await client.put("/api/v1/organizations/current/bakong", json=payload)
        # Rejected: the account cannot be confirmed on NBC (no token here, or not found) — nothing saved.
        assert res.status_code in (400, 502)
        body = res.json()
        assert body["success"] is False
        assert body["message"].startswith("Update failed")


@pytest.mark.asyncio
@pytest.mark.parametrize("payload, needle", [
    ({"accountId": "85512345678", "merchantName": "Shop"}, "name@bank"),
    ({"accountId": "shop@test", "merchantName": "A" * 26}, "at most 25"),
    ({"accountId": "shop@test", "merchantName": "ហាងកាហ្វេ"}, "English letters"),
    ({"accountId": "shop@test", "merchantName": ""}, "Merchant name is required"),
    ({"accountId": "shop@test", "merchantName": "Shop", "merchantCity": "Phnom Penh Capital City"}, "at most 15"),
    ({"accountId": "shop@test", "merchantName": "Shop", "accountType": "MERCHANT"}, "Merchant ID and the Acquiring Bank"),
])
async def test_put_invalid_bakong_fields_fail_with_readable_message(mock_org_admin, payload, needle):
    """Every bad field fails the save with a sentence a store owner can act on (no Python error dump)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.put("/api/v1/organizations/current/bakong", json=payload)
        assert res.status_code == 400
        body = res.json()
        assert body["success"] is False
        assert needle in body["message"]
        assert "'loc'" not in body["message"] and "{" not in body["message"]


@pytest.mark.asyncio
async def test_put_merchant_account_saves_merchant_fields(mock_org_admin):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {"accountId": "coffee_lab@test", "accountType": "MERCHANT", "merchantName": "Coffee Lab",
                   "merchantId": "MID-000123", "acquiringBank": "ACLEDA Bank", "merchantCity": "Phnom Penh"}
        res = await client.put("/api/v1/organizations/current/bakong", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["accountType"] == "MERCHANT" and data["merchantId"] == "MID-000123"
        assert data["acquiringBank"] == "ACLEDA Bank" and data["accountVerifiedAt"]

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
