import asyncio

import httpx
import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

from app.microservices import gateway as gateway_module
from app.microservices.gateway import gateway


def _mock_upstream(monkeypatch, handler):
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(gateway_module, "http_client", client)


def _gateway_client():
    return AsyncClient(transport=ASGITransport(app=gateway), base_url="http://test")


def _echo_fallback(monkeypatch):
    fallback = FastAPI()
    calls = []

    @fallback.post("/api/v1/sales")
    async def echo(request: Request):
        body = await request.body()
        calls.append(body)
        return {"received": body.decode()}

    monkeypatch.setattr(gateway_module, "get_fallback_app", lambda: fallback)
    return calls


@pytest.mark.asyncio
async def test_prefix_match_respects_path_boundaries(monkeypatch):
    seen = []

    def handler(request):
        seen.append(request.url.port)
        return httpx.Response(200, json={"ok": True})

    _mock_upstream(monkeypatch, handler)
    async with _gateway_client() as client:
        await client.get("/api/v1/auth/me")
        await client.get("/api/v1/authorize")

    assert seen == [4001, 4007]


@pytest.mark.asyncio
async def test_unsafe_request_is_not_replayed_after_upstream_timeout(monkeypatch):
    # The service may already have committed the sale when the read timed out, so
    # running it again in-process could charge the customer twice.
    def handler(request):
        raise httpx.ReadTimeout("slow upstream", request=request)

    _mock_upstream(monkeypatch, handler)
    calls = _echo_fallback(monkeypatch)

    async with _gateway_client() as client:
        response = await asyncio.wait_for(client.post("/api/v1/sales", content=b"{}"), timeout=5)

    assert response.status_code == 504
    assert response.json()["code"] == "UPSTREAM_TIMEOUT"
    assert calls == []


@pytest.mark.asyncio
async def test_fallback_receives_the_body_when_service_is_unreachable(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("service down", request=request)

    _mock_upstream(monkeypatch, handler)
    calls = _echo_fallback(monkeypatch)

    async with _gateway_client() as client:
        response = await asyncio.wait_for(
            client.post("/api/v1/sales", content=b'{"total":1}'), timeout=5
        )

    assert response.status_code == 200
    assert calls == [b'{"total":1}']


@pytest.mark.asyncio
async def test_fallback_keeps_gzip_encoding_of_its_compressed_body(monkeypatch):
    from starlette.middleware.gzip import GZipMiddleware

    def handler(request):
        raise httpx.ConnectError("service down", request=request)

    fallback = FastAPI()
    fallback.add_middleware(GZipMiddleware, minimum_size=10)

    @fallback.get("/api/v1/products")
    async def products():
        return {"items": ["x" * 50] * 20}

    _mock_upstream(monkeypatch, handler)
    monkeypatch.setattr(gateway_module, "get_fallback_app", lambda: fallback)

    async with _gateway_client() as client:
        response = await client.get("/api/v1/products", headers={"accept-encoding": "gzip"})

    assert response.headers["content-encoding"] == "gzip"
    assert len(response.json()["items"]) == 20


@pytest.mark.asyncio
async def test_multiple_set_cookie_headers_survive_the_proxy(monkeypatch):
    def handler(request):
        return httpx.Response(
            200,
            headers=[("set-cookie", "a=1; Path=/"), ("set-cookie", "b=2; Path=/")],
            json={"ok": True},
        )

    _mock_upstream(monkeypatch, handler)
    async with _gateway_client() as client:
        response = await client.get("/api/v1/auth/me")

    assert response.headers.get_list("set-cookie") == ["a=1; Path=/", "b=2; Path=/"]


@pytest.mark.asyncio
async def test_health_reports_measured_service_state(monkeypatch):
    def handler(request):
        if request.url.port == 4001:
            raise httpx.ConnectError("down", request=request)
        return httpx.Response(200, json={"status": "healthy"})

    _mock_upstream(monkeypatch, handler)
    async with _gateway_client() as client:
        response = await client.get("/health")

    payload = response.json()
    # A liveness probe must not restart the gateway because a downstream is down.
    assert response.status_code == 200
    assert payload["status"] == "degraded"
    assert payload["microservices"]["auth"] == "unreachable"
    assert payload["microservices"]["catalog"] == "healthy"
    assert "infra" in payload["microservices"]


def test_every_monolith_route_is_served_by_the_service_the_gateway_picks():
    from importlib import import_module

    from app.main import app as monolith
    from app.microservices.registry import SERVICES, resolve_service

    def api_routes(app):
        return {
            (method, route.path)
            for route in app.routes
            if hasattr(route, "methods") and route.path.startswith("/api/v1")
            for method in route.methods
        }

    served = {
        service.key: api_routes(import_module(service.module).app) for service in SERVICES
    }
    missing = [
        (method, path, resolve_service(path).key)
        for method, path in api_routes(monolith)
        if (method, path) not in served[resolve_service(path).key]
    ]

    assert sorted(missing) == []


def test_registry_matches_the_declared_service_ports():
    from importlib import import_module

    from app.microservices.registry import SERVICES

    ports = [service.port for service in SERVICES]
    assert len(ports) == len(set(ports))
    for service in SERVICES:
        assert f"Port {service.port}" in import_module(service.module).app.title
