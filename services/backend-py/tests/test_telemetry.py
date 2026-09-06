import json
import logging
import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport

from app.core.telemetry import (
    StructuredJsonFormatter,
    TelemetryMiddleware,
    current_trace_id,
    current_span_id,
    current_request_id,
    get_logger,
)


def test_structured_json_formatter():
    formatter = StructuredJsonFormatter()
    current_trace_id.set("trace-1234567890abcdef")
    current_span_id.set("span-12345678")
    current_request_id.set("req-uuid-test-999")

    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=20,
        msg="Test structured log output",
        args=(),
        exc_info=None,
    )
    formatted = formatter.format(record)
    parsed = json.loads(formatted)

    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "test_logger"
    assert parsed["message"] == "Test structured log output"
    assert parsed["traceId"] == "trace-1234567890abcdef"
    assert parsed["spanId"] == "span-12345678"
    assert parsed["requestId"] == "req-uuid-test-999"
    assert "timestamp" in parsed
    assert parsed["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_telemetry_middleware_traceparent_propagation():
    test_app = FastAPI()
    test_app.add_middleware(TelemetryMiddleware, service_name="test-service")

    @test_app.get("/test-endpoint")
    async def sample_route():
        return {
            "trace_id": current_trace_id.get(),
            "span_id": current_span_id.get(),
            "request_id": current_request_id.get(),
        }

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test 1: Inbound request without traceparent (should mint new traceparent)
        res = await client.get("/test-endpoint")
        assert res.status_code == 200
        assert "X-Request-Id" in res.headers
        assert "X-Trace-Id" in res.headers
        assert "traceparent" in res.headers
        assert "X-Process-Time-Ms" in res.headers

        data = res.json()
        assert len(data["trace_id"]) == 32  # 128-bit hex
        assert len(data["span_id"]) == 16   # 64-bit hex
        assert data["request_id"] == res.headers["X-Request-Id"]

        # Test 2: Inbound request with existing W3C traceparent
        custom_trace = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
        res2 = await client.get("/test-endpoint", headers={"traceparent": custom_trace})
        assert res2.status_code == 200
        assert res2.headers["X-Trace-Id"] == "4bf92f3577b34da6a3ce929d0e0e4736"
        data2 = res2.json()
        assert data2["trace_id"] == "4bf92f3577b34da6a3ce929d0e0e4736"
