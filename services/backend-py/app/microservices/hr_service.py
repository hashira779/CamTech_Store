import uvicorn
from app.microservices.common import create_microservice
from app.modules.hr.api import router as hr_router

app = create_microservice(
    name="HR & Workforce Microservice",
    description="Manages corporate organization tree, employee directory, leave approvals, and payroll runner.",
    port=4005
)

app.include_router(hr_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting HR & Workforce Microservice on http://localhost:4005...")
    uvicorn.run(app, host="0.0.0.0", port=4005)
