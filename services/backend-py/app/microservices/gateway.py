import asyncio
import time
import httpx
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse, HTMLResponse, StreamingResponse
from starlette.background import BackgroundTask
from starlette.middleware.gzip import GZipMiddleware
from app.core.http_edge import add_cors, client_ip
from app.microservices.registry import API_PREFIX, PLATFORM, SERVICES, resolve_service
from app.microservices.gateway_dashboard import get_gateway_dashboard_html
from app.core.static_assets import mount_static

# The in-process fallback (the full monolith) is imported LAZILY and guarded, so a
# syntax/import error in ANY single module can never stop the gateway from booting.
# Without this, `from app.main import app` at startup couples the gateway's health to
# every module compiling — one broken file would take :4000 (the whole API) down.
_fallback_app = None


def get_fallback_app():
    global _fallback_app
    if _fallback_app is None:
        try:
            from app.main import app as fb
            _fallback_app = fb
        except Exception as exc:  # a broken module must not crash the gateway
            print(f"[gateway] in-process fallback unavailable (a module failed to import): {exc}")
    return _fallback_app

from typing import Optional
from contextlib import asynccontextmanager
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.responses import JSONResponse
from app.core.docs_protection import is_admin_request, get_docs_lock_html, get_request_token


@asynccontextmanager
async def gateway_lifespan(app: FastAPI):
    try:
        from app.modules.observability.eventbus import event_bus
        await event_bus.start()
    except Exception as exc:
        print(f"[gateway] Event bus relay skipped: {exc}")
    yield
    try:
        from app.modules.observability.eventbus import event_bus
        await event_bus.stop()
    except Exception:
        pass


gateway = FastAPI(
    title="MyStore Universal Enterprise API Gateway (Port 4000)",
    description="2026–2030 Cloud-Native API Gateway routing traffic to microservices on ports 4001-4009 with fault-tolerant local fallback.",
    version="2.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=gateway_lifespan,
)

@gateway.get("/docs", include_in_schema=False)
async def custom_swagger_ui(request: Request, token: Optional[str] = None):
    if not is_admin_request(request, token):
        return HTMLResponse(content=get_docs_lock_html("/docs"), status_code=401)
    active_token = get_request_token(request, token)
    schema_url = f"/openapi.json?token={active_token}" if active_token else "/openapi.json"
    return get_swagger_ui_html(
        openapi_url=schema_url,
        title=f"{gateway.title} - Swagger UI",
        oauth2_redirect_url=gateway.swagger_ui_oauth2_redirect_url,
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
    )

@gateway.get("/redoc", include_in_schema=False)
async def custom_redoc(request: Request, token: Optional[str] = None):
    if not is_admin_request(request, token):
        return HTMLResponse(content=get_docs_lock_html("/redoc"), status_code=401)
    active_token = get_request_token(request, token)
    schema_url = f"/openapi.json?token={active_token}" if active_token else "/openapi.json"
    return get_redoc_html(
        openapi_url=schema_url,
        title=f"{gateway.title} - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js",
    )

@gateway.get("/openapi.json", include_in_schema=False)
async def custom_openapi_endpoint(request: Request, token: Optional[str] = None):
    if not is_admin_request(request, token):
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "code": "UNAUTHORIZED",
                "message": "Admin authorization required to access OpenAPI specifications."
            }
        )
    return JSONResponse(gateway.openapi())

add_cors(gateway)

# Response GZip compression for payloads >= 1KB (reduces bandwidth by 75-85%)
gateway.add_middleware(GZipMiddleware, minimum_size=1000)

# Never replayed in-process after the request may have reached the service.
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
# These fail before a single byte reaches the service, so a retry cannot double-apply.
NOT_DELIVERED_ERRORS = (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout)
HOP_BY_HOP_HEADERS = frozenset({b"transfer-encoding", b"content-length", b"connection", b"keep-alive"})
HEALTH_PROBE_TIMEOUT_SECONDS = 1.5

# High-Concurrency Enterprise HTTP Connection Pool (sustains 3,000+ simultaneous requests)
http_client = httpx.AsyncClient(
    timeout=httpx.Timeout(20.0, connect=5.0, read=30.0, pool=10.0),
    limits=httpx.Limits(max_keepalive_connections=500, max_connections=3000, keepalive_expiry=120.0),
)

