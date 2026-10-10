import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser

class MockSuperAdminUser:
    def __init__(self):
        self.id = "usr_super_admin"
        self.organization_id = "cmtk8h18o0000vkd0etmdacgw"
        self.email = "admin@demo.test"
        self.name = "Super Admin"
        self.roles = '["SUPER_ADMIN", "ORG_ADMIN"]'
        self.location_id = None

@pytest.fixture
def mock_super_admin():
    user = MockSuperAdminUser()
    tenant_user = TenantUser(user=user, roles=["SUPER_ADMIN", "ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_public_products_accepts_org_filter():
    """Verify GET /api/v1/public/products handles organizationId filter without error."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/public/products?organizationId=non_existent_org_123")
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert "items" in body["data"]

@pytest.mark.asyncio
async def test_public_categories_tree_accepts_org_filter():
    """Verify GET /api/v1/public/categories/tree handles organizationId filter without error."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/public/categories/tree?organizationId=non_existent_org_123")
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)

@pytest.mark.asyncio
async def test_list_organizations_super_admin(mock_super_admin):
    """Verify GET /api/v1/organizations returns organization list for SUPER_ADMIN."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/organizations")
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)

@pytest.mark.asyncio
async def test_get_current_organization_channels(mock_super_admin):
    """Verify GET /api/v1/organizations/current/channels returns channels schema."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/organizations/current/channels")
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        data = body["data"]
        assert "telegramMiniAppUrl" in data
        assert "storefrontUrl" in data
        assert "paywayConfigured" in data

@pytest.mark.asyncio
async def test_telegram_mini_app_auth_and_registration(mock_super_admin):
    """Verify POST /api/v1/telegram/mini-app/auth auto-registers Customer with Telegram details."""
    import json
    import urllib.parse
    from app.core.database import AsyncSessionLocal
    from app.modules.customers.models import Customer
    from sqlalchemy import delete

    user_data = {
        "id": 987654321,
        "first_name": "Sokha",
        "last_name": "Chan",
        "username": "sokhachan",
        "language_code": "km"
    }
    import time
    now_ts = int(time.time())
    init_data = f"auth_date={now_ts}&user={urllib.parse.quote(json.dumps(user_data))}&hash=dummy_hash"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/telegram/mini-app/auth",
            json={
                "initData": init_data,
                "organizationId": mock_super_admin.organization_id,
                "phone": "012888999"
            }
        )
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        data = body["data"]
        assert "token" in data
        assert data["customer"] is not None
        assert data["customer"]["name"] == "Sokha Chan"
        assert data["customer"]["phone"] == "012888999"
        assert data["customer"]["code"] == "TG-987654321"
        assert data["customer"]["loyaltyPoints"] >= 100

        # Test sync contact
        sync_res = await client.post(
            "/api/v1/telegram/mini-app/sync-contact",
            headers={"Authorization": f"Bearer {data['token']}"},
            json={
                "customerId": data["customer"]["id"],
                "organizationId": mock_super_admin.organization_id,
                "phoneNumber": "099777888",
                "address": "Street 271, Phnom Penh"
            }
        )
        assert sync_res.status_code == 200
        sync_body = sync_res.json()
        assert sync_body["success"] is True
        assert sync_body["data"]["customer"]["phone"] == "099777888"
        assert sync_body["data"]["customer"]["defaultAddress"] == "Street 271, Phnom Penh"

        # Cleanup created test row to preserve live DB integrity
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Customer).where(Customer.id == data["customer"]["id"]))
            await db.commit()
