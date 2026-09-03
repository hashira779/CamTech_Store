import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser

class MockUser:
    def __init__(self, roles=None):
        self.id = "usr_test_1"
        self.organization_id = "org_demo"
        self.email = "test@camtech.cam"
        self.name = "Test User"
        self.roles = str(roles or ["CASHIER"])
        self.location_id = None

@pytest.mark.asyncio
async def test_get_app_registry():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/apps/registry")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["total"] == 11
        app_ids = [a["id"] for a in data["applications"]]
        assert "store" in app_ids
        assert "cashier" in app_ids
        assert "delivery" in app_ids
        assert "hr" in app_ids
        assert "finance" in app_ids
        assert "warehouse" in app_ids
        assert "ceo" in app_ids
        assert "admin" in app_ids
        assert "partner" in app_ids
        assert "customer" in app_ids
        assert "support" in app_ids

@pytest.mark.asyncio
async def test_resolve_subdomains():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # store.camtech.cam -> store app
        res_store = await client.get("/api/v1/apps/resolve?host=store.camtech.cam")
        assert res_store.status_code == 200
        data_store = res_store.json()["data"]
        assert data_store["appId"] == "store"
        assert data_store["resolvedRoute"] == "/shop"

        # delivery.camtech.cam -> delivery app
        res_del = await client.get("/api/v1/apps/resolve?host=delivery.camtech.cam")
        assert res_del.status_code == 200
        data_del = res_del.json()["data"]
        assert data_del["appId"] == "delivery"
        assert data_del["resolvedRoute"] == "/driver"

        # hr.camtech.cam -> hr app
        res_hr = await client.get("/api/v1/apps/resolve?host=hr.camtech.cam")
        assert res_hr.status_code == 200
        data_hr = res_hr.json()["data"]
        assert data_hr["appId"] == "hr"
        assert data_hr["resolvedRoute"] == "/hr"

        # cashier.camtech.cam -> cashier app
        res_cashier = await client.get("/api/v1/apps/resolve?host=cashier.camtech.cam")
        assert res_cashier.status_code == 200
        data_cashier = res_cashier.json()["data"]
        assert data_cashier["appId"] == "cashier"
        assert data_cashier["resolvedRoute"] == "/sales/new"

        # support.camtech.cam -> support app
        res_support = await client.get("/api/v1/apps/resolve?host=support.camtech.cam")
        assert res_support.status_code == 200
        data_support = res_support.json()["data"]
        assert data_support["appId"] == "support"
        assert data_support["resolvedRoute"] == "/tickets"

        # Aliases: pos.localhost -> cashier, wms.localhost -> warehouse
        res_pos = await client.get("/api/v1/apps/resolve?host=pos.localhost")
        assert res_pos.status_code == 200
        assert res_pos.json()["data"]["appId"] == "cashier"

        res_wms = await client.get("/api/v1/apps/resolve?host=wms.localhost")
        assert res_wms.status_code == 200
        assert res_wms.json()["data"]["appId"] == "warehouse"

@pytest.mark.asyncio
async def test_application_access_control_spec_246():
    """
    Spec §246: Server-side Application Access Control Verification.
    Cashier attempting to open finance.camtech.cam must receive 403 Forbidden.
    """
    # 1. Test Cashier user
    cashier_user = TenantUser(user=MockUser(["CASHIER"]), roles=["CASHIER"])
    app.dependency_overrides[get_current_user] = lambda: cashier_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Cashier can access cashier app
        res_pos = await client.get("/api/v1/apps/check-access?appId=cashier")
        assert res_pos.status_code == 200
        assert res_pos.json()["data"]["allowed"] is True

        # Cashier CANNOT access finance app -> 403 FORBIDDEN
        res_fin = await client.get("/api/v1/apps/check-access?appId=finance")
        assert res_fin.status_code == 403
        assert res_fin.json()["success"] is False
        assert "Access denied" in res_fin.json()["message"]

        # Cashier CANNOT access HR app -> 403 FORBIDDEN
        res_hr = await client.get("/api/v1/apps/check-access?appId=hr")
        assert res_hr.status_code == 403

        # Cashier CAN access public store app
        res_store = await client.get("/api/v1/apps/check-access?appId=store")
        assert res_store.status_code == 200

        # Check my-apps returns authorized apps
        res_my = await client.get("/api/v1/apps/my-apps")
        assert res_my.status_code == 200
        my_app_ids = [a["id"] for a in res_my.json()["data"]["authorizedApps"]]
        assert "cashier" in my_app_ids
        assert "store" in my_app_ids
        assert "finance" not in my_app_ids
        assert "hr" not in my_app_ids

    # 2. Test Super Admin user (has access to all)
    admin_user = TenantUser(user=MockUser(["SUPER_ADMIN"]), roles=["SUPER_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: admin_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_admin_fin = await client.get("/api/v1/apps/check-access?appId=finance")
        assert res_admin_fin.status_code == 200
        assert res_admin_fin.json()["data"]["allowed"] is True

    app.dependency_overrides.pop(get_current_user, None)
