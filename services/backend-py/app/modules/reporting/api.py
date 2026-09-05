import csv
import io
import datetime
from collections import defaultdict
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser

from app.modules.sales.models import Sale, SaleLineItem, SalePayment
from app.modules.catalog.models import Product, ProductVariant, Category
from app.modules.inventory.models import InventoryItem
from app.modules.locations.models import Location
from app.modules.customers.models import Customer
from app.modules.organizations.models import Organization
from app.models.entities import ApprovalRequest
from app.modules.service_desk.models import ServiceTicket

router = APIRouter(tags=["BI Reporting & Analytics"])


def _f(v) -> float:
    """Decimal/None -> float."""
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _parse_dt(s: Optional[str]) -> Optional[datetime.datetime]:
    """Parse an ISO date string (handles trailing 'Z') into a naive UTC datetime,
    so it can be compared against the DB's naive `createdAt` timestamps."""
    if not s:
        return None
    s = s.replace("Z", "+00:00")
    try:
        dt = datetime.datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return dt


async def _load_report_data(
    db: AsyncSession,
    org_id: str,
    start: Optional[datetime.datetime],
    end: Optional[datetime.datetime],
    location_id: Optional[str],
):
    """Fetch completed sales (+ their line items and payments) in range, plus the
    variant/product/category/inventory/location lookups needed to aggregate."""
    sale_q = select(Sale).where(
        Sale.organization_id == org_id,
        Sale.status == "COMPLETED",
    )
    if start is not None:
        sale_q = sale_q.where(Sale.created_at >= start)
    if end is not None:
        sale_q = sale_q.where(Sale.created_at <= end)
    if location_id:
        sale_q = sale_q.where(Sale.location_id == location_id)
    sales = (await db.execute(sale_q)).scalars().all()
    sale_ids = [s.id for s in sales]

    line_items: List[SaleLineItem] = []
    payments: List[SalePayment] = []
    if sale_ids:
        line_items = (
            await db.execute(select(SaleLineItem).where(SaleLineItem.sale_id.in_(sale_ids)))
        ).scalars().all()
        payments = (
            await db.execute(select(SalePayment).where(SalePayment.sale_id.in_(sale_ids)))
        ).scalars().all()

    variants = (
        await db.execute(select(ProductVariant).where(ProductVariant.organization_id == org_id))
    ).scalars().all()
    products = (
        await db.execute(select(Product).where(Product.organization_id == org_id))
    ).scalars().all()
    categories = (
        await db.execute(select(Category).where(Category.organization_id == org_id))
    ).scalars().all()
    inventory = (
        await db.execute(select(InventoryItem).where(InventoryItem.organization_id == org_id))
    ).scalars().all()
    locations = (
        await db.execute(select(Location).where(Location.organization_id == org_id))
    ).scalars().all()

    return sales, line_items, payments, variants, products, categories, inventory, locations


