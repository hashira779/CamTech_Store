import datetime
import secrets
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.modules.catalog.models import ProductVariant

from .models import Sale, SaleLineItem, SalePayment
from .schemas import (
    SaleDto, CreateSaleInput, SaleLineItemDto, SalePaymentDto,
    PaginatedResponse, PageMeta
)

router = APIRouter(tags=["Sales"])

@router.get("/sales", response_model=PaginatedResponse[SaleDto])
async def list_sales(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Sale)
        .where(Sale.organization_id == user.organization_id)
        .options(selectinload(Sale.line_items), selectinload(Sale.payments))
        .order_by(desc(Sale.created_at))
        .limit(50)
    )
    result = await db.execute(stmt)
    sales = result.scalars().all()

    out = []
    for s in sales:
        out.append(SaleDto(
            id=s.id,
            saleNumber=s.sale_number,
            channel=s.channel,
            status=s.status,
            subtotal=float(s.subtotal),
            taxTotal=float(s.tax_total),
            discountTotal=float(s.discount_total),
            grandTotal=float(s.grand_total),
            currency=s.currency,
            itemCount=len(s.line_items),
            customerName=None, # Derived field
            paymentStatus="PAID" if s.payments else "PENDING",
            createdAt=s.created_at.isoformat(),
            lineItems=[
                SaleLineItemDto(
                    id=li.id,
                    variantId=li.product_variant_id,
                    sku=li.sku,
                    name=li.product_name,
                    quantity=float(li.quantity),
                    unitPrice=float(li.unit_price),
                    taxRatePct=float(li.tax_rate_pct),
                    lineTotal=float(li.line_total)
                ) for li in s.line_items
            ],
            payments=[
                SalePaymentDto(
                    id=p.id,
                    amount=float(p.amount),
                    method=p.method,
                    status=p.status,
                    reference=p.reference
                ) for p in s.payments
            ]
        ))
    return PaginatedResponse(items=out, meta=PageMeta(page=1, limit=50, total=len(out), totalPages=1), total=len(out))

