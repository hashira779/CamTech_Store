import uvicorn
from app.microservices.common import create_microservice
from app.modules.sales.api import router as sales_router
from app.modules.customers.api import router as customer_router

app = create_microservice(
    name="Sales & POS Orders Microservice",
    description="Processes retail POS transactions, customer orders, and CRM loyalty accounts.",
    port=4003
)

app.include_router(sales_router, prefix="/api/v1")
app.include_router(customer_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting Sales & Orders Microservice on http://localhost:4003...")
    uvicorn.run(app, host="0.0.0.0", port=4003)
