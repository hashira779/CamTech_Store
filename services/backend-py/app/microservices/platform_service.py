import uvicorn
from app.microservices.common import create_microservice

# Domain modules with no dedicated service of their own — grouped here so that
# EVERY route is owned by a microservice (nothing relies on the monolith).
from app.modules.service_desk.api import router as service_desk_router
from app.modules.automations.api import router as automations_router
from app.modules.projects.api import router as projects_router
from app.modules.documents.api import router as documents_router
from app.modules.notifications.api import router as notifications_router
from app.modules.workflows.api import router as workflows_router
from app.modules.reporting.api import router as reporting_router

# Supporting / platform routers
from app.routers.api_v1 import router as api_v1_router
from app.routers.industry_routes import router as industry_router
from app.routers.ai_copilot_routes import router as ai_copilot_router
from app.routers.data_exchange_routes import router as data_exchange_router
from app.routers.event_routes import router as event_router
from app.routers.app_registry_routes import router as app_registry_router
from app.routers.outbox_routes import router as outbox_router

app = create_microservice(
    name="Platform & Experience Microservice",
    description=(
        "Owns every domain not carved into a core service: reporting/BI, notifications, "
        "documents, workflows & approvals, projects, service desk, automations, industry "
        "packs, AI copilot, data exchange, live events (SSE), app registry and the outbox/saga engine."
    ),
    port=4007,
)

for _router in (
    service_desk_router,
    automations_router,
    projects_router,
    documents_router,
    notifications_router,
    workflows_router,
    reporting_router,
    api_v1_router,
    industry_router,
    ai_copilot_router,
    data_exchange_router,
    event_router,
    app_registry_router,
    outbox_router,
):
    app.include_router(_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting Platform & Experience Microservice on http://localhost:4007...")
    uvicorn.run(app, host="0.0.0.0", port=4007)
