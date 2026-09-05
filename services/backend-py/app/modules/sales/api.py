import datetime
import json
import uuid
import secrets
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_optional_user, TenantUser
from app.core.config import settings
from app.modules.organizations.models import Organization
from app.modules.customers.models import Customer
from app.modules.identity.models import User
from app.modules.catalog.models import ProductVariant, Product
from app.modules.locations.models import Location
from app.modules.inventory.models import InventoryItem, StockMovement
from app.models.entities import NotificationRecord
from app.services.delivery_service import delivery_service
from app.schemas.dto import CreateDeliveryOrderInput

from .models import Sale, SaleLineItem, SalePayment
from .schemas import (
    SaleDto, CreateSaleInput, StoreCheckoutInput, SaleLineItemDto, SalePaymentDto,
    PaginatedResponse, PageMeta
)

router = APIRouter(tags=["Sales"])


def _derive_payment_status(payments, grand_total) -> str:
    """Payment status from the ACTUAL amount tendered vs the sale total.

    A sale is only PAID once payments cover the grand total; a smaller amount is
    PARTIAL, and none is PENDING. (Previously any payment marked a sale PAID,
    so an underpayment looked fully settled — spec §106.)
    """
    total_paid = sum((Decimal(str(p.amount)) for p in payments), Decimal("0"))
    if total_paid <= 0:
        return "PENDING"
    if total_paid >= Decimal(str(grand_total)):
        return "PAID"
    return "PARTIAL"


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
            paymentStatus=_derive_payment_status(s.payments, s.grand_total),
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
                paymentStatus=_derive_payment_status(existing_sale.payments, existing_sale.grand_total),
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

    # Location is optional (nullable FK). Use the request's, else the user's
    # scope, else NULL — never a hardcoded id that would violate the FK. A
    # supplied/derived location must belong to the caller's org.
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

    # Build payments up front so the collection is always populated in memory
    # (even when empty) — otherwise a no-payment sale lazy-loads sale.payments
    # after commit and raises MissingGreenlet.
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
        status="COMPLETED",
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
    now = datetime.datetime.utcnow()
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
    # No refresh(): ids/timestamps use Python-side defaults already set during
    # flush, and line_items/payments are the in-memory lists we built. Calling
    # refresh() would expire those collections and trigger a lazy load outside
    # the async context -> MissingGreenlet.

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
        paymentStatus=_derive_payment_status(sale.payments, sale.grand_total),
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


