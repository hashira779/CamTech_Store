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
