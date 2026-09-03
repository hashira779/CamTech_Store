import httpx
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.background import BackgroundTask
from app.core.config import settings

# Import local fallback routers so Gateway always works even if individual microservice processes aren't spun up yet
from app.main import app as fallback_app

gateway = FastAPI(
    title="MyStore Universal Enterprise API Gateway (Port 4000)",
    description="2026–2030 Cloud-Native API Gateway routing traffic to microservices on ports 4001-4006 with fault-tolerant local fallback.",
    version="2.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# CORS configuration allowing all frontend web applications (5001-5008)
gateway.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://([a-zA-Z0-9-]+\.)*(localhost|127\.0\.0\.1|camtech\.cam)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os

# Routing Table: URL Prefix -> Target Microservice Port (Environment-aware for Docker)
ROUTING_MAP = {
    "/api/v1/auth": os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:4001"),
    "/api/v1/organizations": os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:4001"),
    "/api/v1/locations": os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:4001"),
    "/api/v1/products": os.getenv("CATALOG_SERVICE_URL", "http://127.0.0.1:4002"),
    "/api/v1/categories": os.getenv("CATALOG_SERVICE_URL", "http://127.0.0.1:4002"),
    "/api/v1/brands": os.getenv("CATALOG_SERVICE_URL", "http://127.0.0.1:4002"),
    "/api/v1/inventory": os.getenv("CATALOG_SERVICE_URL", "http://127.0.0.1:4002"),
    "/api/v1/warehouse": os.getenv("CATALOG_SERVICE_URL", "http://127.0.0.1:4002"),
    "/api/v1/sales": os.getenv("SALES_SERVICE_URL", "http://127.0.0.1:4003"),
    "/api/v1/customers": os.getenv("SALES_SERVICE_URL", "http://127.0.0.1:4003"),
    "/api/v1/delivery": os.getenv("DELIVERY_SERVICE_URL", "http://127.0.0.1:4004"),
    "/api/v1/hr": os.getenv("HR_SERVICE_URL", "http://127.0.0.1:4005"),
    "/api/v1/finance": os.getenv("FINANCE_SERVICE_URL", "http://127.0.0.1:4006"),
}

http_client = httpx.AsyncClient(timeout=15.0)

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

    # 2. If matching microservice found, attempt proxying
    if target_base:
        target_url = f"{target_base}{request.url.path}"
        if request.url.query:
            target_url += f"?{request.url.query}"
            
        try:
            body = await request.body()
            headers = dict(request.headers)
            headers.pop("host", None)
            
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

    # 3. Resilient In-Process Fallback: Execute via canonical local router
    # This guarantees the gateway is 100% operational regardless of how services are started
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
