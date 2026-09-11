from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_optional_user, TenantUser
from app.modules.customers.models import Customer

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
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches past sales orders and invoices for a customer directly from PostgreSQL.
    Supports filtering by channel (e.g. 'STORE' for online storefront orders) and lookup by email or phone.
    """
    if not email and not phone:
        return PaginatedResponse(items=[], meta=PageMeta(page=1, limit=50, total=0, totalPages=1), total=0)

    # Find customer by email or phone
    cust_filters = []
    if email:
        email_clean = email.strip().lower()
        cust_filters.append(or_(Customer.email == email_clean, func.lower(Customer.email) == email_clean))
    if phone:
        phone_clean = phone.strip()
        cust_filters.append(or_(
            Customer.phone == phone_clean,
            func.replace(Customer.phone, " ", "") == phone_clean.replace(" ", "")
        ))

    cust_res = await db.execute(
        select(Customer).where(or_(*cust_filters)).limit(1)
    )
    customer = cust_res.scalar_one_or_none()

    if not customer:
        return PaginatedResponse(items=[], meta=PageMeta(page=1, limit=50, total=0, totalPages=1), total=0)

    sale_filters = [Sale.customer_id == customer.id]
    if user and user.organization_id:
        sale_filters.append(Sale.organization_id == user.organization_id)
    elif customer.organization_id:
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
            ]
        ))

    return PaginatedResponse(items=out, meta=PageMeta(page=1, limit=50, total=len(out), totalPages=1), total=len(out))
