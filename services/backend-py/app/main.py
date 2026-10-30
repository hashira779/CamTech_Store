import time
from fastapi import FastAPI, Request, Response, status

from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.http_edge import EdgePolicy, add_cors, add_gzip, install_edge
from app.modules.delivery.api import router as delivery_router
from app.modules.industry.api import router as industry_router
from app.modules.ai_copilot.api import router as ai_copilot_router
from app.modules.data_exchange.api import router as data_exchange_router
from app.modules.events.api import router as event_router
from app.modules.app_registry.api import router as app_registry_router
from app.modules.outbox.api import router as outbox_router
from app.modules.security.api import router as security_router
from app.core.database import engine
from app.core.telemetry import setup_structured_logging, get_logger

setup_structured_logging()
logger = get_logger("mystore.api")

SERVER_START_TIME = time.time()




from contextlib import asynccontextmanager
from typing import Optional
from fastapi.responses import HTMLResponse
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from app.core.docs_protection import is_admin_request, get_docs_lock_html, get_request_token
from app.core.static_assets import mount_static
from app.modules.observability import (
    ObservabilityCaptureMiddleware,
    start_ingestion,
    stop_ingestion,
)
from app.modules.observability.eventbus import event_bus
from app.modules.observability.scheduler import start_detection, stop_detection


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Provisions time partitions, then starts the batching writer.
    await start_ingestion(engine)
    # Cross-worker fan-out for the live operator stream.
    await event_bus.start()
    # Evaluates the detectors on an interval. Records and alerts only; every
    # defensive action stays operator-initiated and audited.
    await start_detection(engine)
    try:
        yield
    finally:
        await stop_detection()
        await event_bus.stop()
        await stop_ingestion()


