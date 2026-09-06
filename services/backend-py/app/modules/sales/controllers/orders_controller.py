from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
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
