import hashlib
import hmac
import json
import time
import uuid
import secrets
from datetime import timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, BackgroundTasks, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_optional_user, TenantUser
from app.core.config import settings
from app.core.payway import PaywayService
from app.core.bakong import BakongService

from ..models import Sale, SaleLineItem, SalePayment
from ..schemas import SaleDto, StoreCheckoutInput, SaleLineItemDto, SalePaymentDto
from ..services.checkout_orchestrator import CheckoutOrchestrator
from app.modules.organizations.payment_config import resolve_store_payment_config

router = APIRouter(tags=["Storefront Checkout"])

QR_LIFETIME_SECONDS = 15 * 60
QR_SETTLEMENT_GRACE_SECONDS = 60
BANK_CHECK_OFFSETS_SECONDS = (5, 15, 45, 120)
WEBHOOK_MAX_SKEW_SECONDS = 300

_METHOD_LABELS = {"ABA_PAYWAY": "ABA PayWay", "BAKONG": "NBC Bakong KHQR", "COD": "Cash on Delivery"}


def _requested_qr_method(payment_method: str) -> Optional[str]:
    """Maps a checkout paymentMethod to the online QR provider it needs, or None for cash."""
    pm = (payment_method or "").upper()
    if "BAKONG" in pm:
        return "BAKONG"
    if "QR" in pm or "PAYWAY" in pm:
        return "ABA_PAYWAY"
    return None


@router.get("/sales/payment-methods")
async def get_store_payment_methods(
    organization_id: str = Query(..., alias="organizationId"),
    db: AsyncSession = Depends(get_db),
):
    """Public: the payment methods this store can accept (id or slug). QR methods appear only when the store configured its own merchant."""
    org_id = await CheckoutOrchestrator.resolve_target_org(db, organization_id, None, [])
    cfg = await resolve_store_payment_config(db, org_id)
    return {
        "organizationId": org_id,
        "methods": [{"code": m, "label": _METHOD_LABELS[m]} for m in cfg.methods],
    }


async def _replay_checkout(db: AsyncSession, target_org: str, idempotency_key: str) -> Optional[SaleDto]:
    """Returns the order already placed with this Idempotency-Key, so a retried checkout never creates a second order."""
    existing = (
        await db.execute(
            select(Sale)
            .where(Sale.organization_id == target_org, Sale.idempotency_key == idempotency_key)
            .options(selectinload(Sale.line_items), selectinload(Sale.payments))
        )
    ).scalar_one_or_none()
    if not existing:
        return None
    notes = {}
    try:
        notes = json.loads(existing.notes) if existing.notes else {}
    except Exception:
        pass
    payment = existing.payments[0] if existing.payments else None
    return SaleDto(
        id=existing.id,
        idempotencyKey=existing.idempotency_key,
        saleNumber=existing.sale_number,
        channel=existing.channel,
        status=existing.status,
        subtotal=float(existing.subtotal),
        taxTotal=float(existing.tax_total),
        discountTotal=float(existing.discount_total),
        grandTotal=float(existing.grand_total),
        currency=existing.currency,
        itemCount=len(existing.line_items),
        customerName=notes.get("customerName"),
        paymentStatus=payment.status if payment else "PENDING",
        paymentDeeplink=payment.external_id if payment else None,
        createdAt=existing.created_at.isoformat(),
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
            for li in existing.line_items
        ],
        payments=[
            SalePaymentDto(
                id=p.id,
                amount=float(p.amount),
                method=p.method,
                status=p.status,
                reference=p.reference,
                provider=p.provider,
                qrString=p.qr_string,
                paidAt=p.paid_at.isoformat() if p.paid_at else None,
            )
            for p in existing.payments
        ],
        deliveryAddress=notes.get("deliveryAddress"),
    )


