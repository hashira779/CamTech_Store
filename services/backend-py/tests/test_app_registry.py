import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_get_app_registry():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/apps/registry")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["total"] == 10
        app_ids = [a["id"] for a in data["applications"]]
        assert "store" in app_ids
        assert "cashier" in app_ids
        assert "delivery" in app_ids
        assert "hr" in app_ids
        assert "finance" in app_ids
        assert "warehouse" in app_ids
        assert "ceo" in app_ids
        assert "customer" in app_ids

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
