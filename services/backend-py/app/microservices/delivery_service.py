import uvicorn
from app.microservices.common import create_microservice
from app.routers.delivery_routes import router as delivery_router

app = create_microservice(
    name="Delivery & Fleet Microservice",
    description="Manages courier dispatch, driver mobile tasks, GPS route telemetry, and Proof of Delivery (POD).",
    port=4004
)

app.include_router(delivery_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting Delivery & Fleet Microservice on http://localhost:4004...")
    uvicorn.run(app, host="0.0.0.0", port=4004)
