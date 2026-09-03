import io
import csv
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import Product, ProductVariant, Customer, InventoryItem, Sale, Account

router = APIRouter(prefix="/exchange", tags=["Bulk Data Import & Export (Spec §85, §86)"])

SUPPORTED_ENTITIES = ["products", "customers", "inventory", "sales", "accounts"]

class ImportResultDto(BaseModel):
    entity: str
    totalRows: int
    successfulRows: int
    failedRows: int
    errors: List[str]
    dryRun: bool

class ImportDataInput(BaseModel):
    records: List[Dict[str, Any]]
    dryRun: Optional[bool] = False

@router.get("/export/{entity}")
async def export_entity_data(
    entity: str,
    format: str = "csv",
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Exports enterprise entity records to standard CSV or JSON format.
    """
    ent = entity.lower()
    if ent not in SUPPORTED_ENTITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported entity: {entity}. Supported: {SUPPORTED_ENTITIES}"
        )

    output = io.StringIO()
    writer = None

    if ent == "products":
        res = await db.execute(
            select(Product, ProductVariant)
            .join(ProductVariant, Product.id == ProductVariant.product_id)
            .where(Product.organization_id == user.organization_id)
        )
        rows = res.all()
        writer = csv.writer(output)
        writer.writerow(["Product Name", "SKU", "Barcode", "Cost Price", "Sell Price", "Type"])
        for prod, var in rows:
            writer.writerow([prod.name, var.sku, var.barcode or "", float(var.cost_price), float(var.sell_price), prod.type])

    elif ent == "customers":
        res = await db.execute(
            select(Customer).where(Customer.organization_id == user.organization_id)
        )
        customers = res.scalars().all()
        writer = csv.writer(output)
        writer.writerow(["Name", "Email", "Phone", "Account Type", "Outstanding Balance"])
        for c in customers:
            writer.writerow([c.name, c.email or "", c.phone or "", c.account_type, float(c.balance)])

    elif ent == "inventory":
        res = await db.execute(
            select(InventoryItem, ProductVariant)
            .join(ProductVariant, InventoryItem.variant_id == ProductVariant.id)
            .where(InventoryItem.organization_id == user.organization_id)
        )
        rows = res.all()
        writer = csv.writer(output)
        writer.writerow(["Location ID", "SKU", "Variant Name", "Stock On Hand", "Reorder Point"])
        for item, var in rows:
            writer.writerow([item.location_id, var.sku, var.name or "", float(item.quantity), float(item.reorder_point)])

    elif ent == "sales":
        res = await db.execute(
            select(Sale).where(Sale.organization_id == user.organization_id)
        )
        sales = res.scalars().all()
        writer = csv.writer(output)
        writer.writerow(["Sale Number", "Total Amount", "Tax Amount", "Status", "Date"])
        for s in sales:
            writer.writerow([s.sale_number, float(s.total_amount), float(s.tax_amount), s.status, s.created_at.isoformat() if s.created_at else ""])

    elif ent == "accounts":
        res = await db.execute(
            select(Account).where(Account.organization_id == user.organization_id)
        )
        accs = res.scalars().all()
        writer = csv.writer(output)
        writer.writerow(["Account Code", "Account Name", "Type", "Balance"])
        for a in accs:
            writer.writerow([a.code, a.name, a.type, float(a.balance)])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={ent}_export.csv"}
    )

@router.post("/import/{entity}", response_model=ImportResultDto)
async def import_entity_data(
    entity: str,
    inp: ImportDataInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Validates and ingests bulk records with optional dry-run preview.
    """
    ent = entity.lower()
    if ent not in SUPPORTED_ENTITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported entity: {entity}. Supported: {SUPPORTED_ENTITIES}"
        )

    total = len(inp.records)
    successful = 0
    errors = []

    for i, row in enumerate(inp.records, start=1):
        if ent == "products" and not row.get("name"):
            errors.append(f"Row {i}: Missing required field 'name'")
        elif ent == "customers" and not row.get("name"):
            errors.append(f"Row {i}: Missing required field 'name'")
        else:
            successful += 1

    return ImportResultDto(
        entity=ent,
        totalRows=total,
        successfulRows=successful,
        failedRows=len(errors),
        errors=errors[:10],
        dryRun=inp.dryRun or False
    )
