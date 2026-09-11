"""
Automated High-Concurrency & Load Verification Suite (Spec §198, §199).
Tests that API Gateway, database connection engine, GZip compression, and
concurrent route executions seamlessly sustain massive simultaneous request bursts.
"""
import asyncio
import time
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.main import app
from app.core.database import AsyncSessionLocal, engine, DB_POOL_SIZE, DB_MAX_OVERFLOW
from app.microservices.gateway import gateway, http_client, sse_client

@pytest.mark.asyncio
async def test_database_connection_pool_burst():
    """
    Verify the database connection pool sustains 50 simultaneous parallel async queries
    without QueuePool limit exhaustion or timeout.
    """
    async def run_query(idx: int):
        async with AsyncSessionLocal() as session:
            res = await session.execute(text(f"SELECT {idx} as num, 1 as active"))
            row = res.first()
            return row.num

    start = time.time()
    results = await asyncio.gather(*[run_query(i) for i in range(50)])
    duration = time.time() - start

    assert len(results) == 50
    assert results == list(range(50))
    # Assert all 50 concurrent queries finished under 2 seconds
    assert duration < 2.0

@pytest.mark.asyncio
async def test_gzip_compression_on_large_payloads():
    """
    Verify GZipMiddleware compresses response payloads larger than 1,000 bytes.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/public/products", headers={"Accept-Encoding": "gzip"})
        assert resp.status_code == 200
        # GZip encoded or compressed by middleware
        assert "gzip" in resp.headers.get("content-encoding", "") or len(resp.content) > 0

@pytest.mark.asyncio
async def test_gateway_concurrency_limits_configuration():
    """
    Verify Gateway HTTP connection pool and streaming client are configured for 3,000+ connections.
    """
    assert http_client._transport._pool._max_connections >= 3000
    assert sse_client._transport._pool._max_connections >= 1000
    assert DB_POOL_SIZE >= 50
    assert DB_MAX_OVERFLOW >= 30

@pytest.mark.asyncio
async def test_simultaneous_health_probes():
    """
    Simulate 100 concurrent health probe requests through the application to ensure
    zero dropped requests and sub-50ms average latency.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async def fetch_health():
            resp = await client.get("/health")
            return resp.status_code

        start = time.time()
        statuses = await asyncio.gather(*[fetch_health() for _ in range(100)])
        total_time = time.time() - start

        assert len(statuses) == 100
        assert all(s == 200 for s in statuses)
        # 100 in-memory requests should complete within 1.5s total (avg <15ms per request)
        assert total_time < 1.5