def _build_summary(sales, line_items, payments, variants, products, categories, inventory, locations):
    variant_by_id = {v.id: v for v in variants}
    product_by_id = {p.id: p for p in products}
    category_by_id = {c.id: c.name for c in categories}
    location_by_id = {l.id: l.name for l in locations}
    sale_by_id = {s.id: s for s in sales}

    # ── Sales summary ──────────────────────────────────────────────
    gross_revenue = sum(_f(s.subtotal) for s in sales)
    discount_total = sum(_f(s.discount_total) for s in sales)
    tax_total = sum(_f(s.tax_total) for s in sales)
    net_revenue = gross_revenue - discount_total
    grand_total_all = sum(_f(s.grand_total) for s in sales)

    cogs = 0.0
    for li in line_items:
        v = variant_by_id.get(li.product_variant_id)
        cost = _f(v.cost_price) if v else 0.0
        cogs += cost * _f(li.quantity)

    gross_margin = net_revenue - cogs
    order_count = len(sales)
    aov = (grand_total_all / order_count) if order_count else 0.0
    gross_margin_pct = (gross_margin / net_revenue * 100.0) if net_revenue else 0.0

    sales_summary = {
        "grossRevenue": round(gross_revenue, 2),
        "discountTotal": round(discount_total, 2),
        "netRevenue": round(net_revenue, 2),
        "taxTotal": round(tax_total, 2),
        "cogs": round(cogs, 2),
        "grossMargin": round(gross_margin, 2),
        "grossMarginPct": round(gross_margin_pct, 2),
        "orderCount": order_count,
        "averageOrderValue": round(aov, 2),
    }

    # ── Payment breakdown ──────────────────────────────────────────
    pay_agg = defaultdict(lambda: {"count": 0, "totalAmount": 0.0})
    pay_total = 0.0
    for p in payments:
        method = p.method or "OTHER"
        pay_agg[method]["count"] += 1
        amt = _f(p.amount)
        pay_agg[method]["totalAmount"] += amt
        pay_total += amt
    payments_out = [
        {
            "method": m,
            "count": d["count"],
            "totalAmount": round(d["totalAmount"], 2),
            "percentage": round((d["totalAmount"] / pay_total * 100.0) if pay_total else 0.0, 2),
        }
        for m, d in sorted(pay_agg.items(), key=lambda kv: kv[1]["totalAmount"], reverse=True)
    ]

    # ── Time series (per day) ──────────────────────────────────────
    cogs_by_day = defaultdict(float)
    for li in line_items:
        s = sale_by_id.get(li.sale_id)
        if not s:
            continue
        day = (s.created_at or datetime.datetime.utcnow()).date().isoformat()
        v = variant_by_id.get(li.product_variant_id)
        cost = _f(v.cost_price) if v else 0.0
        cogs_by_day[day] += cost * _f(li.quantity)

    ts_agg = defaultdict(lambda: {"revenue": 0.0, "orders": 0, "net": 0.0})
    for s in sales:
        day = (s.created_at or datetime.datetime.utcnow()).date().isoformat()
        ts_agg[day]["revenue"] += _f(s.grand_total)
        ts_agg[day]["orders"] += 1
        ts_agg[day]["net"] += _f(s.subtotal) - _f(s.discount_total)
    time_series = [
        {
            "date": day,
            "revenue": round(d["revenue"], 2),
            "orders": d["orders"],
            "margin": round(d["net"] - cogs_by_day.get(day, 0.0), 2),
        }
        for day, d in sorted(ts_agg.items())
    ]

    # ── Top products ───────────────────────────────────────────────
    prod_agg = defaultdict(lambda: {"units": 0.0, "revenue": 0.0, "cogs": 0.0})
    for li in line_items:
        key = li.product_variant_id
        v = variant_by_id.get(key)
        cost = _f(v.cost_price) if v else 0.0
        prod_agg[key]["units"] += _f(li.quantity)
        prod_agg[key]["revenue"] += _f(li.line_total)
        prod_agg[key]["cogs"] += cost * _f(li.quantity)
    top_products = []
    for variant_id, d in prod_agg.items():
        v = variant_by_id.get(variant_id)
        prod = product_by_id.get(v.product_id) if v else None
        cat_name = category_by_id.get(prod.category_id) if (prod and prod.category_id) else None
        margin = d["revenue"] - d["cogs"]
        top_products.append({
            "productId": prod.id if prod else "",
            "variantId": variant_id,
            "name": (prod.name if prod else None) or (v.name if v else None) or "Unknown",
            "sku": (v.sku if v else "") or "",
            "categoryName": cat_name,
            "unitsSold": round(d["units"], 2),
            "revenue": round(d["revenue"], 2),
            "cogs": round(d["cogs"], 2),
            "margin": round(margin, 2),
            "marginPct": round((margin / d["revenue"] * 100.0) if d["revenue"] else 0.0, 2),
        })
    top_products.sort(key=lambda p: p["revenue"], reverse=True)
    top_products = top_products[:10]

    # ── Inventory health ───────────────────────────────────────────
    total_units = 0.0
    total_cost_value = 0.0
    total_retail_value = 0.0
    low_stock = 0
    out_of_stock = 0
    for it in inventory:
        soh = _f(it.stock_on_hand)
        v = variant_by_id.get(it.product_variant_id)
        total_units += soh
        if v:
            total_cost_value += soh * _f(v.cost_price)
            total_retail_value += soh * _f(v.sell_price)
        if soh <= 0:
            out_of_stock += 1
        else:
            threshold = it.reorder_point if it.reorder_point is not None else it.minimum_stock
            if threshold is not None and soh <= _f(threshold):
                low_stock += 1
    inventory_health = {
        "totalSkuCount": len(inventory),
        "totalUnitsOnHand": round(total_units, 2),
        "totalAssetCostValue": round(total_cost_value, 2),
        "totalPotentialRetailValue": round(total_retail_value, 2),
        "lowStockItemCount": low_stock,
        "outOfStockCount": out_of_stock,
    }

    # ── Branch performance ─────────────────────────────────────────
    branch_agg = defaultdict(lambda: {"revenue": 0.0, "orders": 0})
    for s in sales:
        key = s.location_id or "__unassigned__"
        branch_agg[key]["revenue"] += _f(s.grand_total)
        branch_agg[key]["orders"] += 1
    branches = []
    for loc_id, d in branch_agg.items():
        oc = d["orders"]
        branches.append({
            "locationId": "" if loc_id == "__unassigned__" else loc_id,
            "locationName": "Unassigned" if loc_id == "__unassigned__" else location_by_id.get(loc_id, "Unknown"),
            "revenue": round(d["revenue"], 2),
            "orderCount": oc,
            "aov": round((d["revenue"] / oc) if oc else 0.0, 2),
        })
    branches.sort(key=lambda b: b["revenue"], reverse=True)

    return {
        "sales": sales_summary,
        "payments": payments_out,
        "timeSeries": time_series,
        "topProducts": top_products,
        "inventory": inventory_health,
        "branches": branches,
    }


