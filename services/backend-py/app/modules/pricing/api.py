from decimal import Decimal
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import TaxRate, PriceList, Promotion, LoyaltyTransaction
from app.domain.commerce_engines import (
    TaxCalculator, PromotionEvaluator, PricingResolver, LoyaltyCalculator
)
from .schemas import (
    TaxRateDto, TaxCalculateInput, PriceListDto, PriceResolveInput,
    PromotionDto, PromotionEvaluateInput, LoyaltySummaryDto
)

router = APIRouter(tags=["Pricing, Taxes & Promotions"])

# --- TAXES ---
@router.get("/taxes", response_model=List[TaxRateDto])
async def list_taxes(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TaxRate).where(TaxRate.organization_id == user.organization_id)
    )
    rates = result.scalars().all()
    if not rates:
        return [
            {"id": "tax_vat_10", "name": "Standard VAT (10%)", "ratePct": 10.0, "isInclusive": False, "isActive": True},
            {"id": "tax_zero_0", "name": "Zero Rated (0%)", "ratePct": 0.0, "isInclusive": False, "isActive": True}
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
    data: TaxCalculateInput,
    user: TenantUser = Depends(get_current_user)
):
    amount = Decimal(str(data.amount))
    rate_pct = Decimal(str(data.ratePct))
    is_inclusive = data.isInclusive
    return TaxCalculator.calculate_tax(amount, rate_pct, is_inclusive)

# --- PRICING ---
@router.get("/pricing", response_model=List[PriceListDto])
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
    data: PriceResolveInput,
    user: TenantUser = Depends(get_current_user)
):
    base_price = Decimal(str(data.basePrice))
    tier = str(data.customerTier)
    qty = int(data.quantity)
    resolved = PricingResolver.resolve_price(base_price, tier, qty)
    return {"resolvedPrice": float(resolved), "unitPrice": float(base_price), "tier": tier, "quantity": qty}

# --- PROMOTIONS ---
@router.get("/promotions", response_model=List[PromotionDto])
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
            "value": float(p.discount_value),
            "minSpend": float(p.min_order_amount or 0.0),
            "isActive": p.is_active
        } for p in promos
    ]

@router.post("/promotions/evaluate")
async def evaluate_promotion(
    data: PromotionEvaluateInput,
    user: TenantUser = Depends(get_current_user)
):
    promo_type = data.type
    promo_val = Decimal(str(data.value))
    cart_total = Decimal(str(data.cartTotal))
    items = data.items
    min_spend = Decimal(str(data.minSpend))
    res = PromotionEvaluator.evaluate(promo_type, promo_val, cart_total, items, min_spend)
    return {
        "applicable": res["applicable"],
        "discount": float(res["discount"]),
        "finalTotal": float(res.get("finalTotal", cart_total))
    }

# --- LOYALTY ---
@router.get("/loyalty/customer/{customer_id}", response_model=LoyaltySummaryDto)
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
            {
                "id": t.id,
                "points": t.points,
                "type": t.type,
                "reference": t.reference_id or t.reference_type or "",
                "date": t.created_at.isoformat()
            }
            for t in txs[:10]
        ]
    }
