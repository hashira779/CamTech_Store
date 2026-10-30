import uvicorn
from app.microservices.common import create_microservice

# Domain modules with no dedicated service of their own — grouped here so that
# EVERY route is owned by a microservice (nothing relies on the monolith).
from app.modules.service_desk.api import router as service_desk_router
from app.modules.automations.api import router as automations_router
from app.modules.projects.api import router as projects_router
from app.modules.storage.api import router as storage_router
from app.modules.notifications.api import router as notifications_router
from app.modules.workflows.api import router as workflows_router
from app.modules.reporting.api import router as reporting_router

# NOTE: bot_builder has its own dedicated microservice on port 4008
# (bot_builder_service.py). Do NOT mount it here — that would create
# a confusing duplicate registration.

# Supporting / platform routers
from app.modules.industry.api import router as industry_router
from app.modules.ai_copilot.api import router as ai_copilot_router
from app.modules.data_exchange.api import router as data_exchange_router
from app.modules.events.api import router as event_router
from app.modules.app_registry.api import router as app_registry_router
from app.modules.outbox.api import router as outbox_router
from app.modules.security.api import router as security_router

app = create_microservice(
    name="Platform & Experience Microservice",
    description=(
        "Owns every domain not carved into a core service: reporting/BI, notifications, "
        "documents, workflows & approvals, projects, service desk, automations, "
        "industry packs, AI copilot, data exchange, live events (SSE), app registry and the outbox/saga engine."
    ),
    port=4007,
)

for _router in (
    service_desk_router,
    automations_router,
    projects_router,
    storage_router,
    notifications_router,
    workflows_router,
    reporting_router,
    industry_router,
    ai_copilot_router,
    data_exchange_router,
    event_router,
    app_registry_router,
    outbox_router,
    security_router,
):
    app.include_router(_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting Platform & Experience Microservice on http://localhost:4007...")
    uvicorn.run(app, host="0.0.0.0", port=4007)
