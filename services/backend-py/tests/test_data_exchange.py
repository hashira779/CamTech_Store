import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser

class MockUser:
    def __init__(self):
        self.id = "usr_exchange_admin"
        self.organization_id = "org_demo"
        self.email = "admin@mystore.test"
        self.name = "Exchange Admin"
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
async def test_bulk_data_import_validation(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Import products with 1 valid and 1 invalid row
        payload = {
            "records": [
                {"name": "Valid Product 1", "sku": "SKU-001", "sellPrice": 10.0},
                {"sku": "SKU-002", "sellPrice": 15.0}  # Missing name
            ],
            "dryRun": True
        }
        res = await client.post("/api/v1/exchange/import/products", json=payload)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["totalRows"] == 2
        assert data["successfulRows"] == 1
        assert data["failedRows"] == 1
        assert len(data["errors"]) == 1
        assert "Missing required field 'name'" in data["errors"][0]