@router.post("/sales/store-checkout", response_model=SaleDto)
@router.post("/sales/public-checkout", response_model=SaleDto)
async def store_checkout(
    payload: StoreCheckoutInput,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Storefront Online Customer Checkout Endpoint.
    Records a completed Sale, Line Items, and Payment directly in PostgreSQL,
    linked to the customer account, and resets active shopping cart.
    Send an `Idempotency-Key` header to make retries safe: the same key returns the original order.
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

    idempotency_key = (idempotency_key or "").strip() or None
    if idempotency_key:
        replay = await _replay_checkout(db, target_org, idempotency_key)
        if replay:
            return replay

    # Online QR payment needs the store's own merchant account; there is no platform fallback.
    qr_method = _requested_qr_method(payload.paymentMethod)
    pay_cfg = await resolve_store_payment_config(db, target_org)
    if qr_method and qr_method not in pay_cfg.methods:
        raise HTTPException(
            status_code=400,
            detail=f"{_METHOD_LABELS[qr_method]} is not set up for this store. Available: "
            + ", ".join(_METHOD_LABELS[m] for m in pay_cfg.methods) + ".",
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
    pay_method = "QR" if qr_method else "CASH"
    sale_initial_status = "DRAFT" if pay_method == "QR" else "COMPLETED"
    payment_initial_status = "PENDING" if pay_method == "QR" else "COMPLETED"

    sale = Sale(
        id=sale_id,
        idempotency_key=idempotency_key,
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
    provider_name = "Pay by Cash"
    if "BAKONG" in payload.paymentMethod.upper():
        provider_name = "NBC Bakong"
    elif pay_method == "QR":
        provider_name = "ABA PayWay"

    payment = SalePayment(
        id=str(uuid.uuid4()),
        sale_id=sale_id,
        method=pay_method,
        status=payment_initial_status,
        provider=provider_name,
        amount=grand_total,
        reference=f"TXN-{secrets.token_hex(4).upper()}",
        paid_at=utc_now() if payment_initial_status == "COMPLETED" else None,
    )
    db.add(payment)
    try:
        await db.flush()
    except IntegrityError:
        # A concurrent request with the same Idempotency-Key won the insert: hand back its order.
        await db.rollback()
        replay = await _replay_checkout(db, target_org, idempotency_key) if idempotency_key else None
        if replay:
            return replay
        raise HTTPException(status_code=409, detail="This Idempotency-Key is already in use.")

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
    # CRITICAL PRODUCTION RULE: Unpaid online orders (QR/ABA/Bakong) MUST NOT deduct inventory
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
        if qr_method == "BAKONG":
            bk = pay_cfg.bakong
            # Local EMVCo generation (no Bakong API call). The QR is always issued in the SALE's currency:
            # there is no exchange-rate source, and pairing a USD total with KHR would under-charge ~4000x.
            bakong_res = BakongService.generate_khqr(
                merchant_name=bk.merchant_name,
                account_id=bk.account_id,
                amount=float(grand_total),
                currency=sale.currency or "USD",
                merchant_city=bk.merchant_city,
                bill_number=sale.sale_number,
                expires_in_seconds=QR_LIFETIME_SECONDS,
                account_type=bk.account_type,
                merchant_id=bk.merchant_id,
                acquiring_bank=bk.acquiring_bank,
            )
            if not bakong_res.get("success"):
                raise HTTPException(status_code=502, detail=f"Could not generate the Bakong KHQR code: {bakong_res.get('message')}")
            payment_qr_code = bakong_res.get("qr_image")
            payment.reference = f"MD5:{bakong_res['md5']}"
            payment.provider = "NBC Bakong"
            payment.qr_string = bakong_res.get("qr_string")
            notes_dict["bakong_md5"] = bakong_res["md5"]
            notes_dict["qrExpiresAtMs"] = bakong_res["expires_at_ms"]
            sale.notes = json.dumps(notes_dict)
            db.add(sale)
            db.add(payment)
        else:
            pw = pay_cfg.payway
            qr_result = await PaywayService.generate_qr(
                merchant_id=pw.merchant_id,
                api_key=pw.api_key,
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
                is_production=pw.is_production,
            )
            if not qr_result.get("success"):
                raise HTTPException(status_code=502, detail="ABA PayWay could not create the payment QR. Please try again or choose another method.")
            payment_qr_code = qr_result.get("qr_image")
            payment_deeplink = qr_result.get("abapay_deeplink")
            payment.reference = sale.sale_number
            payment.provider = "ABA PayWay"
            payment.qr_string = qr_result.get("qr_string")
            payment.external_id = qr_result.get("abapay_deeplink")
            notes_dict["abapay_deeplink"] = payment_deeplink
            notes_dict["qrExpiresAtMs"] = int(time.time() * 1000) + QR_LIFETIME_SECONDS * 1000
            sale.notes = json.dumps(notes_dict)
            db.add(sale)
            db.add(payment)

    # CRITICAL DATA INTEGRITY: Persist order, line items, and payment record permanently in PostgreSQL
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
                provider=payment.provider,
                qrString=payment.qr_string,
                paidAt=payment.paid_at.isoformat() if payment.paid_at else None,
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

    base = {"saleId": sale.id, "saleNumber": sale.sale_number, "amount": float(sale.grand_total)}
    if sale.status == "COMPLETED":
        return {**base, "paid": True, "status": "COMPLETED", "provider": payment.provider if payment else "UNKNOWN"}
    if sale.status == "VOIDED":
        return {**base, "paid": False, "status": "VOIDED", "expired": True, "provider": payment.provider if payment else None,
                "message": "This payment QR has expired."}

    # Rate-limit resilience: the bank is asked only on the backoff schedule, however often clients poll.
    notes = _sale_notes(sale)
    now_ms = int(time.time() * 1000)
    checks = int(notes.get("bankChecks", 0))
    expires_ms = int(notes.get("qrExpiresAtMs") or 0)
    expired = bool(expires_ms) and now_ms > expires_ms + QR_SETTLEMENT_GRACE_SECONDS * 1000
    next_ms = int(notes.get("nextBankCheckAtMs") or _next_check_ms(sale, 0))
    throttled = {**base, "paid": False, "status": sale.status, "provider": payment.provider if payment else None,
                 "message": "Awaiting customer payment"}
    if now_ms < next_ms and not expired:
        return {**throttled, "retryAfterSeconds": max(1, (next_ms - now_ms + 999) // 1000)}

    # Claim this check slot atomically (compare-and-swap on the row) so concurrent pollers in the
    # same slot make exactly one bank call between them.
    old_notes = sale.notes
    notes["bankChecks"] = checks + 1
    notes["nextBankCheckAtMs"] = _next_check_ms(sale, checks + 1)
    claimed = await db.execute(
        update(Sale)
        .where(Sale.id == sale.id, Sale.notes == old_notes if old_notes is not None else Sale.notes.is_(None))
        .values(notes=json.dumps(notes))
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    if claimed.rowcount == 0:
        return {**throttled, "retryAfterSeconds": 1}
    sale.notes = json.dumps(notes)

    verified, provider, message = await _verify_with_bank(db, sale, payment)
    if verified:
        await _finalize_paid_sale(db, sale, payment)
        return {**base, "paid": True, "status": "COMPLETED", "provider": provider}

    if expired:
        # Final check done and unpaid: stop polling for good. A late verified webhook can still complete it.
        await db.execute(
            update(Sale).where(Sale.id == sale.id, Sale.status == "DRAFT").values(status="VOIDED")
        )
        if payment and payment.status == "PENDING":
            payment.status = "FAILED"
        await db.commit()
        return {**base, "paid": False, "status": "VOIDED", "expired": True, "provider": provider,
                "message": "This payment QR has expired."}

    return {**base, "paid": False, "status": sale.status, "provider": provider, "message": message,
            "retryAfterSeconds": max(1, (notes["nextBankCheckAtMs"] - now_ms + 999) // 1000)}


def _sale_notes(sale: Sale) -> dict:
    try:
        n = json.loads(sale.notes) if sale.notes else {}
        return n if isinstance(n, dict) else {}
    except Exception:
        return {}


def _next_check_ms(sale: Sale, checks_done: int) -> int:
    """Bank-check schedule, as offsets from order creation: 5s, 15s, 45s, 120s, then every 120s."""
    created_ms = int(sale.created_at.replace(tzinfo=timezone.utc).timestamp() * 1000) if sale.created_at else int(time.time() * 1000)
    if checks_done < len(BANK_CHECK_OFFSETS_SECONDS):
        offset = BANK_CHECK_OFFSETS_SECONDS[checks_done]
    else:
        offset = BANK_CHECK_OFFSETS_SECONDS[-1] + (checks_done - len(BANK_CHECK_OFFSETS_SECONDS) + 1) * BANK_CHECK_OFFSETS_SECONDS[-1]
    return created_ms + offset * 1000


def _bakong_md5_of(sale: Sale, payment: Optional[SalePayment]) -> Optional[str]:
    """The KHQR MD5 recorded at checkout for a Bakong order, or None for a PayWay order."""
    if payment and payment.reference and payment.reference.startswith("MD5:"):
        return payment.reference[4:].strip()
    try:
        n_data = json.loads(sale.notes) if sale.notes else {}
        return n_data.get("bakong_md5") if isinstance(n_data, dict) else None
    except Exception:
        return None


async def _verify_with_bank(db: AsyncSession, sale: Sale, payment: Optional[SalePayment]):
    """
    Asks the store's own payment provider whether this order was paid.
    Returns (verified, provider_label, message). Never verifies against platform credentials.
    """
    cfg = await resolve_store_payment_config(db, sale.organization_id)
    md5 = _bakong_md5_of(sale, payment)
    if md5 or (payment and payment.provider == "NBC Bakong"):
        if not md5:
            return False, "NBC Bakong", "No KHQR reference recorded for this order."
        res = await BakongService.check_transaction_by_md5(md5, token=cfg.bakong.token if cfg.bakong else None)
        if not res.get("verified"):
            return False, "NBC Bakong", res.get("message") or "Awaiting customer payment"
        # The MD5 already binds payee, amount and bill number. `toAccountId` is NOT compared: per the NBC
        # Open API sample it can be an intermediary ("bridge_account@devb"), so matching it would reject real payments.
        data = res.get("data") or {}
        if data.get("amount") is not None and abs(float(data["amount"]) - float(sale.grand_total)) > 0.005:
            return False, "NBC Bakong", "Paid amount does not match the order total."
        if data.get("currency") and sale.currency and data["currency"].upper() != sale.currency.upper():
            return False, "NBC Bakong", "Paid currency does not match the order."
        return True, "NBC Bakong", "Payment confirmed"

    if not cfg.payway:
        return False, "ABA PayWay", "ABA PayWay is not configured for this store."
    ok = await PaywayService.verify_transaction(
        merchant_id=cfg.payway.merchant_id,
        api_key=cfg.payway.api_key,
        tran_id=sale.sale_number,
        is_production=cfg.payway.is_production,
    )
    return ok, "ABA PayWay", "Payment confirmed" if ok else "Funds have not been received in merchant account."

@router.post("/sales/orders/{sale_id}/confirm-payment")
async def confirm_order_payment(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Customer "I have paid" button. Goes through the same throttled, bank-verified path as polling,
    so repeated clicks can never exceed the bank-check schedule or complete an unpaid order.
    """
    st = await get_order_payment_status(sale_id, db)
    if not st.get("paid"):
        retry = st.get("retryAfterSeconds")
        raise HTTPException(
            status_code=400,
            detail=f"Transaction not yet verified by {st.get('provider') or 'the bank'}. {st.get('message', '')}"
            + (f" Checking again in {retry}s." if retry else ""),
        )
    return {
        "success": True,
        "status": "COMPLETED",
        "saleId": st["saleId"],
        "saleNumber": st["saleNumber"],
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
    # Atomic claim: the status poll, the webhook and the confirm call can race on the same sale.
    # Only the caller whose conditional UPDATE flips the row may deduct stock and dispatch delivery.
    claimed = await db.execute(
        update(Sale)
        .where(Sale.id == sale.id, Sale.status != "COMPLETED")
        .values(status="COMPLETED", completed_at=now)
        .execution_options(synchronize_session=False)
    )
    if claimed.rowcount == 0:
        await db.rollback()
        return False
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
        paymentMethod="BAKONG" if (payment and payment.provider == "NBC Bakong") else "ABA_PAYWAY",
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
    return True

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

    pay_stmt = select(SalePayment).where(SalePayment.sale_id == sale.id)
    pay_res = await db.execute(pay_stmt)
    payment = pay_res.scalar_one_or_none()

    # A webhook is only a hint: never finalize without positive verification from the store's own provider.
    is_verified, _, _ = await _verify_with_bank(db, sale, payment)
    if not is_verified:
        raise HTTPException(status_code=400, detail="Transaction verification failed on ABA server.")

    await _finalize_paid_sale(db, sale, payment)
    return {"status": "success", "message": "Payment confirmed"}


def bakong_webhook_signature(secret: str, timestamp: str, raw_body: bytes) -> str:
    """HMAC-SHA256 over "<timestamp>.<raw body>", hex — the scheme bank partners sign push notifications with."""
    return hmac.new(secret.encode("utf-8"), timestamp.encode("utf-8") + b"." + raw_body, hashlib.sha256).hexdigest()


@router.post("/sales/bakong-webhook")
async def bakong_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Push notification of a settled KHQR payment (primary path; polling is only the fallback).

    Headers: `X-Webhook-Timestamp` (unix seconds) and `X-Webhook-Signature` (hex HMAC-SHA256, see
    `bakong_webhook_signature`) keyed with the store's sealed webhook secret.
    Body: {"md5": "<khqr md5>", "amount": <number>, "currency": "USD|KHR", "toAccountId": "<account>"}.
    Idempotent: duplicate deliveries of a completed order return 200 without side effects.
    """
    raw = await request.body()
    ts = request.headers.get("x-webhook-timestamp", "")
    sig = request.headers.get("x-webhook-signature", "")
    try:
        body = json.loads(raw or b"{}")
        md5 = str(body.get("md5") or "").strip().lower()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    if not md5 or not ts or not sig:
        raise HTTPException(status_code=401, detail="Missing signature, timestamp or md5")

    payment = (await db.execute(select(SalePayment).where(SalePayment.reference == f"MD5:{md5}"))).scalar_one_or_none()
    sale = None
    if payment:
        sale = (await db.execute(
            select(Sale).options(selectinload(Sale.line_items)).where(Sale.id == payment.sale_id)
        )).scalar_one_or_none()
    if not sale:
        # Same answer as a bad signature: do not reveal which MD5s exist.
        raise HTTPException(status_code=401, detail="Signature verification failed")

    cfg = await resolve_store_payment_config(db, sale.organization_id)
    secret = cfg.bakong.webhook_secret if cfg.bakong else None
    try:
        fresh = abs(time.time() - int(ts)) <= WEBHOOK_MAX_SKEW_SECONDS
    except ValueError:
        fresh = False
    if not secret or not fresh or not hmac.compare_digest(bakong_webhook_signature(secret, ts, raw), sig.lower()):
        raise HTTPException(status_code=401, detail="Signature verification failed")

    if sale.status == "COMPLETED":
        return {"status": "ok", "message": "Already completed"}
    if body.get("amount") is not None and abs(float(body["amount"]) - float(sale.grand_total)) > 0.005:
        raise HTTPException(status_code=400, detail="Amount does not match the order total")
    if body.get("currency") and sale.currency and str(body["currency"]).upper() != sale.currency.upper():
        raise HTTPException(status_code=400, detail="Currency does not match the order")

    claimed = await _finalize_paid_sale(db, sale, payment)
    return {"status": "success" if claimed else "ok", "message": "Payment confirmed" if claimed else "Already completed"}