@router.get("/reports/summary")
async def get_executive_report_summary(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    locationId: Optional[str] = Query(None),
    interval: Optional[str] = Query(None),
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Executive BI summary computed from real sales, inventory and location data
    (ExecutiveReportSummaryDto). Replaces the previously-missing endpoint that made
    the Reports page render all zeros."""
    start = _parse_dt(startDate)
    end = _parse_dt(endDate)
    data = await _load_report_data(db, user.organization_id, start, end, locationId)
    return _build_summary(*data)


@router.get("/reports/export")
async def export_report_csv(
    type: str = Query(...),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    locationId: Optional[str] = Query(None),
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a report as CSV (type = SALES | INVENTORY | PRODUCTS)."""
    start = _parse_dt(startDate)
    end = _parse_dt(endDate)
    sales, line_items, payments, variants, products, categories, inventory, locations = \
        await _load_report_data(db, user.organization_id, start, end, locationId)
    summary = _build_summary(sales, line_items, payments, variants, products, categories, inventory, locations)

    buf = io.StringIO()
    writer = csv.writer(buf)
    report_type = (type or "SALES").upper()

    if report_type == "INVENTORY":
        writer.writerow(["Metric", "Value"])
        for k, v in summary["inventory"].items():
            writer.writerow([k, v])
        filename = "inventory-report.csv"
    elif report_type == "PRODUCTS":
        writer.writerow(["SKU", "Name", "Category", "Units Sold", "Revenue", "COGS", "Margin", "Margin %"])
        for p in summary["topProducts"]:
            writer.writerow([p["sku"], p["name"], p.get("categoryName") or "", p["unitsSold"],
                             p["revenue"], p["cogs"], p["margin"], p["marginPct"]])
        filename = "products-report.csv"
    else:  # SALES
        writer.writerow(["Date", "Revenue", "Orders", "Margin"])
        for pt in summary["timeSeries"]:
            writer.writerow([pt["date"], pt["revenue"], pt["orders"], pt["margin"]])
        writer.writerow([])
        writer.writerow(["Payment Method", "Count", "Total Amount", "% Share"])
        for pay in summary["payments"]:
            writer.writerow([pay["method"], pay["count"], pay["totalAmount"], pay["percentage"]])
        filename = "sales-report.csv"

    return {"filename": filename, "csv": buf.getvalue()}


def _dashboard_metric(value: float, previous_value: float) -> dict:
    change_pct = None
    if previous_value:
        change_pct = round(((value - previous_value) / previous_value) * 100.0, 2)
    elif value == 0:
        change_pct = 0.0
    return {
        "value": round(value, 2),
        "previousValue": round(previous_value, 2),
        "changePct": change_pct,
    }


@router.get("/reports/dashboard")
async def get_business_dashboard(
    rangeDays: int = Query(30, ge=7, le=90),
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decision-grade dashboard with comparison periods and operational alerts."""
    end = datetime.datetime.utcnow()
    start = end - datetime.timedelta(days=rangeDays)
    previous_start = start - datetime.timedelta(days=rangeDays)

    current_data = await _load_report_data(db, user.organization_id, start, end, None)
    previous_data = await _load_report_data(db, user.organization_id, previous_start, start, None)
    current = _build_summary(*current_data)
    previous = _build_summary(*previous_data)

    organization = await db.get(Organization, user.organization_id)
    currency = organization.currency if organization else "USD"
    timezone = organization.timezone if organization else "UTC"

    current_customer_count = await db.scalar(
        select(func.count(Customer.id)).where(
            Customer.organization_id == user.organization_id,
            Customer.is_active.is_(True),
            Customer.created_at <= end,
        )
    ) or 0
    previous_customer_count = await db.scalar(
        select(func.count(Customer.id)).where(
            Customer.organization_id == user.organization_id,
            Customer.is_active.is_(True),
            Customer.created_at <= start,
        )
    ) or 0

    pending_approvals = await db.scalar(
        select(func.count(ApprovalRequest.id)).where(
            ApprovalRequest.organization_id == user.organization_id,
            ApprovalRequest.status == "PENDING",
        )
    ) or 0
    unresolved_tickets = await db.scalar(
        select(func.count(ServiceTicket.id)).where(
            ServiceTicket.organization_id == user.organization_id,
            ServiceTicket.status.in_(["OPEN", "IN_PROGRESS", "WAITING"]),
        )
    ) or 0

    alerts = []
    inventory = current["inventory"]
    if inventory["outOfStockCount"]:
        alerts.append({
            "id": "out-of-stock",
            "severity": "critical",
            "title": "Products out of stock",
            "description": "Restore availability for products with no remaining stock.",
            "count": inventory["outOfStockCount"],
            "href": "/inventory",
        })
    if inventory["lowStockItemCount"]:
        alerts.append({
            "id": "low-stock",
            "severity": "warning",
            "title": "Replenishment required",
            "description": "Inventory items have reached their reorder threshold.",
            "count": inventory["lowStockItemCount"],
            "href": "/inventory",
        })
    if pending_approvals:
        alerts.append({
            "id": "pending-approvals",
            "severity": "warning",
            "title": "Approvals awaiting review",
            "description": "Business workflows are waiting for an approval decision.",
            "count": pending_approvals,
            "href": "/approvals",
        })
    if unresolved_tickets:
        alerts.append({
            "id": "unresolved-tickets",
            "severity": "info",
            "title": "Open service requests",
            "description": "Customer and internal service tickets remain unresolved.",
            "count": unresolved_tickets,
            "href": "/tickets",
        })

    current_sales = current["sales"]
    previous_sales = previous["sales"]
    return {
        "period": {
            "startDate": start.isoformat() + "Z",
            "endDate": end.isoformat() + "Z",
            "previousStartDate": previous_start.isoformat() + "Z",
            "previousEndDate": start.isoformat() + "Z",
            "label": f"Last {rangeDays} days",
        },
        "generatedAt": end.isoformat() + "Z",
        "currency": currency,
        "timezone": timezone,
        "metrics": {
            "revenue": _dashboard_metric(current_sales["grossRevenue"], previous_sales["grossRevenue"]),
            "orders": _dashboard_metric(current_sales["orderCount"], previous_sales["orderCount"]),
            "averageOrderValue": _dashboard_metric(
                current_sales["averageOrderValue"], previous_sales["averageOrderValue"]
            ),
            "customers": _dashboard_metric(current_customer_count, previous_customer_count),
        },
        "inventory": inventory,
        "timeSeries": current["timeSeries"],
        "branches": current["branches"],
        "alerts": alerts,
    }
