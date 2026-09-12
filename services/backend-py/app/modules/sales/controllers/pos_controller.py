import uuid
import secrets
import json
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser, RequirePermissions
from app.modules.catalog.models import ProductVariant
from app.modules.locations.models import Location
from app.modules.inventory.models import InventoryItem, StockMovement
from app.modules.customers.models import Customer
from app.modules.delivery.models import DeliveryOrder, DeliveryDriver
from app.models.entities import NotificationRecord

from ..models import Sale, SaleLineItem, SalePayment
from ..schemas import (
    SaleDto, CreateSaleInput, SaleLineItemDto, SalePaymentDto,
    PaginatedResponse, PageMeta
)
from .helpers import derive_payment_status

router = APIRouter(tags=["POS Sales"])

@router.get("/sales", response_model=PaginatedResponse[SaleDto])
async def list_sales(
    user: TenantUser = Depends(RequirePermissions(["sales:read"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Sale, DeliveryOrder)
        .outerjoin(DeliveryOrder, DeliveryOrder.sale_id == Sale.id)
        .where(Sale.organization_id == user.organization_id)
        .options(selectinload(Sale.line_items), selectinload(Sale.payments))
        .order_by(desc(Sale.created_at))
        .limit(50)
    )
    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for s, do in rows:
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
            customerName=None,  # Derived field
            paymentStatus=derive_payment_status(s.payments, s.grand_total),
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
            ],
            deliveryStatus=do.status if do else None,
            trackingNumber=do.tracking_number if do else None
        ))
    return PaginatedResponse(items=out, meta=PageMeta(page=1, limit=50, total=len(out), totalPages=1), total=len(out))

@router.get("/sales/{sale_id}", response_model=SaleDto)
async def get_sale(
    sale_id: str,
    user: TenantUser = Depends(RequirePermissions(["sales:read"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Sale)
        .where(
            Sale.id == sale_id,
            Sale.organization_id == user.organization_id
        )
        .options(selectinload(Sale.line_items), selectinload(Sale.payments))
    )
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale transaction not found: {sale_id}"
        )

    # Derive Customer Name
    cust_name = None
    if s.customer_id:
        c_res = await db.execute(select(Customer.name).where(Customer.id == s.customer_id))
        cust_name = c_res.scalar_one_or_none()
    if not cust_name and s.notes:
        try:
            parsed = json.loads(s.notes)
            if isinstance(parsed, dict):
                cust_name = parsed.get("customerName")
        except Exception:
            pass

    # Look up attached DeliveryOrder & Driver
    deliv_stmt = (
        select(DeliveryOrder, DeliveryDriver)
        .outerjoin(DeliveryDriver, DeliveryOrder.driver_id == DeliveryDriver.id)
        .where(
            DeliveryOrder.organization_id == user.organization_id,
            (DeliveryOrder.sale_id == s.id) | (DeliveryOrder.tracking_number == s.sale_number)
        )
        .limit(1)
    )
    deliv_res = await db.execute(deliv_stmt)
    deliv_row = deliv_res.first()

    deliv_order = deliv_row[0] if deliv_row else None
    deliv_driver = deliv_row[1] if deliv_row else None

    return SaleDto(
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
        customerName=cust_name or "Walk-in Customer",
        paymentStatus=derive_payment_status(s.payments, s.grand_total),
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
        ],
        trackingNumber=deliv_order.tracking_number if deliv_order else None,
        deliveryOrderId=deliv_order.id if deliv_order else None,
        deliveryStatus=deliv_order.status if deliv_order else None,
        deliveryAddress=deliv_order.delivery_address if deliv_order else None,
        driverName=deliv_driver.name if deliv_driver else None,
        driverPhone=deliv_driver.phone if deliv_driver else None,
        driverVehicle=deliv_driver.vehicle_type if deliv_driver else None,
        destLat=deliv_order.dest_lat if deliv_order else None,
        destLng=deliv_order.dest_lng if deliv_order else None,
        deliveryFee=float(deliv_order.delivery_fee) if deliv_order and deliv_order.delivery_fee is not None else None,
        etaMinutes=deliv_order.eta_minutes if deliv_order else None,
        distanceKm=deliv_order.distance_km if deliv_order else None,
    )

