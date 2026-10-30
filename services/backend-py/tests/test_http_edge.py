import pytest
from fastapi import FastAPI, HTTPException, Response
from httpx import ASGITransport, AsyncClient

from app.main import app as monolith
from app.microservices.common import create_microservice


def _service_with_routes():
    service = create_microservice(name="Edge Test", description="", port=4999)

    @service.get("/api/v1/denied")
    async def denied():
        raise HTTPException(status_code=403, detail={"message": "Nope", "required": ["ORG_ADMIN"]})

    @service.get("/api/v1/cookies")
    async def cookies(response: Response):
        response.set_cookie("a", "1")
        response.set_cookie("b", "2")
        return {"ok": True}

    return service


def _client(app: FastAPI):
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_service_keeps_structured_error_details_like_the_monolith():
    async with _client(_service_with_routes()) as client:
        response = await client.get("/api/v1/denied")

    body = response.json()
    assert response.status_code == 403
    assert body["code"] == "FORBIDDEN"
    assert body["message"] == "Nope"
    assert body["details"]["required"] == ["ORG_ADMIN"]


@pytest.mark.asyncio
async def test_envelope_wrapping_keeps_every_set_cookie_header():
    async with _client(_service_with_routes()) as client:
        response = await client.get("/api/v1/cookies")

    assert response.json()["data"] == {"ok": True}
    assert len(response.headers.get_list("set-cookie")) == 2


@pytest.mark.asyncio
async def test_large_gzipped_response_is_still_enveloped():
    service = _service_with_routes()

    @service.get("/api/v1/big")
    async def big():
        return {"items": ["x" * 50] * 100}

    async with _client(service) as client:
        response = await client.get("/api/v1/big", headers={"accept-encoding": "gzip"})

    assert response.headers["content-encoding"] == "gzip"
    assert response.json()["success"] is True
    assert len(response.json()["data"]["items"]) == 100


@pytest.mark.asyncio
async def test_rate_limited_monolith_request_gets_an_enveloped_429(monkeypatch):
    from app.core import rate_limiter

    async def reject(request):
        raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": "7"})

    monkeypatch.setattr(rate_limiter.api_rate_limiter, "check", reject)
    async with _client(monolith) as client:
        response = await client.get("/api/v1/products")

    assert response.status_code == 429
    assert response.json()["success"] is False
    assert response.json()["code"] == "RATE_LIMITED"
    assert response.headers["Retry-After"] == "7"