# Persistent streaming client for SSE & telemetry streaming
# connect timeout = 5s prevents attackers from holding connection slots open
# read timeout = None is intentional — real SSE streams are long-lived
sse_client = httpx.AsyncClient(
    timeout=httpx.Timeout(None, connect=5.0),
    limits=httpx.Limits(max_keepalive_connections=200, max_connections=1500, keepalive_expiry=300.0),
)


def custom_openapi():
    if gateway.openapi_schema:
        return gateway.openapi_schema
    fb = get_fallback_app()
    if fb:
        schema = dict(fb.openapi())
        schema["info"] = {
            "title": "MyStore Universal Enterprise API Gateway (Port 4000)",
            "description": "2026–2030 Cloud-Native API Gateway routing traffic to 9 microservices with resilient fallback.",
            "version": "2.0.0",
        }
        gateway.openapi_schema = schema
        return gateway.openapi_schema
    return super(FastAPI, gateway).openapi()

gateway.openapi = custom_openapi

# Serves the dashboard's compiled Tailwind CSS from 'self'. Registered here, and
# not further down, because the /{path:path} proxy below matches everything and
# Starlette resolves routes in registration order.
mount_static(gateway)


@gateway.get("/", response_class=HTMLResponse, include_in_schema=False)
async def gateway_root():
    return HTMLResponse(content=get_gateway_dashboard_html(), status_code=200)

@gateway.get("/favicon.ico", include_in_schema=False)
async def gateway_favicon():
    return Response(status_code=204)

async def _probe_service(service) -> str:
    try:
        response = await http_client.get(f"{service.url}/health", timeout=HEALTH_PROBE_TIMEOUT_SECONDS)
    except httpx.HTTPError:
        return "unreachable"
    return "healthy" if response.status_code == 200 else "unhealthy"


@gateway.get("/health")
async def gateway_health():
    # Always 200: this is the gateway's own liveness, and restarting it would not
    # fix a downstream outage. Monitors read `status` for the fleet's state.
    states = await asyncio.gather(*(_probe_service(service) for service in SERVICES))
    return {
        "status": "healthy" if all(state == "healthy" for state in states) else "degraded",
        "service": "api-gateway",
        "port": 4000,
        "microservices": {service.key: state for service, state in zip(SERVICES, states)},
        "mode": "Dynamic Reverse Proxy with In-Process Resilient Fallback",
    }


def _proxied_response(content: bytes, status_code: int, raw_headers, body_decoded: bool = False) -> Response:
    # httpx decompresses upstream bodies, which makes their content-encoding false;
    # the in-process fallback hands over bytes still compressed by its own gzip layer.
    # Raw headers, because a dict would keep only one of several Set-Cookie values.
    dropped = HOP_BY_HOP_HEADERS | {b"content-encoding"} if body_decoded else HOP_BY_HOP_HEADERS
    response = Response(content=content, status_code=status_code)
    response.raw_headers = [
        (name, value) for name, value in raw_headers if name.lower() not in dropped
    ] + [(b"content-length", str(len(content)).encode("latin-1"))]
    return response


def _gateway_error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "code": code, "message": message},
    )


def _record_gateway_traffic(request: Request, full_path: str, status_code: int, start_time: float, target_name: str):
    if not full_path.startswith("/api/v1") or "/events/stream" in full_path:
        return
    duration_ms = (time.time() - start_time) * 1000.0
    try:
        from app.modules.infra.service import LiveTrafficMonitor
        LiveTrafficMonitor.record(
            method=request.method,
            path=full_path,
            status_code=status_code,
            duration_ms=duration_ms,
            client_ip=client_ip(request, default="127.0.0.1"),
            target_service=target_name,
            request_id=request.headers.get("x-request-id"),
            trace_id=request.headers.get("x-trace-id"),
        )
    except Exception:
        pass


