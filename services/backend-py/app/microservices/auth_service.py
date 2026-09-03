import uvicorn
from app.microservices.common import create_microservice
from app.modules.identity.api import router as auth_router
from app.modules.organizations.api import router as org_router
from app.modules.locations.api import router as location_router

app = create_microservice(
    name="Auth & Identity Microservice",
    description="Handles user authentication, JWT tokens, RBAC roles, tenant organizations, and branch locations.",
    port=4001
)

app.include_router(auth_router, prefix="/api/v1/auth")
app.include_router(org_router, prefix="/api/v1/organizations")
app.include_router(location_router, prefix="/api/v1/locations")

if __name__ == "__main__":
    print("🚀 Starting Auth & Identity Microservice on http://localhost:4001...")
    uvicorn.run(app, host="0.0.0.0", port=4001)
