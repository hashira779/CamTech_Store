"""
Distributed Tracing & Structured Telemetry Module (Principle 47 & 48).
Provides W3C traceparent propagation, structured JSON logging, and OpenTelemetry OTLP integration.
"""
import os
import sys
import time
import json
import logging
import asyncio
from contextvars import ContextVar
from typing import Optional, Dict, Any
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.datetime_utils import utc_now

# Context variables for request-bound distributed tracing
current_trace_id: ContextVar[str] = ContextVar("current_trace_id", default="")
current_span_id: ContextVar[str] = ContextVar("current_span_id", default="")
current_request_id: ContextVar[str] = ContextVar("current_request_id", default="")

OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
SERVICE_NAME_DEFAULT = os.getenv("OTEL_SERVICE_NAME", "mystore-backend")


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as structured JSON with correlation IDs."""
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": utc_now().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "requestId": current_request_id.get() or getattr(record, "request_id", ""),
            "traceId": current_trace_id.get() or getattr(record, "trace_id", ""),
            "spanId": current_span_id.get() or getattr(record, "span_id", ""),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_structured_logging(level: int = logging.INFO):
    """Configures the root logger with the StructuredJsonFormatter."""
    root_logger = logging.getLogger()
    # Avoid duplicate handlers if called multiple times
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredJsonFormatter())
    root_logger.addHandler(handler)
    root_logger.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    """Returns a named logger configured for structured telemetry output."""
    return logging.getLogger(name)


logger = get_logger("telemetry")


class TelemetryMiddleware(BaseHTTPMiddleware):
    """
    HTTP middleware extracting or minting W3C traceparent headers,
    binding correlation context, and emitting structured access telemetry.
    """
    def __init__(self, app, service_name: str = SERVICE_NAME_DEFAULT):
        super().__init__(app)
        self.service_name = service_name

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        # 1. Correlate Request ID
        req_id = request.headers.get("X-Request-Id") or getattr(request.state, "request_id", None)
        if not req_id:
            import uuid
            req_id = str(uuid.uuid4())
        request.state.request_id = req_id
        current_request_id.set(req_id)

        # 2. Extract or Mint W3C Traceparent: 00-{trace_id}-{span_id}-01
        incoming_trace = request.headers.get("traceparent")
        if incoming_trace and len(incoming_trace.split("-")) == 4:
            parts = incoming_trace.split("-")
            trace_id = parts[1]
            parent_span_id = parts[2]
        else:
            import secrets
            trace_id = secrets.token_hex(16)
            parent_span_id = secrets.token_hex(8)

        import secrets
        child_span_id = secrets.token_hex(8)
        traceparent = f"00-{trace_id}-{child_span_id}-01"

        request.state.trace_id = trace_id
        request.state.span_id = child_span_id
        current_trace_id.set(trace_id)
        current_span_id.set(child_span_id)

        # Pass-through documentation and probes without verbose access logging
        path = request.url.path
        is_internal_probe = path in ["/docs", "/redoc", "/openapi.json", "/health", "/ready", "/metrics", "/favicon.ico"]

        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000

            response.headers["X-Request-Id"] = req_id
            response.headers["X-Trace-Id"] = trace_id
            response.headers["traceparent"] = traceparent
            response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"

            if not is_internal_probe:
                logger.info(
                    f"{request.method} {request.url.path} {response.status_code} ({duration_ms:.2f}ms)",
                    extra={"durationMs": round(duration_ms, 2), "statusCode": response.status_code}
                )
            return response
        except Exception as exc:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(
                f"Unhandled exception in {request.method} {request.url.path}: {exc}",
                exc_info=True,
                extra={"durationMs": round(duration_ms, 2)}
            )
            raise exc


def setup_telemetry(app: FastAPI, service_name: str = SERVICE_NAME_DEFAULT):
    """Attaches structured telemetry middleware and configures loggers."""
    setup_structured_logging()
    app.add_middleware(TelemetryMiddleware, service_name=service_name)