@router.post("/sales/store-checkout", response_model=SaleDto)
@router.post("/sales/public-checkout", response_model=SaleDto)
async def store_checkout(
    payload: StoreCheckoutInput,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Storefront Online Customer Checkout Endpoint.
    Records a completed Sale, Line Items, and Payment directly in PostgreSQL,
    linked to the customer account, and resets active shopping cart.
    """
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot checkout with an empty cart."
        )

    email_clean = payload.customerEmail.strip().lower()
    name_clean = payload.customerName.strip() or email_clean.split("@")[0]
    phone_clean = payload.customerPhone.strip() if payload.customerPhone else None

    # Resolve Target Organization
    target_org = user.organization_id if user else (payload.organizationId or None)
    if not target_org and payload.items:
        first_item_id = payload.items[0].id
        if first_item_id:
            pv_res = await db.execute(
                select(ProductVariant.organization_id).where(ProductVariant.id == first_item_id).limit(1)
            )
            target_org = pv_res.scalar_one_or_none()
            if not target_org:
                prod_res = await db.execute(
                    select(Product.organization_id).where(Product.id == first_item_id).limit(1)
                )
                target_org = prod_res.scalar_one_or_none()

    if not target_org:
        org_result = await db.execute(select(Organization.id).order_by(Organization.created_at.asc()).limit(1))
        target_org = org_result.scalar_one_or_none() or settings.DEFAULT_ORG_ID

    # 1. Resolve or provision Customer record
    cust_result = await db.execute(
        select(Customer).where(func.lower(Customer.email) == email_clean).limit(1)
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        customer = Customer(
            organization_id=target_org,
            code=f"CUST-{uuid.uuid4().hex[:8].upper()}",
            name=name_clean,
            email=email_clean,
            phone=phone_clean,
            type="INDIVIDUAL",
            loyalty_points=500,
            loyalty_tier="Executive Gold",
            store_credit=0.0,
            notes=json.dumps({"notes": "Store Customer via Online Checkout", "cart": []}),
            is_active=True
        )
        db.add(customer)
        await db.flush()

    # 2. Resolve or provision User record for Foreign Key constraint
    user_result = await db.execute(
        select(User.id).where(func.lower(User.email) == email_clean).limit(1)
    )
    sale_user_id = user_result.scalar_one_or_none()
    if not sale_user_id:
        org_user_res = await db.execute(
            select(User.id).where(User.organization_id == target_org).limit(1)
        )
        sale_user_id = org_user_res.scalar_one_or_none()
        if not sale_user_id:
            any_user_res = await db.execute(select(User.id).limit(1))
            sale_user_id = any_user_res.scalar_one_or_none() or "system-store-checkout"

    # 3. Calculate Totals & Build Line Items with Reliable Variant Resolution
    subtotal = Decimal("0.0")
    tax_total = Decimal("0.0")
    sale_num = f"ORD-{datetime.datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    sale_id = str(uuid.uuid4())

    line_entities = []
    resolved_line_items = []
    for it in payload.items:
        qty = Decimal(str(it.quantity))
        price = Decimal(str(it.price))
        line_sub = (qty * price).quantize(Decimal("0.01"))
        tax_pct = Decimal("10.0")  # 10% VAT standard
        tax_amt = (line_sub * (tax_pct / Decimal("100.0"))).quantize(Decimal("0.01"))
        line_tot = line_sub + tax_amt

        subtotal += line_sub
        tax_total += tax_amt

        # ── RESOLVE REAL PRODUCT VARIANT ──
        resolved_variant_id = None
        resolved_variant_name = it.category or "Standard"
        resolved_sku = it.sku

        # 1. Check if it.id is directly a product_variant id
        if it.id:
            pv_chk = await db.execute(
                select(ProductVariant).where(ProductVariant.id == it.id).limit(1)
            )
            pv_obj = pv_chk.scalar_one_or_none()
            if pv_obj:
                resolved_variant_id = pv_obj.id
                resolved_variant_name = pv_obj.name or resolved_variant_name
                resolved_sku = pv_obj.sku or resolved_sku
            else:
                # 2. Check if it.id was actually a product id, get its first variant
                pv_prod_chk = await db.execute(
                    select(ProductVariant)
                    .where(ProductVariant.product_id == it.id)
                    .order_by(ProductVariant.created_at.asc())
                    .limit(1)
                )
                pv_from_prod = pv_prod_chk.scalar_one_or_none()
                if pv_from_prod:
                    resolved_variant_id = pv_from_prod.id
                    resolved_variant_name = pv_from_prod.name or resolved_variant_name
                    resolved_sku = pv_from_prod.sku or resolved_sku

        # 3. Try matching by SKU
        if not resolved_variant_id and it.sku:
            pv_sku_chk = await db.execute(
                select(ProductVariant).where(ProductVariant.sku == it.sku).limit(1)
            )
            pv_from_sku = pv_sku_chk.scalar_one_or_none()
            if pv_from_sku:
                resolved_variant_id = pv_from_sku.id
                resolved_variant_name = pv_from_sku.name or resolved_variant_name
                resolved_sku = pv_from_sku.sku or resolved_sku

        # 4. Fallback if product was ad-hoc: get any existing variant in org or DB
        if not resolved_variant_id:
            pv_fallback = await db.execute(
                select(ProductVariant).where(ProductVariant.organization_id == target_org).limit(1)
            )
            pv_fallback_obj = pv_fallback.scalar_one_or_none()
            if pv_fallback_obj:
                resolved_variant_id = pv_fallback_obj.id
                resolved_variant_name = pv_fallback_obj.name or resolved_variant_name
                resolved_sku = pv_fallback_obj.sku or resolved_sku
            else:
                pv_any = await db.execute(select(ProductVariant).limit(1))
                pv_any_obj = pv_any.scalar_one_or_none()
                if pv_any_obj:
                    resolved_variant_id = pv_any_obj.id
                    resolved_variant_name = pv_any_obj.name or resolved_variant_name
                    resolved_sku = pv_any_obj.sku or resolved_sku

        resolved_line_items.append({
            "variant_id": resolved_variant_id,
            "quantity": qty,
            "name": it.name,
        })

        line_entities.append(SaleLineItem(
            id=str(uuid.uuid4()),
            sale_id=sale_id,
            product_variant_id=resolved_variant_id,
            sku=resolved_sku or f"SKU-{str(resolved_variant_id)[:6] if resolved_variant_id else 'DEF'}",
            product_name=it.name,
            variant_name=resolved_variant_name,
            quantity=qty,
            unit_price=price,
            discount=Decimal("0.0"),
            tax_rate_pct=tax_pct,
            tax_amount=tax_amt,
            line_total=line_tot
        ))

    grand_total = subtotal + tax_total

    # 4. Create Sale Record
    notes_dict = {
        "customerName": name_clean,
        "customerEmail": email_clean,
        "customerPhone": phone_clean,
        "deliveryAddress": payload.deliveryAddress,
        "storeNotes": payload.notes or "Online Store Checkout",
    }

    sale = Sale(
        id=sale_id,
        organization_id=target_org,
        location_id=None,
        customer_id=customer.id,
        user_id=sale_user_id,
        sale_number=sale_num,
        channel="STORE",
        status="COMPLETED",
        subtotal=subtotal,
        discount_total=Decimal("0.0"),
        tax_total=tax_total,
        grand_total=grand_total,
        currency="USD",
        notes=json.dumps(notes_dict),
        completed_at=datetime.datetime.utcnow(),
    )
    db.add(sale)

    for li in line_entities:
        db.add(li)

    # 5. Create Payment Record
    pay_method = "QR" if "QR" in payload.paymentMethod.upper() else "CASH"
    payment = SalePayment(
        id=str(uuid.uuid4()),
        sale_id=sale_id,
        method=pay_method,
        status="COMPLETED",
        provider="Bakong KHQR" if pay_method == "QR" else "Cash on Delivery",
        amount=grand_total,
        reference=f"TXN-{secrets.token_hex(4).upper()}",
        paid_at=datetime.datetime.utcnow(),
    )
    db.add(payment)

    # 6. Reset Customer Cart in PostgreSQL
    cust_notes = {}
    if customer.notes:
        try:
            parsed = json.loads(customer.notes)
            if isinstance(parsed, dict):
                cust_notes = parsed
            else:
                cust_notes["notes"] = str(customer.notes)
        except Exception:
            cust_notes["notes"] = str(customer.notes)
    cust_notes["cart"] = []
    customer.notes = json.dumps(cust_notes)

    now = datetime.datetime.utcnow()

    # 7. Deduct Inventory & Log Stock Movements for Stocker
    for r_item in resolved_line_items:
        v_id = r_item["variant_id"]
        if not v_id:
            continue
        qty_num = r_item["quantity"]
        inv_stmt = (
            select(InventoryItem)
            .where(
                InventoryItem.organization_id == target_org,
                InventoryItem.product_variant_id == v_id
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
                organization_id=target_org,
                inventory_item_id=inv_rec.id,
                type="SALE",
                quantity=qty_num,
                balance_after=bal,
                reference_type="SALE",
                reference_id=sale_id,
                notes=f"Online Store Checkout {sale_num}",
                user_id=sale_user_id or "system",
                created_at=now,
            )
            db.add(mv)

            if inv_rec.reorder_point is not None and inv_rec.stock_on_hand <= Decimal(str(inv_rec.reorder_point)):
                low_stock_note = NotificationRecord(
                    id=str(uuid.uuid4()),
                    organization_id=target_org,
                    user_id=None,
                    channel="IN_APP",
                    type="LOW_STOCK_ALERT",
                    title="⚠️ Low Stock Alert",
                    message=f"Stock for '{r_item.get('name', 'Product')}' dropped to {bal} (reorder threshold: {inv_rec.reorder_point}).",
                    status="SENT",
                    is_read=False,
                    sent_at=now,
                    created_at=now,
                )
                db.add(low_stock_note)

    # 8. Auto-Dispatch Delivery Task
    dest_lat = payload.destLat if payload.destLat is not None else 11.5564
    dest_lng = payload.destLng if payload.destLng is not None else 104.9282
    deliv_addr = (payload.deliveryAddress or "Customer Address, Phnom Penh").strip()

    deliv_input = CreateDeliveryOrderInput(
        recipientName=name_clean,
        recipientPhone=phone_clean or "N/A",
        deliveryAddress=deliv_addr,
        destLat=dest_lat,
        destLng=dest_lng,
        codAmount=float(grand_total) if pay_method == "CASH" else 0.0,
        deliveryFee=2.50,
        saleId=sale_id,
        notes=f"Storefront Order {sale_num} ({len(line_entities)} items)"
    )
    deliv_order = delivery_service.create_order(org_id=target_org, inp=deliv_input)

    # 9. Real-Time Alert to Delivery Couriers & Fleet
    deliv_alert = NotificationRecord(
        id=str(uuid.uuid4()),
        organization_id=target_org,
        user_id=None,
        channel="IN_APP",
        type="ORDER_CREATED",
        title=f"🚚 New Delivery Order #{sale_num}",
        message=f"Customer {name_clean} ordered {len(line_entities)} items for delivery to {deliv_addr}. Tracking: {deliv_order.trackingNumber}.",
        status="SENT",
        is_read=False,
        sent_at=now,
        created_at=now,
        metadata_={
            "saleId": sale_id,
            "saleNumber": sale_num,
            "trackingNumber": deliv_order.trackingNumber,
            "deliveryOrderId": deliv_order.id,
            "recipientName": name_clean,
            "recipientPhone": phone_clean,
            "deliveryAddress": deliv_addr,
            "targetAudience": "DELIVERY",
        }
    )
    db.add(deliv_alert)

    # 10. Real-Time Alert to Warehouse Stocker (Picking & Packing)
    items_summary = ", ".join([f"{li.quantity}x {li.product_name}" for li in line_entities[:3]])
    if len(line_entities) > 3:
        items_summary += f" +{len(line_entities) - 3} more"

    stocker_alert = NotificationRecord(
        id=str(uuid.uuid4()),
        organization_id=target_org,
        user_id=None,
        channel="IN_APP",
        type="ORDER_CREATED",
        title=f"📦 Customer Order Ready to Pick #{sale_num}",
        message=f"Order #{sale_num} requires warehouse stock picking: {items_summary}. Destination: {deliv_addr}.",
        status="SENT",
        is_read=False,
        sent_at=now,
        created_at=now,
        metadata_={
            "saleId": sale_id,
            "saleNumber": sale_num,
            "customerName": name_clean,
            "itemCount": len(line_entities),
            "targetAudience": "STOCKER",
            "wmsStatus": "PENDING_PICKING",
        }
    )
    db.add(stocker_alert)

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
        itemCount=len(line_entities),
        customerName=name_clean,
        paymentStatus="PAID",
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
            ) for li in line_entities
        ],
        payments=[
            SalePaymentDto(
                id=payment.id,
                amount=float(payment.amount),
                method=payment.method,
                status=payment.status,
                reference=payment.reference
            )
        ]
    )


@router.get("/sales/customer-orders", response_model=PaginatedResponse[SaleDto])
@router.get("/customers/orders", response_model=PaginatedResponse[SaleDto])
async def get_customer_orders(
    email: str,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches past sales orders and invoices for a customer directly from PostgreSQL.
    """
    email_clean = email.strip().lower()

    # Find customer
    cust_res = await db.execute(
        select(Customer).where(func.lower(Customer.email) == email_clean).limit(1)
    )
    customer = cust_res.scalar_one_or_none()

    if not customer:
        return PaginatedResponse(items=[], meta=PageMeta(page=1, limit=50, total=0, totalPages=1), total=0)

    sale_filters = [Sale.customer_id == customer.id]
    if user and user.organization_id:
        sale_filters.append(Sale.organization_id == user.organization_id)
    elif customer.organization_id:
        sale_filters.append(Sale.organization_id == customer.organization_id)

    stmt = (
        select(Sale)
        .where(*sale_filters)
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
            customerName=customer.name,
            paymentStatus=_derive_payment_status(s.payments, s.grand_total),
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

