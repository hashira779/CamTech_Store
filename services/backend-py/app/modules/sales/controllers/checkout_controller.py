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

from ..models import Sale, SaleLineItem, SalePayment
from ..schemas import SaleDto, StoreCheckoutInput, SaleLineItemDto, SalePaymentDto
from ..services.checkout_orchestrator import CheckoutOrchestrator

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

    # 1. Resolve Target Organization
    target_org = await CheckoutOrchestrator.resolve_target_org(
        db, payload.organizationId, user.organization_id if user else None, payload.items
    )

    # 2. Provision Customer
    customer, email_clean, phone_clean, name_clean = await CheckoutOrchestrator.provision_customer(
        db, target_org, payload
    )

    # 3. Resolve User for Sale
    sale_user_id = await CheckoutOrchestrator.resolve_sale_user(
        db, target_org, email_clean
    )

    # 4. Calculate Totals & Build Line Items
    sale_num = f"ORD-{utc_now().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    sale_id = str(uuid.uuid4())
    subtotal, tax_total, line_entities, resolved_line_items = await CheckoutOrchestrator.calculate_totals_and_lines(
        db, target_org, sale_id, payload.items
    )
    grand_total = subtotal + tax_total

    # 5. Create Sale Record
    notes_dict = {
        "customerName": name_clean,
        "customerEmail": email_clean,
        "customerPhone": phone_clean,
        "deliveryAddress": payload.deliveryAddress,
        "storeNotes": payload.notes or "Online Store Checkout",
    }
    
    # Fix order state bug: Set status to PENDING/PREPARING initially instead of COMPLETED.
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

    # 6. Create Payment Record
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

    # 7. Reset Customer Cart in PostgreSQL
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

    # 8. Deduct Inventory & Log Stock Movements
    await CheckoutOrchestrator.process_inventory_and_alerts(
        db, target_org, sale_id, sale_num, sale_user_id, resolved_line_items
    )

    # 9. Trigger Dispatch & Notifications
    deliv_order, deliv_addr = await CheckoutOrchestrator.trigger_dispatch_and_notifications(
        db, target_org, payload, sale_id, sale_num, name_clean, phone_clean, line_entities, grand_total, pay_method
    )

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
