import time
import json
import uuid
import secrets

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings

# Import the full entity graph so EVERY microservice registers all SQLAlchemy
# models — a service that mounts only a few routers would otherwise have an
# incomplete mapper registry and 500 with `KeyError: 'Organization'` on the first
# query that touches a cross-module relationship (FKs to organizations, users, …).
import app.models.entities  # noqa: F401
from sqlalchemy.orm import configure_mappers as _configure_mappers

# Paths that must pass through untouched (docs, health/ops probes).
_RAW_PATHS = {"/docs", "/redoc", "/openapi.json", "/health", "/ready", "/metrics"}


def apply_enterprise_layer(app: FastAPI) -> None:
    """Give a microservice the SAME error envelope + response wrapping the monolith
    edge (app.main) applies, so responses proxied through the gateway are identical
    whether they are served by a microservice or by the in-process fallback.

    The frontend api-client requires the `{success, data, requestId}` envelope
    (`if (!body.success) throw; return body.data`) — without this, every call
    routed to a microservice would fail to parse.
    """

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        code = "UNAUTHORIZED" if exc.status_code == 401 else (
            "FORBIDDEN" if exc.status_code == 403 else (
                "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
            )
        )
        resp_headers = {"X-Request-Id": req_id}
        if exc.headers:
            resp_headers.update(exc.headers)
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "code": code, "message": str(exc.detail), "requestId": req_id},
            headers=resp_headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "code": "VALIDATION_ERROR", "message": str(exc.errors()), "requestId": req_id},
            headers={"X-Request-Id": req_id},
        )

    @app.middleware("http")
    async def response_envelope_middleware(request: Request, call_next):
        start_time = time.time()
        req_id = str(uuid.uuid4())
        request.state.request_id = req_id

        incoming = request.headers.get("traceparent")
        if incoming and len(incoming.split("-")) == 4:
            trace_id = incoming.split("-")[1]
        else:
            trace_id = secrets.token_hex(16)
        span_id = secrets.token_hex(8)
        traceparent = f"00-{trace_id}-{span_id}-01"
        request.state.trace_id = trace_id

        path = request.url.path
        if path in _RAW_PATHS:
            response = await call_next(request)
            response.headers["X-Request-Id"] = req_id
            response.headers["X-Trace-Id"] = trace_id
            response.headers["traceparent"] = traceparent
            return response

        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
        response.headers["X-Request-Id"] = req_id
        response.headers["X-Trace-Id"] = trace_id
        response.headers["traceparent"] = traceparent

        content_type = response.headers.get("content-type", "")
        if response.status_code < 400 and "application/json" in content_type:
            body = [chunk async for chunk in response.body_iterator]
            raw_body = b"".join(body)
            try:
                parsed = json.loads(raw_body.decode("utf-8"))
                if isinstance(parsed, dict) and "success" in parsed and "data" in parsed:
                    enveloped = parsed
                else:
                    enveloped = {"success": True, "data": parsed, "requestId": req_id}
                new_content = json.dumps(enveloped).encode("utf-8")
                headers = dict(response.headers)
                headers["content-length"] = str(len(new_content))
                return Response(content=new_content, status_code=response.status_code,
                                headers=headers, media_type="application/json")
            except Exception:
                return Response(content=raw_body, status_code=response.status_code, headers=dict(response.headers))

        return response


def create_microservice(name: str, description: str, port: int) -> FastAPI:
    """
    Factory function for independent MyStore microservices.
    Configures CORS, the enterprise response envelope, health probes, and OpenAPI docs.
    """
    app = FastAPI(
        title=f"MyStore {name} (Port {port})",
        description=description,
        version="2.0.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    # CORS configuration allowing all frontend web applications (5001-5008)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=r"https?://([a-zA-Z0-9-]+\.)*(localhost|127\.0\.0\.1|camtech\.cam|camtech\.local|10\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+)(:[0-9]+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Same error envelope + response wrapping as the monolith edge.
    apply_enterprise_layer(app)

    # Eagerly wire up all ORM relationships now that the full registry is loaded.
    _configure_mappers()

    @app.get("/health")
    async def health():
        return {
            "status": "healthy",
            "service": name,
            "port": port,
            "standard": "2026-2030 Microservice Standard",
            "dataCenter": "PostgreSQL 16 Enterprise (Connected)",
        }

    return app
