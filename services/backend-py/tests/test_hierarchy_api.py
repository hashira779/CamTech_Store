import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import User

class MockUser:
    def __init__(self):
        self.id = "usr_mock_admin"
        self.organization_id = "org_demo"
        self.email = "admin@mystore.test"
        self.name = "Mock Admin"
        self.roles = '["ORG_ADMIN"]'
        self.location_id = None

@pytest.fixture
def mock_tenant_user():
    user = MockUser()
    tenant_user = TenantUser(user=user, roles=["ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_locations_endpoints_unauthenticated():
    app.dependency_overrides.pop(get_current_user, None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/locations")
        assert res.status_code == 401

        res_tree = await client.get("/api/v1/locations/tree")
        assert res_tree.status_code == 401

        res_cat_tree = await client.get("/api/v1/categories/tree")
        assert res_cat_tree.status_code == 401

@pytest.mark.asyncio
async def test_hierarchy_endpoints_authenticated(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Location Tree returns list
        res = await client.get("/api/v1/locations/tree")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)

        # Categories tree returns list
        cat_res = await client.get("/api/v1/categories/tree")
        assert cat_res.status_code == 200
        cat_data = cat_res.json()
        assert cat_data["success"] is True
        assert isinstance(cat_data["data"], list)
