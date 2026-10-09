import json
import uuid
import secrets
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_optional_user, TenantUser
from app.core.config import settings
from app.core.payway import PaywayService

from ..models import Sale, SaleLineItem, SalePayment
from ..schemas import SaleDto, StoreCheckoutInput, SaleLineItemDto, SalePaymentDto
from ..services.checkout_orchestrator import CheckoutOrchestrator
from app.modules.organizations.models import PaywayConfig

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
    
    # The sale remains pending while the warehouse prepares its delivery.
    pay_method = "QR" if any(x in payload.paymentMethod.upper() for x in ["QR", "PAYWAY", "BAKONG"]) else "CASH"
    sale_initial_status = "DRAFT" if pay_method == "QR" else "COMPLETED"
    payment_initial_status = "PENDING" if pay_method == "QR" else "COMPLETED"

    sale = Sale(
        id=sale_id,
        organization_id=target_org,
        location_id=None,
        customer_id=customer.id,
        user_id=sale_user_id,
        sale_number=sale_num,
        channel=payload.channel,
        order_type=payload.orderType,
        table_number=payload.tableNumber,
        status=sale_initial_status,
        subtotal=subtotal,
        discount_total=Decimal("0.0"),
        tax_total=tax_total,
        grand_total=grand_total,
        currency="USD",
        notes=json.dumps(notes_dict),
        completed_at=utc_now() if sale_initial_status == "COMPLETED" else None,
    )
    db.add(sale)

    for li in line_entities:
        db.add(li)

    # 6. Create Payment Record
    payment = SalePayment(
        id=str(uuid.uuid4()),
        sale_id=sale_id,
        method=pay_method,
        status=payment_initial_status,
        provider="ABA PayWay" if pay_method == "QR" else "Pay by Cash",
        amount=grand_total,
        reference=f"TXN-{secrets.token_hex(4).upper()}",
        paid_at=utc_now() if payment_initial_status == "COMPLETED" else None,
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

    # 10. ABA PayWay KHQR Generation
    payment_qr_code = None
    payment_deeplink = None
    if pay_method == 'QR' or pay_method == 'KHQR':
        # Fetch dynamic PayWay config for this organization
        pw_config = (await db.execute(select(PaywayConfig).where(PaywayConfig.organization_id == target_org))).scalar_one_or_none()
        import os
        merchant_id = pw_config.merchant_id if pw_config else os.getenv("PAYWAY_MERCHANT_ID", "ec479308")
        api_key = pw_config.public_key if pw_config else os.getenv("PAYWAY_API_KEY", "E844DCD28210869E112E8A4AB674C296E2238C98")
        
        qr_result = await PaywayService.generate_qr(
            merchant_id=merchant_id,
            api_key=api_key,
            transaction_id=sale.sale_number,
            amount=float(grand_total),
            items=[{"name": str(li.product_name), "quantity": str(int(li.quantity)), "price": f"{float(li.unit_price):.2f}"} for li in line_entities],
            firstname=name_clean.split(" ")[0] if name_clean else "Customer",
            lastname=" ".join(name_clean.split(" ")[1:]) if name_clean and len(name_clean.split(" ")) > 1 else "",
            email=email_clean or "customer@example.com",
            phone=phone_clean or "012345678"
        )
        if qr_result.get("success"):
            qr_img = qr_result.get("qr_image", "")
            if qr_img.startswith("data:image/png;base64,"):
                payment_qr_code = qr_img.split(",", 1)[1]
            else:
                payment_qr_code = qr_img
            payment_deeplink = qr_result.get("abapay_deeplink")

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
        paymentStatus=payment_initial_status,
        paymentQrCode=payment_qr_code,
        paymentDeeplink=payment_deeplink,
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
        paymentQrCode=payment_qr_code,
        paymentDeeplink=payment_deeplink
    )

@router.post("/sales/payway-webhook")
async def payway_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Webhook endpoint to receive payment confirmation from ABA PayWay.
    """
    # PayWay usually sends a multipart/form-data or application/x-www-form-urlencoded
    form_data = await request.form()
    payload = dict(form_data)
    
    # Alternatively it could be JSON
    if not payload:
        try:
            payload = await request.json()
        except Exception:
            pass

    if not payload:
        return {"status": "error", "message": "No payload"}

    # For ABA PayWay v3 encrypted pushbacks, the payload might contain 'response'
    # For standard unencrypted pushbacks, the payload might contain 'tran_id'
    # Regardless of how we get it, if 'tran_id' is missing but 'response' exists, we could decrypt it
    # BUT instead of dealing with RSA decryption complexity, we extract the tran_id from URL query params (if passed) 
    # or just parse it if it's available.
    
    tran_id = payload.get("tran_id")
    if not tran_id and "response" in payload:
        # We can decrypt RSA or since we might not have the full key, 
        # let's assume tran_id is sent in query params for pushback URLs usually?
        # If not, let's try to extract it from the payload if possible, or return error.
        # Actually in PayWay V3, pushback URL usually has query params ?tran_id=XXX attached by merchant during generation.
        tran_id = request.query_params.get("tran_id")
        
    if not tran_id:
        return {"status": "error", "message": "Missing tran_id"}

    # Find the sale by sale_number (which was passed as transaction_id)
    # We must do this FIRST to find which organization this transaction belongs to!
    stmt = select(Sale).where(Sale.sale_number == tran_id)
    result = await db.execute(stmt)
    sale = result.scalar_one_or_none()

    if not sale:
        return {"status": "error", "message": "Sale not found"}

    if sale.status == "COMPLETED":
        return {"status": "ok", "message": "Already completed"}

    # Fetch dynamic PayWay config for this organization
    pw_config = (await db.execute(select(PaywayConfig).where(PaywayConfig.organization_id == sale.organization_id))).scalar_one_or_none()
    import os
    merchant_id = pw_config.merchant_id if pw_config else os.getenv("PAYWAY_MERCHANT_ID", "ec479308")
    api_key = pw_config.public_key if pw_config else os.getenv("PAYWAY_API_KEY", "E844DCD28210869E112E8A4AB674C296E2238C98")

    # Proactive Fraud Prevention: Ping ABA PayWay to verify the actual payment status
    # This prevents any fake webhook calls from marking orders as paid.
    is_verified = await PaywayService.verify_transaction(merchant_id=merchant_id, api_key=api_key, tran_id=tran_id)
    if not is_verified:
        raise HTTPException(status_code=400, detail="Fraud detected: transaction not successful on ABA server.")

    # Update Sale Status
    sale.status = "COMPLETED"
    sale.completed_at = utc_now()

    # Find and update SalePayment
    pay_stmt = select(SalePayment).where(SalePayment.sale_id == sale.id)
    pay_result = await db.execute(pay_stmt)
    payment = pay_result.scalar_one_or_none()

    if payment:
        payment.status = "COMPLETED"
        payment.paid_at = utc_now()

    await db.commit()
    
    # ABA Payway expects a success response
    return {"status": "success", "message": "Payment confirmed"}
