import uvicorn
from app.microservices.common import create_microservice
from app.modules.infra.api import router as infra_router
from app.modules.observability.api import router as observability_router
from app.modules.observability.security_api import router as obs_security_router

app = create_microservice(
    name="Infra & Security Control Service",
    description="Centralized operational, observability, identity-security, API-monitoring, and incident-response platform.",
    port=4009
)

app.include_router(infra_router, prefix="/api/v1")
app.include_router(observability_router, prefix="/api/v1")
app.include_router(obs_security_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting CamTech Infra & Security Control Service on http://localhost:4009...")
    uvicorn.run(app, host="0.0.0.0", port=4009)
