import pytest
from httpx import AsyncClient, ASGITransport
from app.microservices.common import create_microservice
from app.microservices.auth_service import app as auth_app
from app.microservices.catalog_service import app as catalog_app
from app.microservices.sales_service import app as sales_app
from app.microservices.delivery_service import app as delivery_app
from app.microservices.hr_service import app as hr_app
from app.microservices.finance_service import app as finance_app
from app.microservices.gateway import gateway

@pytest.mark.asyncio
async def test_auth_microservice_health():
    async with AsyncClient(transport=ASGITransport(app=auth_app), base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["service"] == "Auth & Identity Microservice"
        assert data["port"] == 4001

@pytest.mark.asyncio
async def test_catalog_microservice_health():
    async with AsyncClient(transport=ASGITransport(app=catalog_app), base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["port"] == 4002

@pytest.mark.asyncio
async def test_sales_microservice_health():
    async with AsyncClient(transport=ASGITransport(app=sales_app), base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["port"] == 4003

@pytest.mark.asyncio
async def test_delivery_microservice_health():
    async with AsyncClient(transport=ASGITransport(app=delivery_app), base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["port"] == 4004

@pytest.mark.asyncio
async def test_hr_microservice_health():
    async with AsyncClient(transport=ASGITransport(app=hr_app), base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["port"] == 4005

@pytest.mark.asyncio
async def test_finance_microservice_health():
    async with AsyncClient(transport=ASGITransport(app=finance_app), base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["port"] == 4006

@pytest.mark.asyncio
async def test_api_gateway_health():
    async with AsyncClient(transport=ASGITransport(app=gateway), base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["service"] == "api-gateway"
        assert data["port"] == 4000
        assert "auth" in data["microservices"]
        assert "catalog" in data["microservices"]