@router.post("/sales", response_model=SaleDto)
async def create_sale(
    sale_in: CreateSaleInput,
    request: Request,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    x_idempotency_key_header: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Idempotency Key Handling (§104)
    idempotency_key = sale_in.idempotencyKey or idempotency_key_header or x_idempotency_key_header
    if idempotency_key:
        existing_stmt = (
            select(Sale)
            .where(
                Sale.organization_id == user.organization_id,
                Sale.idempotency_key == idempotency_key
            )
            .options(selectinload(Sale.line_items), selectinload(Sale.payments))
        )
        existing_res = await db.execute(existing_stmt)
        existing_sale = existing_res.scalar_one_or_none()
        if existing_sale:
            # Return previously created sale without re-processing
            return SaleDto(
                id=existing_sale.id,
                idempotencyKey=existing_sale.idempotency_key,
                saleNumber=existing_sale.sale_number,
                channel=existing_sale.channel,
                status=existing_sale.status,
                subtotal=float(existing_sale.subtotal),
                taxTotal=float(existing_sale.tax_total),
                discountTotal=float(existing_sale.discount_total),
                grandTotal=float(existing_sale.grand_total),
                currency=existing_sale.currency,
                itemCount=len(existing_sale.line_items),
                customerName=sale_in.customerName,
                paymentStatus="PAID" if existing_sale.payments else "PENDING",
                createdAt=existing_sale.created_at.isoformat(),
                lineItems=[
                    SaleLineItemDto(
                        id=li.id,
                        variantId=li.product_variant_id,
                        sku=li.sku,
                        name=li.product_name,
                        quantity=float(li.quantity),
                        unitPrice=float(li.unit_price),
                        taxRatePct=float(li.tax_rate_pct),
                        lineTotal=float(li.line_total)
                    ) for li in existing_sale.line_items
                ],
                payments=[
                    SalePaymentDto(
                        id=p.id,
                        amount=float(p.amount),
                        method=p.method,
                        status=p.status,
                        reference=p.reference
                    ) for p in existing_sale.payments
                ]
            )

    sale_num = f"ORD-{datetime.datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    location_id = sale_in.locationId or user.location_id or "loc_main"

    if not sale_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A sale must contain at least one item",
        )

    # Load authoritative variant data (price, tax, sku, name) from the DB,
    # scoped to the caller's organization. Client-supplied unitPrice/taxRatePct
    # are IGNORED — prices are never trusted from the client (spec §66, §106).
    variant_ids = [item.variantId for item in sale_in.items]
    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.organization_id == user.organization_id,
            ProductVariant.id.in_(variant_ids),
        )
    )
    variants = {v.id: v for v in result.scalars().all()}

    subtotal = Decimal('0.0')
    tax_total = Decimal('0.0')
    line_entities = []

    for item in sale_in.items:
        variant = variants.get(item.variantId)
        if variant is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown or inaccessible product variant: {item.variantId}",
            )

        qty = Decimal(str(item.quantity))
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quantity must be positive for variant {item.variantId}",
            )

        price = Decimal(str(variant.sell_price))
        tax_pct = Decimal(str(variant.tax_rate_pct))

        line_sub = (qty * price).quantize(Decimal('0.01'))
        line_tax = (line_sub * (tax_pct / Decimal('100.0'))).quantize(Decimal('0.01'))
        line_tot = line_sub + line_tax

        subtotal += line_sub
        tax_total += line_tax

        line_entities.append(SaleLineItem(
            product_variant_id=variant.id,
            sku=variant.sku,
            product_name=variant.name or variant.sku,
            variant_name=variant.name,
            quantity=qty,
            unit_price=price,
            discount=Decimal('0.0'),
            tax_rate_pct=tax_pct,
            tax_amount=line_tax,
            line_total=line_tot
        ))

    grand_total = subtotal + tax_total

    sale = Sale(
        organization_id=user.organization_id,
        location_id=location_id,
        user_id=user.id,
        idempotency_key=idempotency_key,
        sale_number=sale_num,
        channel=sale_in.channel,
        status="COMPLETED",
        subtotal=subtotal,
        tax_total=tax_total,
        discount_total=Decimal('0.0'),
        grand_total=grand_total,
        currency=sale_in.currency,
        customer_id=sale_in.customerId,
        line_items=line_entities
    )

    for p_in in sale_in.payments:
        sale.payments.append(SalePayment(
            amount=Decimal(str(p_in.amount)),
            method=p_in.method,
            status="COMPLETED",
            reference=p_in.reference
        ))

    db.add(sale)
    await db.commit()
    await db.refresh(sale)

    return SaleDto(
        id=sale.id,
        idempotencyKey=sale.idempotency_key,
        saleNumber=sale.sale_number,
        channel=sale.channel,
        status=sale.status,
        subtotal=float(sale.subtotal),
        taxTotal=float(sale.tax_total),
        discountTotal=float(sale.discount_total),
        grandTotal=float(sale.grand_total),
        currency=sale.currency,
        itemCount=len(sale_in.items),
        customerName=sale_in.customerName,
        paymentStatus="PAID" if sale_in.payments else "PENDING",
        createdAt=sale.created_at.isoformat(),
        lineItems=[
            SaleLineItemDto(
                id=li.id,
                variantId=li.product_variant_id,
                sku=li.sku,
                name=li.product_name,
                quantity=float(li.quantity),
                unitPrice=float(li.unit_price),
                taxRatePct=float(li.tax_rate_pct),
                lineTotal=float(li.line_total)
            ) for li in sale.line_items
        ],
        payments=[
            SalePaymentDto(
                id=p.id,
                amount=float(p.amount),
                method=p.method,
                status=p.status,
                reference=p.reference
            ) for p in sale.payments
        ]
    )
