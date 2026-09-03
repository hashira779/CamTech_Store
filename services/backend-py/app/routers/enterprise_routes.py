import datetime
import secrets
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import (
    TaxRate, PriceList, Promotion, LoyaltyTransaction, DocumentRecord,
    NotificationRecord, Account, JournalEntry, JournalLine, FixedAsset,
    DepreciationRecord, ServiceTicket, TicketComment, ApprovalRequest,
    DeveloperApp, ApiKey, TelegramChatBinding, StockTransfer,
    Department, Employee, PayrollRecord, Project, Timesheet
)
from app.domain.commerce_engines import (
    TaxCalculator, PromotionEvaluator, PricingResolver, LoyaltyCalculator
)
from app.domain.enterprise_engines import (
    DepreciationCalculator, PayrollCalculator, ApiKeyGenerator, TelegramCommandRouter
)

router = APIRouter()

# ==============================================================================
# 7. TAX ENGINE
# ==============================================================================

@router.get("/taxes")
async def list_taxes(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TaxRate).where(TaxRate.organization_id == user.organization_id)
    )
    rates = result.scalars().all()
    if not rates:
        # Fallback default rates
        return [
            {"id": "tax_vat_10", "name": "Standard VAT (10%)", "ratePct": 10.0, "isInclusive": False},
            {"id": "tax_zero_0", "name": "Zero Rated (0%)", "ratePct": 0.0, "isInclusive": False}
        ]
    return [
        {
            "id": r.id,
            "name": r.name,
            "ratePct": float(r.rate_pct),
            "isInclusive": r.is_inclusive,
            "isActive": r.is_active
        } for r in rates
    ]

@router.post("/taxes/calculate")
async def calculate_tax(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user)
):
    amount = Decimal(str(data.get("amount", 0)))
    rate_pct = Decimal(str(data.get("ratePct", 10.0)))
    is_inclusive = bool(data.get("isInclusive", False))
    return TaxCalculator.calculate_tax(amount, rate_pct, is_inclusive)

# ==============================================================================
# 8. PRICING & TIERS
# ==============================================================================

@router.get("/pricing")
async def list_pricing(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(PriceList).where(PriceList.organization_id == user.organization_id)
    )
    lists = result.scalars().all()
    if not lists:
        return [
            {"id": "pl_retail", "name": "Standard Retail", "code": "RETAIL", "currency": "USD", "isDefault": True},
            {"id": "pl_wholesale", "name": "Wholesale Tier", "code": "WHOLESALE", "currency": "USD", "isDefault": False}
        ]
    return [
        {
            "id": pl.id,
            "name": pl.name,
            "code": pl.code,
            "currency": pl.currency,
            "isDefault": pl.is_default
        } for pl in lists
    ]

@router.post("/pricing/resolve")
async def resolve_price(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user)
):
    base_price = Decimal(str(data.get("basePrice", 0)))
    tier = str(data.get("customerTier", "REGULAR"))
    qty = int(data.get("quantity", 1))
    resolved = PricingResolver.resolve_price(base_price, tier, qty)
    return {"resolvedPrice": float(resolved), "unitPrice": float(base_price), "tier": tier, "quantity": qty}

# ==============================================================================
# 9. PROMOTIONS & DEALS
# ==============================================================================

@router.get("/promotions")
async def list_promotions(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Promotion).where(Promotion.organization_id == user.organization_id)
    )
    promos = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "type": p.type,
            "value": float(p.value),
            "minSpend": float(p.min_spend),
            "isActive": p.is_active
        } for p in promos
    ]

@router.post("/promotions/evaluate")
async def evaluate_promotion(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user)
):
    promo_type = data.get("type", "PERCENTAGE")
    promo_val = Decimal(str(data.get("value", 10)))
    cart_total = Decimal(str(data.get("cartTotal", 100)))
    items = data.get("items", [])
    min_spend = Decimal(str(data.get("minSpend", 0)))
    res = PromotionEvaluator.evaluate(promo_type, promo_val, cart_total, items, min_spend)
    return {
        "applicable": res["applicable"],
        "discount": float(res["discount"]),
        "finalTotal": float(res.get("finalTotal", cart_total))
    }

# ==============================================================================
# 10. LOYALTY & STORE CREDIT
# ==============================================================================

@router.get("/loyalty/customer/{customer_id}")
async def get_customer_loyalty(
    customer_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(LoyaltyTransaction)
        .where(
            LoyaltyTransaction.customer_id == customer_id,
            LoyaltyTransaction.organization_id == user.organization_id
        )
        .order_by(desc(LoyaltyTransaction.created_at))
    )
    txs = result.scalars().all()
    points = sum(t.points for t in txs)
    tier = "GOLD" if points > 500 else ("SILVER" if points > 200 else "BRONZE")
    return {
        "customerId": customer_id,
        "pointsBalance": points,
        "tier": tier,
        "dollarValue": float(LoyaltyCalculator.calculate_redemption_value(points)),
        "history": [
            {"id": t.id, "points": t.points, "type": t.type, "reference": t.reference, "date": t.created_at.isoformat()}
            for t in txs[:10]
        ]
    }

