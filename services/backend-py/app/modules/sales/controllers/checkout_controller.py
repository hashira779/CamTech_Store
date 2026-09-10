import json
import uuid
import secrets
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_optional_user, TenantUser
from app.core.config import settings
from app.modules.organizations.models import Organization
from app.modules.customers.models import Customer
from app.modules.identity.models import User
from app.modules.catalog.models import ProductVariant, Product
from app.modules.inventory.models import InventoryItem, StockMovement
from app.models.entities import NotificationRecord
from app.services import delivery_service as delivery_svc
from app.schemas.dto import CreateDeliveryOrderInput

from ..models import Sale, SaleLineItem, SalePayment
from ..schemas import SaleDto, StoreCheckoutInput, SaleLineItemDto, SalePaymentDto

router = APIRouter(tags=["Storefront Checkout"])

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

    phone_clean = payload.customerPhone.strip() if payload.customerPhone else None
    email_clean = payload.customerEmail.strip().lower() if payload.customerEmail else (f"{phone_clean}@customer.camtech.cam" if phone_clean else f"guest_{secrets.token_hex(4)}@customer.camtech.cam")
    name_clean = payload.customerName.strip() or email_clean.split("@")[0]

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
    sale_num = f"ORD-{utc_now().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
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
        completed_at=utc_now(),
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
        paid_at=utc_now(),
    )
    db.add(payment)
    await db.flush()

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

    now = utc_now()

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
    deliv_order = await delivery_svc.create_order(db, org_id=target_org, inp=deliv_input)

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
        ],
        trackingNumber=deliv_order.trackingNumber,
        deliveryOrderId=deliv_order.id,
        deliveryStatus=deliv_order.status,
        deliveryAddress=deliv_order.deliveryAddress,
    )
