import json
import uuid
import secrets
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_optional_user, TenantUser
from app.core.config import settings
from app.core.payway import PaywayService

import os
from ..models import Sale, SaleLineItem, SalePayment
from ..schemas import SaleDto, StoreCheckoutInput, SaleLineItemDto, SalePaymentDto
from ..services.checkout_orchestrator import CheckoutOrchestrator
from app.modules.organizations.models import PaywayConfig

router = APIRouter(tags=["Storefront Checkout"])

DEFAULT_PAYWAY_MERCHANT_ID = os.getenv("PAYWAY_MERCHANT_ID", "ec479308")
DEFAULT_PAYWAY_API_KEY = os.getenv("PAYWAY_API_KEY", "E844DCD28210869E112E8A4AB674C296E2238C98")

def _resolve_payway_credentials(pw_config: Optional[PaywayConfig]):
    merchant_id = (
        (pw_config.merchant_id if pw_config and pw_config.merchant_id else None)
        or DEFAULT_PAYWAY_MERCHANT_ID
    )
    api_key = (
        (pw_config.public_key if pw_config and pw_config.public_key else None)
        or DEFAULT_PAYWAY_API_KEY
    )
    is_prod = pw_config.is_production if pw_config else (os.getenv("PAYWAY_ENV", "").lower() == "production")
    return merchant_id, api_key, is_prod


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

    # 8. Inventory & Delivery Dispatch:
    # CRITICAL PRODUCTION RULE: Unpaid online orders (QR/ABA) MUST NOT deduct inventory
    # or dispatch delivery fleet until payment is verified and confirmed!
    # Only Cash on Delivery (COD/CASH) dispatches immediately upon placement.
    deliv_order = None
    if pay_method != "QR":
        # Deduct Inventory & Log Stock Movements immediately for COD
        await CheckoutOrchestrator.process_inventory_and_alerts(
            db, target_org, sale_id, sale_num, sale_user_id, resolved_line_items
        )

        # Trigger Delivery Dispatch immediately for COD
        deliv_order, deliv_addr = await CheckoutOrchestrator.trigger_dispatch_and_notifications(
            db, target_org, payload, sale_id, sale_num, name_clean, phone_clean, line_entities, grand_total, pay_method
        )

    # 9. Real ABA PayWay V1 / NBC Bakong KHQR Generation
    payment_qr_code = None
    payment_deeplink = None
    if pay_method == "QR":
        # Fetch dynamic PayWay config for this organization
        pw_config = (
            await db.execute(select(PaywayConfig).where(PaywayConfig.organization_id == target_org))
        ).scalar_one_or_none()
        merchant_id, api_key, is_prod = _resolve_payway_credentials(pw_config)

        qr_result = await PaywayService.generate_qr(
            merchant_id=merchant_id,
            api_key=api_key,
            transaction_id=sale.sale_number,
            amount=float(grand_total),
            items=[
                {
                    "name": str(li.product_name),
                    "quantity": int(li.quantity),
                    "price": float(li.unit_price),
                }
                for li in line_entities
            ],
            firstname=name_clean.split(" ")[0] if name_clean else "Customer",
            lastname=" ".join(name_clean.split(" ")[1:]) if name_clean and len(name_clean.split(" ")) > 1 else "",
            email=email_clean or "customer@camtech.cam",
            phone=phone_clean or "012345678",
            currency=sale.currency or "USD",
            is_production=is_prod,
        )

        if qr_result.get("success"):
            payment_qr_code = qr_result.get("qr_image")
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
                lineTotal=float(li.line_total),
            )
            for li in line_entities
        ],
        payments=[
            SalePaymentDto(
                id=payment.id,
                amount=float(payment.amount),
                method=payment.method,
                status=payment.status,
                reference=payment.reference,
            )
        ],
        trackingNumber=deliv_order.trackingNumber if deliv_order else None,
        deliveryOrderId=deliv_order.id if deliv_order else None,
        deliveryStatus=deliv_order.status if deliv_order else "PENDING_PAYMENT",
        deliveryAddress=deliv_order.deliveryAddress if deliv_order else payload.deliveryAddress,
    )

