import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import TaxRate, PriceList, Promotion, LoyaltyTransaction, ProductVariant, Customer
from app.domain.commerce_engines import (
    TaxCalculator, PromotionEvaluator, PricingResolver, LoyaltyCalculator
)
from .schemas import (
    TaxRateDto, TaxCalculateInput, PriceListDto, PriceResolveInput,
    PromotionDto, CreatePromotionInput, UpdatePromotionInput,
    PromotionEvaluateInput, LoyaltySummaryDto
)

router = APIRouter(tags=["Pricing, Taxes & Promotions"])


def _promo_to_dto(p: Promotion) -> PromotionDto:
    disc_val = float(p.discount_value)
    min_ord = float(p.min_order_amount or 0.0)
    return PromotionDto(
        id=p.id,
        organizationId=p.organization_id,
        name=p.name,
        code=p.code,
        description=p.description,
        type=p.type,
        scope=p.scope if hasattr(p, 'scope') and p.scope else "ORDER",
        discountValue=disc_val,
        value=disc_val,
        minOrderAmount=min_ord,
        minSpend=min_ord,
        maxDiscountAmount=float(p.max_discount_amount) if p.max_discount_amount is not None else None,
        buyQuantity=p.buy_quantity,
        getQuantity=p.get_quantity,
        startDate=p.start_date.isoformat() if p.start_date else None,
        endDate=p.end_date.isoformat() if p.end_date else None,
        usageLimit=p.usage_limit,
        currentUses=p.current_uses or 0,
        isActive=bool(p.is_active),
        createdAt=p.created_at.isoformat() if p.created_at else None,
        updatedAt=p.updated_at.isoformat() if p.updated_at else None,
    )


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
            {"id": "tax_vat_10", "code": "VAT_10", "name": "Standard VAT (10%)", "ratePct": 10.0, "isInclusive": False, "isActive": True},
            {"id": "tax_zero_0", "code": "ZERO_0", "name": "Zero Rated (0%)", "ratePct": 0.0, "isInclusive": False, "isActive": True}
        ]
    return [
        {
            "id": r.id,
            "code": r.code or "VAT",
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
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    customer_tier = str(data.customerTier or "REGULAR").upper()

    # If customerId is provided, lookup customer's loyalty tier or type
    if data.customerId:
        cust_res = await db.execute(
            select(Customer).where(
                Customer.id == data.customerId,
                Customer.organization_id == user.organization_id
            )
        )
        cust = cust_res.scalar_one_or_none()
        if cust:
            if cust.loyalty_tier and str(cust.loyalty_tier).upper() in ["VIP", "WHOLESALE"]:
                customer_tier = str(cust.loyalty_tier).upper()
            elif cust.type and str(cust.type).upper() in ["WHOLESALE", "VIP"]:
                customer_tier = str(cust.type).upper()

    # Batch lines resolution (contract: ResolvePricesInput / ResolvedPricesResultDto)
    resolved_lines = []
    if data.lines:
        variant_ids = [line.productVariantId for line in data.lines]
        variants_res = await db.execute(
            select(ProductVariant).where(
                ProductVariant.id.in_(variant_ids),
                ProductVariant.organization_id == user.organization_id
            )
        )
        variants_by_id = {v.id: v for v in variants_res.scalars().all()}

        for line in data.lines:
            v = variants_by_id.get(line.productVariantId)
            base_price = Decimal(str(v.sell_price)) if v and v.sell_price is not None else Decimal(str(data.basePrice or 0.0))
            qty = int(line.quantity) if line.quantity else 1
            resolved_unit = PricingResolver.resolve_price(base_price, customer_tier, qty)
            savings = max(Decimal("0.0"), base_price - resolved_unit)

            source = "VOLUME_TIER" if qty >= 10 else ("CUSTOMER_TIER" if customer_tier != "REGULAR" else "BASE_PRICE")
            resolved_lines.append({
                "productVariantId": line.productVariantId,
                "quantity": float(qty),
                "basePrice": float(base_price),
                "resolvedUnitPrice": float(resolved_unit),
                "savingsPerUnit": float(savings),
                "priceSource": source,
                "tierMinQty": 10 if qty >= 10 else None,
                "priceListName": None
            })

    # Legacy single line fallback
    base_price = Decimal(str(data.basePrice or 0.0))
    qty = int(data.quantity or 1)
    single_resolved = PricingResolver.resolve_price(base_price, customer_tier, qty)

    # If no lines were provided, populate resolved_lines with a fallback entry for consistency
    if not resolved_lines and data.basePrice:
        savings = max(Decimal("0.0"), base_price - single_resolved)
        source = "VOLUME_TIER" if qty >= 10 else ("CUSTOMER_TIER" if customer_tier != "REGULAR" else "BASE_PRICE")
        resolved_lines.append({
            "productVariantId": "default",
            "quantity": float(qty),
            "basePrice": float(base_price),
            "resolvedUnitPrice": float(single_resolved),
            "savingsPerUnit": float(savings),
            "priceSource": source,
            "tierMinQty": 10 if qty >= 10 else None,
            "priceListName": None
        })

    return {
        "priceListApplied": None,
        "lines": resolved_lines,
        "resolvedPrice": float(single_resolved),
        "unitPrice": float(base_price),
        "tier": customer_tier,
        "quantity": qty
    }

# --- PROMOTIONS ---
@router.get("/promotions", response_model=List[PromotionDto])
async def list_promotions(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Promotion)
        .where(Promotion.organization_id == user.organization_id)
        .order_by(Promotion.created_at.desc())
    )
    promos = result.scalars().all()
    return [_promo_to_dto(p) for p in promos]


@router.post("/promotions", response_model=PromotionDto, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    input_data: CreatePromotionInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    valid_types = {"PERCENTAGE", "FIXED_AMOUNT", "BUY_X_GET_Y", "ORDER_THRESHOLD"}
    promo_type = input_data.type.upper() if input_data.type else "PERCENTAGE"
    if promo_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid promotion type '{input_data.type}'. Allowed: {sorted(valid_types)}"
        )
    valid_scopes = {"ORDER", "CATEGORY", "PRODUCT"}
    promo_scope = input_data.scope.upper() if input_data.scope else "ORDER"
    if promo_scope not in valid_scopes:
        promo_scope = "ORDER"

    discount_val = Decimal(str(input_data.discountValue if input_data.discountValue is not None else (input_data.value or 0.0)))
    min_order = Decimal(str(input_data.minOrderAmount if input_data.minOrderAmount is not None else (input_data.minSpend or 0.0)))

    promo = Promotion(
        organization_id=user.organization_id,
        name=input_data.name.strip(),
        code=input_data.code.strip().upper() if input_data.code else None,
        description=input_data.description,
        type=promo_type,
        scope=promo_scope,
        discount_value=discount_val,
        min_order_amount=min_order,
        max_discount_amount=Decimal(str(input_data.maxDiscountAmount)) if input_data.maxDiscountAmount is not None else None,
        buy_quantity=input_data.buyQuantity,
        get_quantity=input_data.getQuantity,
        usage_limit=input_data.usageLimit,
        is_active=input_data.isActive if input_data.isActive is not None else True,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    if input_data.startDate:
        try:
            promo.start_date = datetime.datetime.fromisoformat(input_data.startDate.replace("Z", "+00:00"))
        except Exception:
            pass
    if input_data.endDate:
        try:
            promo.end_date = datetime.datetime.fromisoformat(input_data.endDate.replace("Z", "+00:00"))
        except Exception:
            pass

    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    return _promo_to_dto(promo)


@router.patch("/promotions/{promo_id}", response_model=PromotionDto)
async def update_promotion(
    promo_id: str,
    input_data: UpdatePromotionInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Promotion).where(
            Promotion.id == promo_id,
            Promotion.organization_id == user.organization_id
        )
    )
    promo = res.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")

    if input_data.name is not None:
        promo.name = input_data.name.strip()
    if input_data.code is not None:
        promo.code = input_data.code.strip().upper() if input_data.code else None
    if input_data.description is not None:
        promo.description = input_data.description
    if input_data.type is not None:
        promo.type = input_data.type.upper()
    if input_data.scope is not None:
        promo.scope = input_data.scope.upper()
    if input_data.discountValue is not None or input_data.value is not None:
        val = input_data.discountValue if input_data.discountValue is not None else input_data.value
        promo.discount_value = Decimal(str(val))
    if input_data.minOrderAmount is not None or input_data.minSpend is not None:
        spend = input_data.minOrderAmount if input_data.minOrderAmount is not None else input_data.minSpend
        promo.min_order_amount = Decimal(str(spend))
    if input_data.isActive is not None:
        promo.is_active = input_data.isActive

    promo.updated_at = utc_now()
    await db.commit()
    await db.refresh(promo)
    return _promo_to_dto(promo)


@router.delete("/promotions/{promo_id}")
async def delete_promotion(
    promo_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Promotion).where(
            Promotion.id == promo_id,
            Promotion.organization_id == user.organization_id
        )
    )
    promo = res.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")

    await db.delete(promo)
    await db.commit()
    return {"success": True, "message": "Promotion deleted successfully"}


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
