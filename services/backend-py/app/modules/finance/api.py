import datetime
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.domain.enterprise_engines import DepreciationCalculator

from .models import Account, JournalEntry, JournalLineItem, FixedAsset, DepreciationRecord
from .schemas import AccountDto, JournalEntryDto, FixedAssetDto

router = APIRouter(tags=["Finance"])

@router.get("/finance/accounts")
async def list_accounts(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Account).where(Account.organization_id == user.organization_id)
    )
    accounts = result.scalars().all()
    if not accounts:
        return [
            {"id": "acc_cash", "code": "1010", "name": "Cash on Hand", "type": "ASSET", "category": "CURRENT_ASSETS"},
            {"id": "acc_sales", "code": "4010", "name": "Sales Revenue", "type": "REVENUE", "category": "OPERATING_REVENUE"},
            {"id": "acc_cogs", "code": "5010", "name": "Cost of Goods Sold", "type": "EXPENSE", "category": "DIRECT_COSTS"}
        ]
    return [
        {
            "id": a.id,
            "code": a.code,
            "name": a.name,
            "type": a.type,
            "category": "GENERAL", # Model does not have category
            "isActive": a.is_active,
            "currency": a.currency
        } for a in accounts
    ]

@router.get("/finance/journal-entries")
async def list_journal_entries(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(JournalEntry)
        .where(JournalEntry.organization_id == user.organization_id)
        .options(selectinload(JournalEntry.lines))
        .order_by(desc(JournalEntry.posting_date)) # Model uses posting_date
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "entryNumber": e.entry_number,
            "date": e.posting_date.isoformat(),
            "memo": e.description, # Model uses description
            "status": e.status,
            "lines": [
                {
                    "id": l.id,
                    "accountId": l.account_id,
                    "debit": float(l.debit),
                    "credit": float(l.credit),
                    "description": l.memo # Model uses memo
                } for l in e.lines
            ]
        } for e in entries
    ]

@router.get("/assets")
async def list_fixed_assets(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FixedAsset).where(FixedAsset.organization_id == user.organization_id)
    )
    assets = result.scalars().all()
    return [
        {
            "id": a.id,
            "organizationId": a.organization_id,
            "assetCode": a.asset_code,
            "assetNumber": a.asset_code,
            "name": a.name,
            "category": a.category,
            "purchaseCost": float(a.purchase_cost),
            "salvageValue": float(a.salvage_value),
            "usefulLifeMonths": a.useful_life_months,
            "depreciationMethod": a.depreciation_method,
            "accumulatedDeprec": float(a.accumulated_deprec),
            "accumulatedDepreciation": float(a.accumulated_deprec),
            "currentBookValue": float(a.current_book_value),
            "bookValue": float(a.current_book_value),
            "status": a.status,
            "createdAt": a.created_at.isoformat() if a.created_at else None,
            "updatedAt": a.updated_at.isoformat() if a.updated_at else None
        } for a in assets
    ]

@router.post("/assets/{asset_id}/depreciate")
async def run_asset_depreciation(
    asset_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FixedAsset).where(
            FixedAsset.id == asset_id,
            FixedAsset.organization_id == user.organization_id
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    calc = DepreciationCalculator.calculate_monthly(
        purchase_cost=asset.purchase_cost,
        salvage_value=asset.salvage_value,
        useful_life_months=asset.useful_life_months,
        accumulated_depreciation=asset.accumulated_deprec,
        method=asset.depreciation_method
    )

    asset.accumulated_deprec = calc["newAccumulated"]
    asset.current_book_value = calc["newBookValue"]
    await db.commit()

    return {
        "assetId": asset.id,
        "monthlyDepreciation": float(calc["monthlyDepreciation"]),
        "newAccumulated": float(calc["newAccumulated"]),
        "newBookValue": float(calc["newBookValue"])
    }
