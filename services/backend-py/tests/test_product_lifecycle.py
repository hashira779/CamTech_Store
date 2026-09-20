import pytest
import uuid
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

class MockUser:
    def __init__(self):
        self.id = "usr_test_admin"
        self.organization_id = "cmtk8h18o0000vkd0etmdacgw"
        self.email = "admin@mystore.test"
        self.name = "Test Admin"
        self.roles = '["SUPER_ADMIN", "ORG_ADMIN"]'
        self.location_id = None

@pytest.fixture
def mock_admin_user():
    user = MockUser()
    tenant_user = TenantUser(user=user, roles=["SUPER_ADMIN", "ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_product_update_and_delete_lifecycle(mock_admin_user):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a test product
        sku = f"TEST-SKU-{uuid.uuid4().hex[:6]}"
        create_payload = {
            "name": "Initial Test Product",
            "description": "Initial description",
            "type": "PHYSICAL",
            "variants": [
                {
                    "sku": sku,
                    "name": "Default Variant",
                    "unit": "piece",
                    "currency": "USD",
                    "costPrice": 10.0,
                    "sellPrice": 25.0,
                    "taxRatePct": 10.0,
                    "isActive": True
                }
            ]
        }
        res = await client.post("/api/v1/products", json=create_payload)
        assert res.status_code == 200, res.text
        product_data = res.json()["data"]
        product_id = product_data["id"]
        variant_id = product_data["variants"][0]["id"]
        assert product_data["name"] == "Initial Test Product"

        # 2. Update product master and variant
        update_payload = {
            "name": "Updated Test Product",
            "description": "Updated description",
            "variants": [
                {
                    "id": variant_id,
                    "sku": sku,
                    "sellPrice": 35.0,
                    "costPrice": 12.0
                }
            ]
        }
        res_update = await client.patch(f"/api/v1/products/{product_id}", json=update_payload)
        assert res_update.status_code == 200, res_update.text
        updated_data = res_update.json()["data"]
        assert updated_data["name"] == "Updated Test Product"
        assert updated_data["description"] == "Updated description"
        assert updated_data["variants"][0]["sellPrice"] == 35.0
        assert updated_data["variants"][0]["costPrice"] == 12.0

        # 3. Delete product (no transactions -> hard delete)
        res_del = await client.delete(f"/api/v1/products/{product_id}")
        assert res_del.status_code == 200, res_del.text
        del_data = res_del.json()["data"]
        assert del_data["deleted"] is True
        assert del_data["archived"] is False

        # 4. Verify product no longer exists
        res_get = await client.get(f"/api/v1/products/{product_id}")
        assert res_get.status_code == 404