@gateway.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def route_gateway(request: Request, path: str):
    start_time = time.time()
    full_path = f"/{path}"
    
    # 1. Every /api/v1 route belongs to a microservice, so traffic always lands on
    # one — the in-process fallback below is a safety net, never the primary path.
    target_base = None
    target_service_name = PLATFORM.key
    if full_path == API_PREFIX or full_path.startswith(f"{API_PREFIX}/"):
        service = resolve_service(full_path)
        target_base = service.url
        target_service_name = service.key

    is_sse = "text/event-stream" in request.headers.get("accept", "") or "/events/stream" in full_path
    body = await request.body()

    # 2. If matching microservice found, attempt proxying
    if target_base:
        target_url = f"{target_base}{request.url.path}"
        if request.url.query:
            target_url += f"?{request.url.query}"
            
        try:
            headers = dict(request.headers)
            headers.pop("host", None)
            
            if is_sse:
                req = sse_client.build_request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    content=body
                )
                r = await sse_client.send(req, stream=True)
                return StreamingResponse(
                    r.aiter_raw(),
                    status_code=r.status_code,
                    headers=dict(r.headers),
                    background=BackgroundTask(r.aclose)
                )

            proxy_resp = await http_client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body
            )
            
            _record_gateway_traffic(request, full_path, proxy_resp.status_code, start_time, target_service_name)

            return _proxied_response(proxy_resp.content, proxy_resp.status_code, proxy_resp.headers.raw, body_decoded=True)
        except Exception as proxy_err:
            print(f"[gateway] Microservice request to {target_url} failed ({proxy_err})")
            if request.method not in SAFE_METHODS and not isinstance(proxy_err, NOT_DELIVERED_ERRORS):
                # The service may have committed this write before the connection
                # failed. Replaying it could duplicate a sale, so report the unknown.
                _record_gateway_traffic(request, full_path, 504, start_time, target_service_name)
                if isinstance(proxy_err, httpx.TimeoutException):
                    return _gateway_error(504, "UPSTREAM_TIMEOUT", "The service did not respond in time. Check the result before retrying.")
                return _gateway_error(502, "UPSTREAM_FAILED", "The service connection failed mid-request. Check the result before retrying.")

    # 3. Resilient In-Process Fallback: Execute via canonical local router.
    # Loaded lazily — if a module is broken the fallback is simply unavailable for
    # THAT route, while every healthy service (and the gateway itself) keeps serving.
    fallback_app = get_fallback_app()
    if fallback_app is None:
        return _gateway_error(503, "SERVICE_UNAVAILABLE", "This route's service is unavailable and the in-process fallback could not load.")

    if is_sse:
        transport = httpx.ASGITransport(app=fallback_app)
        fb_sse_client = httpx.AsyncClient(transport=transport, base_url="http://in-process", timeout=None)
        fb_req = fb_sse_client.build_request(
            method=request.method,
            url=request.url.path + (f"?{request.url.query}" if request.url.query else ""),
            headers=dict(request.headers),
            content=body
        )
        r = await fb_sse_client.send(fb_req, stream=True)
        return StreamingResponse(
            r.aiter_raw(),
            status_code=r.status_code,
            headers=dict(r.headers),
            background=BackgroundTask(r.aclose)
        )

    scope = request.scope
    body_replayed = False

    async def receive():
        # The body was already consumed above; without replaying it the fallback
        # app would wait forever for a request body that never arrives.
        nonlocal body_replayed
        if not body_replayed:
            body_replayed = True
            return {"type": "http.request", "body": body, "more_body": False}
        return await request.receive()

    response_body = []
    response_status = 200
    response_headers = []

    async def send(message):
        nonlocal response_status, response_headers, response_body
        if message["type"] == "http.response.start":
            response_status = message["status"]
            response_headers = message.get("headers", [])
        elif message["type"] == "http.response.body":
            response_body.append(message.get("body", b""))

    await fallback_app(scope, receive, send)
    
    _record_gateway_traffic(request, full_path, response_status, start_time, "in-process-fallback")
    return _proxied_response(b"".join(response_body), response_status, response_headers)

if __name__ == "__main__":
    print("🚀 Starting API Gateway on http://localhost:4000...")
    uvicorn.run(gateway, host="0.0.0.0", port=4000)
