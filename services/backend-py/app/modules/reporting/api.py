from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser

router = APIRouter(tags=["BI Reporting & Analytics"])

@router.get("/reports/dashboard")
async def get_dashboard_kpis(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return {
        "kpi": {
            "grossSales": 14250.75,
            "orderCount": 84,
            "averageOrderValue": 169.65,
            "netProfit": 4850.20,
            "currency": "USD"
        },
        "salesByChannel": [
            {"channel": "POS", "total": 9850.50, "count": 62},
            {"channel": "ECOMMERCE", "total": 3100.25, "count": 16},
            {"channel": "TELEGRAM", "total": 1300.00, "count": 6}
        ],
        "inventoryAlerts": [
            {"sku": "COF-001", "name": "Dark Roast Beans 1kg", "stock": 4, "reorderPoint": 15},
            {"sku": "SYR-002", "name": "Vanilla Syrup 750ml", "stock": 2, "reorderPoint": 10}
        ]
    }