@router.post("/sales", response_model=SaleDto)
async def create_sale(
    sale_in: CreateSaleInput,
    request: Request,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    x_idempotency_key_header: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    user: TenantUser = Depends(RequirePermissions(["sales:write"])),
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
                paymentStatus=derive_payment_status(existing_sale.payments, existing_sale.grand_total),
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

    sale_num = f"ORD-{utc_now().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

    # Location is optional (nullable FK). Use the request's, else the user's scope, else NULL
    location_id = sale_in.locationId or user.location_id
    if location_id:
        loc = await db.execute(
            select(Location.id).where(
                Location.id == location_id,
                Location.organization_id == user.organization_id,
            )
        )
        if loc.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown or inaccessible location: {location_id}",
            )

    if not sale_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A sale must contain at least one item",
        )

    # Load authoritative variant data from DB
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

    payment_entities = []
    for p_in in sale_in.payments:
        pay_amount = Decimal(str(p_in.amount))
        if pay_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment amount must be positive",
            )
        raw_method = (p_in.method or "CASH").upper().strip()
        if "QR" in raw_method or "KHQR" in raw_method or "BAKONG" in raw_method:
            norm_method = "QR"
        elif raw_method in ["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CREDIT", "OTHER"]:
            norm_method = raw_method
        else:
            norm_method = "OTHER"

        payment_entities.append(SalePayment(
            amount=pay_amount,
            method=norm_method,
            status="COMPLETED",
            reference=p_in.reference
        ))

    sale = Sale(
        organization_id=user.organization_id,
        location_id=location_id,
        user_id=user.id,
        idempotency_key=idempotency_key,
        sale_number=sale_num,
        channel=sale_in.channel,
        status="DRAFT",
        subtotal=subtotal,
        tax_total=tax_total,
        discount_total=Decimal('0.0'),
        grand_total=grand_total,
        currency=sale_in.currency,
        customer_id=sale_in.customerId,
        line_items=line_entities,
        payments=payment_entities,
    )

    db.add(sale)

    # Deduct inventory & record stock movement
    now = utc_now()
    for item in sale_in.items:
        qty_num = Decimal(str(item.quantity))
        inv_stmt = (
            select(InventoryItem)
            .where(
                InventoryItem.organization_id == user.organization_id,
                InventoryItem.product_variant_id == item.variantId
            )
            .limit(1)
        )
        inv_res = await db.execute(inv_stmt)
        inv_rec = inv_res.scalar_one_or_none()
        if inv_rec:
            inv_rec.stock_on_hand = Decimal(str(inv_rec.stock_on_hand)) - qty_num
            inv_rec.updated_at = now
            bal = inv_rec.stock_on_hand
            mv = StockMovement(
                id=str(uuid.uuid4()),
                organization_id=user.organization_id,
                inventory_item_id=inv_rec.id,
                type="SALE",
                quantity=qty_num,
                balance_after=bal,
                reference_type="SALE",
                reference_id=sale.id,
                notes=f"Sale {sale_num}",
                user_id=user.id,
                created_at=now,
            )
            db.add(mv)
            if inv_rec.reorder_point is not None and inv_rec.stock_on_hand <= Decimal(str(inv_rec.reorder_point)):
                db.add(NotificationRecord(
                    id=str(uuid.uuid4()),
                    organization_id=user.organization_id,
                    user_id=None,
                    channel="IN_APP",
                    type="LOW_STOCK_ALERT",
                    title="⚠️ Low Stock Alert",
                    message=f"Stock for variant {item.variantId} dropped to {bal} (reorder point: {inv_rec.reorder_point}).",
                    status="SENT",
                    is_read=False,
                    sent_at=now,
                    created_at=now,
                ))

    await db.commit()

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
        paymentStatus=derive_payment_status(sale.payments, sale.grand_total),
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

@router.patch("/sales/{sale_id}/complete", response_model=SaleDto)
async def complete_sale(
    sale_id: str,
    user: TenantUser = Depends(RequirePermissions(["sales:write"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Transitions a DRAFT (preparing) POS sale to COMPLETED.
    Used when the merchant finishes preparing a walk-in order.
    """
    stmt = (
        select(Sale)
        .where(
            Sale.id == sale_id,
            Sale.organization_id == user.organization_id,
        )
        .options(selectinload(Sale.line_items), selectinload(Sale.payments))
    )
    res = await db.execute(stmt)
    sale = res.scalar_one_or_none()
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale not found: {sale_id}"
        )
    if sale.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only DRAFT (preparing) sales can be completed. Current status: {sale.status}"
        )

    sale.status = "COMPLETED"
    sale.completed_at = utc_now()
    await db.commit()
    await db.refresh(sale)

    # Derive Customer Name
    cust_name = None
    if sale.customer_id:
        c_res = await db.execute(select(Customer.name).where(Customer.id == sale.customer_id))
        cust_name = c_res.scalar_one_or_none()

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
        itemCount=len(sale.line_items),
        customerName=cust_name or "Walk-in Customer",
        paymentStatus=derive_payment_status(sale.payments, sale.grand_total),
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
