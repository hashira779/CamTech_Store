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
    "/api/v1/locations",
    "/api/v1/locations/tree",
    "/api/v1/organizations/current",
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
    "/api/v1/developers/keys",
    "/api/v1/developers/webhooks",
    "/api/v1/telegram/bindings",
    "/api/v1/wms/transfers",
    "/api/v1/workflows/instances",
])
async def test_enterprise_endpoints_require_auth(endpoint):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(endpoint)
        assert resp.status_code == 401
        data = resp.json()
        assert data["success"] is False
        assert data["code"] == "UNAUTHORIZED"

@pytest.mark.asyncio
async def test_auth_rate_limiter():
    from app.core.rate_limiter import auth_rate_limiter
    await auth_rate_limiter.reset()
    try:
        # Use an isolated client IP to ensure no crosstalk with other tests or localhost
        headers = {"X-Real-IP": "198.51.100.246"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=headers) as client:
            # Fire 15 requests (allowed limit)
            for _ in range(15):
                res = await client.post("/api/v1/auth/login", json={"email": "nonexistent@test.com", "password": "wrong"})
                # Should be 401 (invalid credentials) rather than 429
                assert res.status_code == 401

            # 16th request should hit 429 Too Many Requests
            res = await client.post("/api/v1/auth/login", json={"email": "nonexistent@test.com", "password": "wrong"})
            assert res.status_code == 429
            data = res.json()
            assert data["success"] is False
            assert "Too many requests" in (data.get("message") or data.get("detail", ""))
            assert "retry-after" in res.headers
    finally:
        # Always clean up rate limiter state across both memory and Redis
        await auth_rate_limiter.reset()