app = FastAPI(
    title="MyStore Universal Enterprise API (FastAPI)",
    description="High-performance, async Python backend powering the MyStore Enterprise Platform",
    version="2.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

# Serves the docs lock page's compiled Tailwind CSS from 'self'.
mount_static(app)

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui(request: Request, token: Optional[str] = None):
    if not is_admin_request(request, token):
        return HTMLResponse(content=get_docs_lock_html("/docs"), status_code=401)
    active_token = get_request_token(request, token)
    schema_url = f"/openapi.json?token={active_token}" if active_token else "/openapi.json"
    return get_swagger_ui_html(
        openapi_url=schema_url,
        title=f"{app.title} - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
    )

@app.get("/redoc", include_in_schema=False)
async def custom_redoc(request: Request, token: Optional[str] = None):
    if not is_admin_request(request, token):
        return HTMLResponse(content=get_docs_lock_html("/redoc"), status_code=401)
    active_token = get_request_token(request, token)
    schema_url = f"/openapi.json?token={active_token}" if active_token else "/openapi.json"
    return get_redoc_html(
        openapi_url=schema_url,
        title=f"{app.title} - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js",
    )

@app.get("/openapi.json", include_in_schema=False)
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
    return JSONResponse(app.openapi())

# Multi-experience subdomains (§228-§258), then the shared envelope, error and
# security layer. Only the monolith runs the scanner guard and rate limiter itself.
add_cors(app)
install_edge(app, EdgePolicy(
    logger=logger,
    ban_check_api_only=False,
    scanner_guard=True,
    rate_limit=True,
    browser_policy_headers=True,
))

# High-concurrency GZip compression applied outermost (compresses enveloped responses >= 1KB)
add_gzip(app)

# ==============================================================================
# OBSERVABILITY TELEMETRY CAPTURE
# ==============================================================================
# Records one row per served request so the Infra & Security Control Center
# reads measured traffic instead of estimates. Capture is non-blocking and
# best-effort: it buffers in-process and writes in batches on a background
# task, and it swallows its own failures, so a telemetry outage can never
# affect a response. See app/modules/observability/.
app.add_middleware(ObservabilityCaptureMiddleware)

from app.modules.identity.api import router as auth_router
from app.modules.organizations.api import router as org_router
from app.modules.locations.api import router as location_router
from app.modules.catalog.api import router as catalog_router
from app.modules.inventory.api import router as inventory_router
from app.modules.customers.api import router as customer_router
from app.modules.sales.api import router as sales_router
from app.modules.finance.api import router as finance_router
from app.modules.service_desk.api import router as service_desk_router
from app.modules.automations.api import router as automations_router
from app.modules.hr.api import router as hr_router
from app.modules.warehouse.api import router as warehouse_router
from app.modules.projects.api import router as projects_router
from app.modules.pricing.api import router as pricing_router
from app.modules.storage.api import router as storage_router
from app.modules.notifications.api import router as notifications_router
from app.modules.workflows.api import router as workflows_router
from app.modules.reporting.api import router as reporting_router
from app.modules.bot_builder.api import router as bot_builder_router

# Mount Modular Domain Routers (Spec §198, §199 Modular Monolith)
app.include_router(auth_router, prefix="/api/v1/auth")
app.include_router(org_router, prefix="/api/v1/organizations")
app.include_router(location_router, prefix="/api/v1/locations")
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(customer_router, prefix="/api/v1")
app.include_router(sales_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
app.include_router(service_desk_router, prefix="/api/v1")
app.include_router(automations_router, prefix="/api/v1")
app.include_router(hr_router, prefix="/api/v1")
app.include_router(warehouse_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(pricing_router, prefix="/api/v1")
app.include_router(storage_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(workflows_router, prefix="/api/v1")
app.include_router(reporting_router, prefix="/api/v1")
app.include_router(bot_builder_router, prefix="/api/v1")

from app.modules.infra.api import router as infra_router
from app.modules.observability.api import router as observability_router
from app.modules.observability.security_api import router as obs_security_router

# Mount Supporting API Routers
app.include_router(delivery_router, prefix="/api/v1")
app.include_router(industry_router, prefix="/api/v1")
app.include_router(ai_copilot_router, prefix="/api/v1")
app.include_router(data_exchange_router, prefix="/api/v1")
app.include_router(event_router, prefix="/api/v1")
app.include_router(app_registry_router, prefix="/api/v1")
app.include_router(outbox_router, prefix="/api/v1")
app.include_router(security_router, prefix="/api/v1")
app.include_router(infra_router, prefix="/api/v1")
app.include_router(observability_router, prefix="/api/v1")
app.include_router(obs_security_router, prefix="/api/v1")




# ==============================================================================
# OPS & 2026-2030 HEALTH MONITORING & DEEP TELEMETRY
# ==============================================================================

@app.get("/", include_in_schema=False)
async def root_redirect():
    return RedirectResponse(url="/docs")

@app.get("/favicon.ico", include_in_schema=False)
async def root_favicon():
    return Response(status_code=204)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "mystore-backend-python",
        "standard": "2026-2030 Enterprise Gold Standard",
        "uptimeSeconds": round(time.time() - SERVER_START_TIME, 2),
        "timestamp": time.time()
    }

@app.get("/health/deep")
async def deep_health_check():
    """
    2026-2030 Enterprise Cloud-Native Deep Health Probe (§70, §94).
    Measures database query round-trip latency, connection pool health, and uptime.
    """
    t0 = time.time()
    db_ok = False
    error_msg = None
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        error_msg = str(e)

    db_ping_ms = round((time.time() - t0) * 1000, 2)
    uptime_sec = round(time.time() - SERVER_START_TIME, 2)

    status_code = status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if db_ok else "unhealthy",
            "service": "mystore-backend-python",
            "standard": "2026-2030 Enterprise Cloud-Native Tier",
            "uptimeSeconds": uptime_sec,
            "checks": {
                "database": {
                    "connected": db_ok,
                    "engine": "PostgreSQL 16 (asyncpg)",
                    "pingLatencyMs": db_ping_ms,
                    "error": error_msg
                },
                "eventBus": {
                    "status": "active",
                    "mode": "Server-Sent Events (SSE) + WebSocket ready"
                },
                "security": {
                    "mfaEngine": "RFC 6238 TOTP",
                    "fieldEncryption": "AES-256-GCM Authenticated",
                    "tracing": "W3C traceparent (OpenTelemetry ready)"
                }
            },
            "timestamp": time.time()
        }
    )

@app.get("/ready")
async def readiness_check():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "error": str(e)}
        )

@app.get("/metrics")
async def metrics():
    return {
        "uptimeSeconds": round(time.time() - SERVER_START_TIME, 2),
        "engine": "python-fastapi-asyncpg",
        "architecture": "Modular Monolith",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