# ==============================================================================
# 11. STORAGE & DOCUMENTS
# ==============================================================================

@router.get("/storage")
async def list_documents(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DocumentRecord).where(DocumentRecord.organization_id == user.organization_id)
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "fileName": d.file_name,
            "mimeType": d.mime_type,
            "sizeBytes": d.size_bytes,
            "storagePath": d.storage_path,
            "createdAt": d.created_at.isoformat()
        } for d in docs
    ]

@router.post("/storage/upload-intent")
async def create_upload_intent(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user)
):
    filename = data.get("fileName", "upload.pdf")
    token = secrets.token_hex(16)
    return {
        "uploadUrl": f"/api/v1/storage/upload/{token}",
        "fileKey": f"tenant/{user.organization_id}/{token}_{filename}",
        "expiresIn": 3600
    }

# ==============================================================================
# 12. NOTIFICATIONS
# ==============================================================================

@router.get("/notifications")
async def list_notifications(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(NotificationRecord)
        .where(NotificationRecord.organization_id == user.organization_id)
        .order_by(desc(NotificationRecord.sent_at))
        .limit(20)
    )
    notes = result.scalars().all()
    return [
        {
            "id": n.id,
            "channel": n.channel,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "status": n.status,
            "sentAt": n.sent_at.isoformat()
        } for n in notes
    ]

# ==============================================================================
# 13. REAL-TIME BI REPORTING & ANALYTICS
# ==============================================================================

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

# ==============================================================================
# 14. WORKFLOWS & SEQUENTIAL APPROVALS
# ==============================================================================

@router.get("/approvals")
async def list_approvals(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.organization_id == user.organization_id)
    )
    reqs = result.scalars().all()
    return [
        {
            "id": r.id,
            "entityType": r.entity_type,
            "entityId": r.entity_id,
            "stepNumber": r.step_number,
            "totalSteps": r.total_steps,
            "status": r.status,
            "submittedById": r.submitted_by_id,
            "createdAt": r.created_at.isoformat()
        } for r in reqs
    ]

@router.post("/approvals/{req_id}/sign")
async def sign_approval(
    req_id: str,
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.id == req_id,
            ApprovalRequest.organization_id == user.organization_id
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")

    decision = data.get("decision", "APPROVED")
    req.status = decision
    req.approved_by_id = user.id
    await db.commit()
    return {"id": req.id, "status": req.status, "approvedBy": user.id}

# ==============================================================================
# 15. GENERAL LEDGER & FINANCE
# ==============================================================================

# (Finance routes have been extracted to app.modules.finance)

# ==============================================================================
# 18. HR & PAYROLL
# ==============================================================================

@router.get("/hr/employees")
async def list_employees(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Employee).where(Employee.organization_id == user.organization_id)
    )
    emps = result.scalars().all()
    return [
        {
            "id": e.id,
            "firstName": e.first_name,
            "lastName": e.last_name,
            "email": e.email,
            "baseSalary": float(e.base_salary),
            "status": e.status
        } for e in emps
    ]

@router.post("/hr/payroll/calculate")
async def calculate_payroll(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user)
):
    base = Decimal(str(data.get("baseSalary", 0)))
    allow = Decimal(str(data.get("allowances", 0)))
    deduct = Decimal(str(data.get("deductions", 0)))
    tax_pct = Decimal(str(data.get("taxRatePct", 5.0)))
    res = PayrollCalculator.calculate_net_pay(base, allow, deduct, tax_pct)
    return {
        "baseSalary": float(res["baseSalary"]),
        "allowances": float(res["allowances"]),
        "grossPay": float(res["grossPay"]),
        "deductions": float(res["deductions"]),
        "taxAmount": float(res["taxAmount"]),
        "netPay": float(res["netPay"])
    }

# ==============================================================================
# 19. PROJECTS & TIMESHEETS
# ==============================================================================

@router.get("/projects")
async def list_projects(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Project).where(Project.organization_id == user.organization_id)
    )
    projects = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "status": p.status,
            "budget": float(p.budget),
            "createdAt": p.created_at.isoformat()
        } for p in projects
    ]

# ==============================================================================
# 20. SERVICE DESK TICKETS
# ==============================================================================

# (Service Desk routes have been extracted to app.modules.service_desk)

# (Automations routes have been extracted to app.modules.automations)

# ==============================================================================
# 23. WMS & STOCK TRANSFERS
# ==============================================================================

@router.get("/wms/transfers")
async def list_stock_transfers(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StockTransfer).where(StockTransfer.organization_id == user.organization_id)
    )
    transfers = result.scalars().all()
    return [
        {
            "id": t.id,
            "transferNumber": t.transfer_number,
            "fromLocationId": t.from_location_id,
            "toLocationId": t.to_location_id,
            "status": t.status,
            "createdAt": t.created_at.isoformat()
        } for t in transfers
    ]
