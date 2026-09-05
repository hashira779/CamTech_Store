import httpx
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse, HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.background import BackgroundTask
from app.core.config import settings
from app.microservices.gateway_dashboard import get_gateway_dashboard_html

# The in-process fallback (the full monolith) is imported LAZILY and guarded, so a
# syntax/import error in ANY single module can never stop the gateway from booting.
# Without this, `from app.main import app` at startup couples the gateway's health to
# every module compiling — one broken file would take :4000 (the whole API) down.
_fallback_app = None
_fallback_import_failed = False


def get_fallback_app():
    global _fallback_app, _fallback_import_failed
    if _fallback_app is None and not _fallback_import_failed:
        try:
            from app.main import app as fb
            _fallback_app = fb
        except Exception as exc:  # a broken module must not crash the gateway
            _fallback_import_failed = True
            print(f"[gateway] in-process fallback unavailable (a module failed to import): {exc}")
    return _fallback_app

gateway = FastAPI(
    title="MyStore Universal Enterprise API Gateway (Port 4000)",
    description="2026–2030 Cloud-Native API Gateway routing traffic to microservices on ports 4001-4007 with fault-tolerant local fallback.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS configuration allowing all frontend web applications (5001-5008)
gateway.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://([a-zA-Z0-9-]+\.)*(localhost|127\.0\.0\.1|camtech\.cam|camtech\.local|10\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os

# Routing Table: URL Prefix -> Target Microservice Port (Environment-aware for Docker)
CATALOG = os.getenv("CATALOG_SERVICE_URL", "http://127.0.0.1:4002")
AUTH = os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:4001")
SALES = os.getenv("SALES_SERVICE_URL", "http://127.0.0.1:4003")
# Platform & Experience service owns every domain not carved into a core service.
PLATFORM_SERVICE_URL = os.getenv("PLATFORM_SERVICE_URL", "http://127.0.0.1:4007")

ROUTING_MAP = {
    "/api/v1/auth": AUTH,
    "/api/v1/organizations": AUTH,
    "/api/v1/locations": AUTH,
    "/api/v1/products": CATALOG,
    "/api/v1/public": CATALOG,
    "/api/v1/categories": CATALOG,
    "/api/v1/brands": CATALOG,
    "/api/v1/inventory": CATALOG,
    "/api/v1/warehouse": CATALOG,
    "/api/v1/pricing": CATALOG,
    "/api/v1/taxes": CATALOG,
    "/api/v1/promotions": CATALOG,
    "/api/v1/wms": CATALOG,
    "/api/v1/sales": SALES,
    "/api/v1/customers": SALES,
    "/api/v1/loyalty": CATALOG,
    "/api/v1/delivery": os.getenv("DELIVERY_SERVICE_URL", "http://127.0.0.1:4004"),
    "/api/v1/hr": os.getenv("HR_SERVICE_URL", "http://127.0.0.1:4005"),
    "/api/v1/finance": os.getenv("FINANCE_SERVICE_URL", "http://127.0.0.1:4006"),
    "/api/v1/accounts": os.getenv("FINANCE_SERVICE_URL", "http://127.0.0.1:4006"),
    "/api/v1/assets": os.getenv("FINANCE_SERVICE_URL", "http://127.0.0.1:4006"),
    "/api/v1/developers": PLATFORM_SERVICE_URL,
    "/api/v1/flows": PLATFORM_SERVICE_URL,
    "/api/v1/telegram": PLATFORM_SERVICE_URL,
}

http_client = httpx.AsyncClient(timeout=15.0)

def custom_openapi():
    if gateway.openapi_schema:
        return gateway.openapi_schema
    fb = get_fallback_app()
    if fb:
        schema = dict(fb.openapi())
        schema["info"] = {
            "title": "MyStore Universal Enterprise API Gateway (Port 4000)",
            "description": "2026–2030 Cloud-Native API Gateway routing traffic to 7 microservices with resilient fallback.",
            "version": "2.0.0",
        }
        gateway.openapi_schema = schema
        return gateway.openapi_schema
    return super(FastAPI, gateway).openapi()

gateway.openapi = custom_openapi

@gateway.get("/", response_class=HTMLResponse, include_in_schema=False)
async def gateway_root():
    return HTMLResponse(content=get_gateway_dashboard_html(), status_code=200)

@gateway.get("/favicon.ico", include_in_schema=False)
async def gateway_favicon():
    return Response(status_code=204)

@gateway.get("/health")
async def gateway_health():
    return {
        "status": "healthy",
        "service": "api-gateway",
        "port": 4000,
        "standard": "2026-2030 Enterprise Microservice Gateway",
        "microservices": {
            "auth": "http://localhost:4001",
            "catalog": "http://localhost:4002",
            "sales": "http://localhost:4003",
            "delivery": "http://localhost:4004",
            "hr": "http://localhost:4005",
            "finance": "http://localhost:4006",
            "platform": "http://localhost:4007",
        },
        "mode": "Dynamic Reverse Proxy with In-Process Resilient Fallback"
    }

@gateway.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def route_gateway(request: Request, path: str):
    full_path = f"/{path}"
    
    # 1. Determine destination microservice
    target_base = None
    for prefix, target_url in ROUTING_MAP.items():
        if full_path.startswith(prefix):
            target_base = target_url
            break

    # Every other /api/v1 route is owned by the Platform & Experience service, so
    # traffic always lands on a microservice — the in-process fallback below is a
    # safety net, never the primary path.
    if target_base is None and full_path.startswith("/api/v1"):
        target_base = PLATFORM_SERVICE_URL

    is_sse = "text/event-stream" in request.headers.get("accept", "") or "/events/stream" in full_path

    # 2. If matching microservice found, attempt proxying
    if target_base:
        target_url = f"{target_base}{request.url.path}"
        if request.url.query:
            target_url += f"?{request.url.query}"
            
        try:
            body = await request.body()
            headers = dict(request.headers)
            headers.pop("host", None)
            
            if is_sse:
                sse_client = httpx.AsyncClient(timeout=None)
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
            
            return Response(
                content=proxy_resp.content,
                status_code=proxy_resp.status_code,
                headers=dict(proxy_resp.headers),
                media_type=proxy_resp.headers.get("content-type")
            )
        except Exception:
            # If target microservice is offline, gracefully fall through to in-process fallback
            pass

    # 3. Resilient In-Process Fallback: Execute via canonical local router.
    # Loaded lazily — if a module is broken the fallback is simply unavailable for
    # THAT route, while every healthy service (and the gateway itself) keeps serving.
    fallback_app = get_fallback_app()
    if fallback_app is None:
        import json as _json
        return Response(
            content=_json.dumps({
                "success": False,
                "code": "SERVICE_UNAVAILABLE",
                "message": "This route's service is unavailable and the in-process fallback could not load.",
            }).encode("utf-8"),
            status_code=503,
            media_type="application/json",
        )

    if is_sse:
        transport = httpx.ASGITransport(app=fallback_app)
        fb_sse_client = httpx.AsyncClient(transport=transport, base_url="http://in-process", timeout=None)
        fb_req = fb_sse_client.build_request(
            method=request.method,
            url=request.url.path + (f"?{request.url.query}" if request.url.query else ""),
            headers=dict(request.headers),
            content=await request.body()
        )
        r = await fb_sse_client.send(fb_req, stream=True)
        return StreamingResponse(
            r.aiter_raw(),
            status_code=r.status_code,
            headers=dict(r.headers),
            background=BackgroundTask(r.aclose)
        )

    scope = request.scope
    receive = request.receive

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
    
    headers_dict = {k.decode("latin1"): v.decode("latin1") for k, v in response_headers}
    return Response(
        content=b"".join(response_body),
        status_code=response_status,
        headers=headers_dict
    )

if __name__ == "__main__":
    print("🚀 Starting API Gateway on http://localhost:4000...")
    uvicorn.run(gateway, host="0.0.0.0", port=4000)