@router.get("/sales/orders/{sale_id}/payment-status")
async def get_order_payment_status(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Real-Time Payment Status Polling for Storefront Checkout.
    Allows customers scanning the ABA / Bakong QR code to detect
    payment completion instantly.
    """
    stmt = (
        select(Sale)
        .options(selectinload(Sale.line_items))
        .where((Sale.id == sale_id) | (Sale.sale_number == sale_id))
    )
    result = await db.execute(stmt)
    sale = result.scalar_one_or_none()

    if not sale:
        raise HTTPException(status_code=404, detail="Order not found")

    pay_stmt = select(SalePayment).where(SalePayment.sale_id == sale.id)
    pay_res = await db.execute(pay_stmt)
    payment = pay_res.scalar_one_or_none()

    # If already completed in DB
    if sale.status == "COMPLETED":
        return {
            "paid": True,
            "status": "COMPLETED",
            "saleId": sale.id,
            "saleNumber": sale.sale_number,
            "amount": float(sale.grand_total),
        }

    # If pending, attempt proactive check with ABA PayWay server
    pw_config = (
        await db.execute(select(PaywayConfig).where(PaywayConfig.organization_id == sale.organization_id))
    ).scalar_one_or_none()

    merchant_id, api_key, is_prod = _resolve_payway_credentials(pw_config)
    if merchant_id and api_key:
        is_verified = await PaywayService.verify_transaction(
            merchant_id=merchant_id,
            api_key=api_key,
            tran_id=sale.sale_number,
            is_production=is_prod,
        )
        if is_verified:
            await _finalize_paid_sale(db, sale, payment)
            return {
                "paid": True,
                "status": "COMPLETED",
                "saleId": sale.id,
                "saleNumber": sale.sale_number,
                "amount": float(sale.grand_total),
            }

    return {
        "paid": False,
        "status": sale.status,
        "saleId": sale.id,
        "saleNumber": sale.sale_number,
        "amount": float(sale.grand_total),
    }

@router.post("/sales/orders/{sale_id}/confirm-payment")
async def confirm_order_payment(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Direct payment confirmation handler (called upon successful client verification,
    webhook callback, or manual customer acknowledgement).
    Finalizes the Sale, deducts inventory, and dispatches the delivery fleet.
    """
    stmt = (
        select(Sale)
        .options(selectinload(Sale.line_items))
        .where((Sale.id == sale_id) | (Sale.sale_number == sale_id))
    )
    result = await db.execute(stmt)
    sale = result.scalar_one_or_none()

    if not sale:
        raise HTTPException(status_code=404, detail="Order not found")

    pay_stmt = select(SalePayment).where(SalePayment.sale_id == sale.id)
    pay_res = await db.execute(pay_stmt)
    payment = pay_res.scalar_one_or_none()

    if sale.status != "COMPLETED":
        await _finalize_paid_sale(db, sale, payment)

    return {
        "success": True,
        "status": "COMPLETED",
        "saleId": sale.id,
        "saleNumber": sale.sale_number,
        "message": "Payment confirmed and order dispatched to delivery fleet.",
    }

async def _finalize_paid_sale(db: AsyncSession, sale: Sale, payment: Optional[SalePayment]):
    """
    Internal helper to transition an unpaid Sale to COMPLETED:
    1. Updates sale.status = COMPLETED
    2. Updates payment.status = COMPLETED
    3. Deducts warehouse stock
    4. Dispatches delivery fleet
    """
    now = utc_now()
    sale.status = "COMPLETED"
    sale.completed_at = now

    if payment:
        payment.status = "COMPLETED"
        payment.paid_at = now

    # Parse customer and delivery notes
    notes_data = {}
    if sale.notes:
        try:
            notes_data = json.loads(sale.notes)
        except Exception:
            pass

    name_clean = notes_data.get("customerName", "Valued Customer")
    phone_clean = notes_data.get("customerPhone", "N/A")
    deliv_addr = notes_data.get("deliveryAddress", "Customer Address, Phnom Penh")

    # Build line items dictionary for inventory deduction
    resolved_lines = [
        {
            "variant_id": li.product_variant_id,
            "quantity": li.quantity,
            "name": li.product_name,
        }
        for li in (sale.line_items or [])
    ]

    await CheckoutOrchestrator.process_inventory_and_alerts(
        db, sale.organization_id, sale.id, sale.sale_number, sale.user_id, resolved_lines
    )

    from ..schemas import StoreCheckoutInput
    dummy_payload = StoreCheckoutInput(
        customerName=name_clean,
        customerPhone=phone_clean,
        deliveryAddress=deliv_addr,
        items=[],
        paymentMethod="ABA_PAYWAY",
    )

    await CheckoutOrchestrator.trigger_dispatch_and_notifications(
        db,
        sale.organization_id,
        dummy_payload,
        sale.id,
        sale.sale_number,
        name_clean,
        phone_clean,
        sale.line_items or [],
        sale.grand_total,
        "QR",
    )

    await db.commit()

@router.post("/sales/payway-webhook")
async def payway_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Webhook endpoint to receive payment confirmation from ABA PayWay.
    """
    form_data = await request.form()
    payload = dict(form_data)
    
    if not payload:
        try:
            payload = await request.json()
        except Exception:
            pass

    if not payload:
        return {"status": "error", "message": "No payload"}

    tran_id = payload.get("tran_id") or request.query_params.get("tran_id")
    if not tran_id:
        return {"status": "error", "message": "Missing tran_id"}

    stmt = (
        select(Sale)
        .options(selectinload(Sale.line_items))
        .where(Sale.sale_number == tran_id)
    )
    result = await db.execute(stmt)
    sale = result.scalar_one_or_none()

    if not sale:
        return {"status": "error", "message": "Sale not found"}

    if sale.status == "COMPLETED":
        return {"status": "ok", "message": "Already completed"}

    pw_config = (
        await db.execute(select(PaywayConfig).where(PaywayConfig.organization_id == sale.organization_id))
    ).scalar_one_or_none()

    merchant_id, api_key, is_prod = _resolve_payway_credentials(pw_config)

    if merchant_id and api_key:
        is_verified = await PaywayService.verify_transaction(
            merchant_id=merchant_id, api_key=api_key, tran_id=tran_id, is_production=is_prod
        )
        if not is_verified:
            raise HTTPException(status_code=400, detail="Transaction verification failed on ABA server.")

    pay_stmt = select(SalePayment).where(SalePayment.sale_id == sale.id)
    pay_res = await db.execute(pay_stmt)
    payment = pay_res.scalar_one_or_none()

    await _finalize_paid_sale(db, sale, payment)
    return {"status": "success", "message": "Payment confirmed"}
