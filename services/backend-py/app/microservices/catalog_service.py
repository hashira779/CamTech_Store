import uvicorn
from app.microservices.common import create_microservice
from app.modules.catalog.api import router as catalog_router
from app.modules.inventory.api import router as inventory_router
from app.modules.warehouse.api import router as warehouse_router
from app.modules.pricing.api import router as pricing_router

app = create_microservice(
    name="Catalog & Inventory Microservice",
    description="Manages product catalog, SKUs, inventory items, warehouse transfers, and pricing lists.",
    port=4002
)

app.include_router(catalog_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(warehouse_router, prefix="/api/v1")
app.include_router(pricing_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting Catalog & Inventory Microservice on http://localhost:4002...")
    uvicorn.run(app, host="0.0.0.0", port=4002)
