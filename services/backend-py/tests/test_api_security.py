import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import hash_password, verify_password, create_access_token

@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "mystore-backend-python"

@pytest.mark.asyncio
async def test_rejects_unauthenticated_access():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/products")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["code"] == "UNAUTHORIZED"
        assert "requestId" in data

@pytest.mark.asyncio
async def test_rejects_garbage_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": "Bearer not-a-real-token-12345"}
        response = await client.get("/api/v1/products", headers=headers)
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["code"] == "UNAUTHORIZED"
        assert "requestId" in data

def test_password_hashing():
    pw = "Secret123!"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

def test_jwt_token_generation():
    token = create_access_token({"sub": "user_123", "orgId": "org_456"})
    assert isinstance(token, str)
    assert len(token) > 20

@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", [
    "/api/v1/taxes",
    "/api/v1/pricing",
    "/api/v1/promotions",
    "/api/v1/finance/accounts",
    "/api/v1/hr/employees",
    "/api/v1/reports/dashboard",
    "/api/v1/approvals",
    "/api/v1/assets",
    "/api/v1/tickets",
    "/api/v1/developers/apps",
    "/api/v1/telegram/bindings",
    "/api/v1/wms/transfers"
])
async def test_enterprise_endpoints_require_auth(endpoint):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(endpoint)
        assert resp.status_code == 401

