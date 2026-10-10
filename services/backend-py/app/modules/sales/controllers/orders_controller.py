from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_optional_user, TenantUser
from app.modules.customers.models import Customer
from app.modules.delivery.models import DeliveryOrder, DeliveryDriver

from ..models import Sale
from ..schemas import (
    SaleDto, SaleLineItemDto, SalePaymentDto,
    PaginatedResponse, PageMeta
)
from .helpers import derive_payment_status

router = APIRouter(tags=["Customer Orders"])


@router.get("/sales/customer-orders", response_model=PaginatedResponse[SaleDto])
@router.get("/customers/orders", response_model=PaginatedResponse[SaleDto])
async def get_customer_orders(
    email: Optional[str] = None,
    phone: Optional[str] = None,
    channel: Optional[str] = None,
    organization_id: Optional[str] = None,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches past sales orders and invoices for a customer directly from PostgreSQL.
    Supports filtering by channel (e.g. 'STORE' for online storefront orders) and lookup by email or phone.
    """
    if not email and not phone and not user:
        return PaginatedResponse(items=[], meta=PageMeta(page=1, limit=50, total=0, totalPages=1), total=0)

    # Find customer by email or phone
    cust_filters = []
    if email:
        email_clean = email.strip().lower()
        cust_filters.append(or_(Customer.email == email_clean, func.lower(Customer.email) == email_clean))
    if phone:
        phone_clean = phone.strip()
        phone_digits = phone_clean.replace(" ", "").replace("-", "")
        cust_filters.append(or_(
            Customer.phone == phone_clean,
            func.replace(Customer.phone, " ", "") == phone_clean.replace(" ", ""),
            func.replace(func.replace(Customer.phone, " ", ""), "-", "") == phone_digits
        ))

    target_org = user.organization_id if (user and user.organization_id) else organization_id

    customer_ids = []
    customer = None
    if cust_filters:
        cust_stmt = select(Customer).where(or_(*cust_filters))
        if target_org:
            cust_stmt = cust_stmt.where(Customer.organization_id == target_org)
        cust_res = await db.execute(cust_stmt)
        matched_customers = cust_res.scalars().all()
        if matched_customers:
            customer = matched_customers[0]
            customer_ids = [c.id for c in matched_customers]

    sale_filters = []
    if customer_ids:
        if user and user.id:
            sale_filters.append(or_(Sale.customer_id.in_(customer_ids), Sale.user_id == user.id))
        else:
            sale_filters.append(Sale.customer_id.in_(customer_ids))
    elif user and user.id:
        sale_filters.append(Sale.user_id == user.id)
    else:
        return PaginatedResponse(items=[], meta=PageMeta(page=1, limit=50, total=0, totalPages=1), total=0)

    if target_org:
        sale_filters.append(Sale.organization_id == target_org)
    elif customer and customer.organization_id:
        sale_filters.append(Sale.organization_id == customer.organization_id)

    # Optional channel filtering (e.g. STORE vs POS)
    if channel and channel.upper() != "ALL":
        sale_filters.append(Sale.channel == channel.upper())

    stmt = (
        select(Sale)
        .where(*sale_filters)
        .options(selectinload(Sale.line_items), selectinload(Sale.payments))
        .order_by(desc(Sale.created_at))
        .limit(50)
    )
    result = await db.execute(stmt)
    sales = result.scalars().all()

    sale_ids = [s.id for s in sales]
    deliv_map = {}
    if sale_ids:
        deliv_res = await db.execute(
            select(DeliveryOrder, DeliveryDriver)
            .outerjoin(DeliveryDriver, DeliveryOrder.driver_id == DeliveryDriver.id)
            .where(DeliveryOrder.sale_id.in_(sale_ids))
        )
        for d_ord, d_drv in deliv_res.all():
            deliv_map[d_ord.sale_id] = (d_ord, d_drv)

    default_customer_name = customer.name if customer else "Guest"
    out = []
    for s in sales:
        deliv_info = deliv_map.get(s.id)
        d_ord = deliv_info[0] if deliv_info else None
        d_drv = deliv_info[1] if deliv_info else None

        resolved_cust_name = default_customer_name
        if s.notes:
            try:
                parsed_notes = json.loads(s.notes)
                if isinstance(parsed_notes, dict) and parsed_notes.get("customerName"):
                    resolved_cust_name = parsed_notes["customerName"]
            except Exception:
                pass

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
            customerName=resolved_cust_name,
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
                    reference=p.reference,
                    provider=p.provider,
                    qrString=p.qr_string,
                    paidAt=p.paid_at.isoformat() if p.paid_at else None,
                ) for p in s.payments
            ],
            trackingNumber=d_ord.tracking_number if d_ord else None,
            deliveryOrderId=d_ord.id if d_ord else None,
            deliveryStatus=d_ord.status if d_ord else None,
            deliveryAddress=d_ord.delivery_address if d_ord else None,
            driverName=d_drv.name if d_drv else None,
            driverPhone=d_drv.phone if d_drv else None,
            driverVehicle=d_drv.vehicle_type if d_drv else None,
            destLat=d_ord.dest_lat if d_ord else None,
            destLng=d_ord.dest_lng if d_ord else None,
            etaMinutes=d_ord.eta_minutes if d_ord else None,
            distanceKm=d_ord.distance_km if d_ord else None,
        ))

    return PaginatedResponse(items=out, meta=PageMeta(page=1, limit=50, total=len(out), totalPages=1), total=len(out))
