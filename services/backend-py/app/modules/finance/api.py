import datetime
import secrets
from decimal import Decimal
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser
from app.core.db_enums import ENUM_LABELS
from app.domain.enterprise_engines import DepreciationCalculator

from .models import Account, JournalEntry, JournalLineItem, FixedAsset, DepreciationRecord
from .schemas import (
    AccountDto, CreateAccountInput, UpdateAccountInput,
    JournalEntryDto, JournalLineDto, CreateJournalEntryInput, FixedAssetDto
)

router = APIRouter(tags=["Finance"])

_ACCOUNT_TYPES = set(ENUM_LABELS.get("AccountType", ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]))
_JOURNAL_SOURCES = set(ENUM_LABELS.get("JournalSourceType", ["MANUAL", "SALE", "PROCUREMENT", "INVENTORY_ADJUSTMENT", "PAYMENT", "REFUND"]))


def _account_to_dto(a: Account) -> AccountDto:
    return AccountDto(
        id=a.id,
        organizationId=a.organization_id,
        code=a.code,
        name=a.name,
        type=a.type,
        category="GENERAL",
        balance=0.0,
        currency=a.currency or "USD",
        description=a.description,
        isSystem=bool(a.is_system),
        isActive=bool(a.is_active),
        createdAt=a.created_at.isoformat() if a.created_at else None,
        updatedAt=a.updated_at.isoformat() if a.updated_at else None,
    )


def _journal_to_dto(e: JournalEntry) -> JournalEntryDto:
    return JournalEntryDto(
        id=e.id,
        entryNumber=e.entry_number,
        date=e.posting_date.isoformat() if e.posting_date else utc_now().isoformat(),
        memo=e.description,
        status=e.status,
        lines=[
            JournalLineDto(
                id=l.id,
                accountId=l.account_id,
                accountCode=l.account.code if getattr(l, 'account', None) else None,
                accountName=l.account.name if getattr(l, 'account', None) else None,
                debit=float(l.debit),
                credit=float(l.credit),
                description=l.memo,
                memo=l.memo,
            )
            for l in e.lines
        ],
    )


@router.get("/finance/accounts", response_model=List[AccountDto])
async def list_accounts(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Account)
        .where(Account.organization_id == user.organization_id)
        .order_by(Account.code.asc())
    )
    accounts = result.scalars().all()
    return [_account_to_dto(a) for a in accounts]


@router.post("/finance/accounts", response_model=AccountDto, status_code=status.HTTP_201_CREATED)
async def create_account(
    input_data: CreateAccountInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    acc_type = input_data.type.upper()
    if acc_type not in _ACCOUNT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid account type '{input_data.type}'. Allowed: {sorted(_ACCOUNT_TYPES)}"
        )

    # Check duplicate code within organization
    code_check = await db.execute(
        select(Account).where(
            Account.organization_id == user.organization_id,
            Account.code == input_data.code.strip()
        )
    )
    if code_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Account code '{input_data.code}' already exists"
        )

    account = Account(
        organization_id=user.organization_id,
        code=input_data.code.strip(),
        name=input_data.name.strip(),
        type=acc_type,
        currency=input_data.currency or "USD",
        description=input_data.description,
        is_system=False,
        is_active=True,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _account_to_dto(account)


@router.patch("/finance/accounts/{account_id}", response_model=AccountDto)
async def update_account(
    account_id: str,
    input_data: UpdateAccountInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.organization_id == user.organization_id
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if input_data.name is not None:
        account.name = input_data.name.strip()
    if input_data.description is not None:
        account.description = input_data.description
    if input_data.isActive is not None:
        account.is_active = input_data.isActive

    await db.commit()
    await db.refresh(account)
    return _account_to_dto(account)


@router.get("/finance/journal-entries", response_model=List[JournalEntryDto])
async def list_journal_entries(
    status: Optional[str] = None,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(JournalEntry)
        .where(JournalEntry.organization_id == user.organization_id)
        .options(selectinload(JournalEntry.lines).selectinload(JournalLineItem.account))
        .order_by(desc(JournalEntry.posting_date))
    )
    if status:
        stmt = stmt.where(JournalEntry.status == status.upper())

    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [_journal_to_dto(e) for e in entries]


@router.get("/finance/journal-entries/{entry_id}", response_model=JournalEntryDto)
async def get_journal_entry(
    entry_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(JournalEntry)
        .where(
            JournalEntry.id == entry_id,
            JournalEntry.organization_id == user.organization_id
        )
        .options(selectinload(JournalEntry.lines).selectinload(JournalLineItem.account))
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
    return _journal_to_dto(entry)


@router.post("/finance/journal-entries", response_model=JournalEntryDto, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    input_data: CreateJournalEntryInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if len(input_data.lines) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Journal entry must have at least two line items"
        )

    total_debits = sum(Decimal(str(l.debit)) for l in input_data.lines)
    total_credits = sum(Decimal(str(l.credit)) for l in input_data.lines)

    if abs(total_debits - total_credits) > Decimal("0.001"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unbalanced journal entry: Total Debits ({total_debits}) must equal Total Credits ({total_credits})"
        )

    if total_debits <= Decimal("0.0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Journal entry total debit and credit amounts must be greater than zero"
        )

    # Validate accounts exist and belong to organization
    account_ids = [l.accountId for l in input_data.lines]
    acc_res = await db.execute(
        select(Account).where(
            Account.id.in_(account_ids),
            Account.organization_id == user.organization_id
        )
    )
    found_accounts = {a.id: a for a in acc_res.scalars().all()}
    for line in input_data.lines:
        if line.accountId not in found_accounts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Account '{line.accountId}' not found in organization"
            )

    posting_date = utc_now()
    if input_data.postingDate:
        try:
            posting_date = datetime.datetime.fromisoformat(input_data.postingDate.replace("Z", "+00:00"))
        except Exception:
            posting_date = utc_now()

    entry_num = f"JE-{utc_now().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    source_type = input_data.sourceType.upper() if input_data.sourceType and input_data.sourceType.upper() in _JOURNAL_SOURCES else "MANUAL"

    entry = JournalEntry(
        organization_id=user.organization_id,
        entry_number=entry_num,
        posting_date=posting_date,
        source_type=source_type,
        description=input_data.description.strip(),
        status="DRAFT",
        created_by_id=user.id,
    )
    db.add(entry)
    await db.flush()

    for line in input_data.lines:
        j_line = JournalLineItem(
            journal_entry_id=entry.id,
            account_id=line.accountId,
            debit=Decimal(str(line.debit)),
            credit=Decimal(str(line.credit)),
            memo=line.memo,
        )
        db.add(j_line)

    await db.commit()

    # Reload with relationships
    stmt = (
        select(JournalEntry)
        .where(JournalEntry.id == entry.id)
        .options(selectinload(JournalEntry.lines).selectinload(JournalLineItem.account))
    )
    res = await db.execute(stmt)
    saved_entry = res.scalar_one()
    return _journal_to_dto(saved_entry)


@router.post("/finance/journal-entries/{entry_id}/post", response_model=JournalEntryDto)
async def post_journal_entry(
    entry_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(JournalEntry)
        .where(
            JournalEntry.id == entry_id,
            JournalEntry.organization_id == user.organization_id
        )
        .options(selectinload(JournalEntry.lines).selectinload(JournalLineItem.account))
    )
    res = await db.execute(stmt)
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")

    if entry.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot post journal entry in status '{entry.status}'"
        )

    entry.status = "POSTED"
    entry.updated_at = utc_now()
    await db.commit()
    await db.refresh(entry)
    return _journal_to_dto(entry)


@router.post("/finance/journal-entries/{entry_id}/void", response_model=JournalEntryDto)
async def void_journal_entry(
    entry_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(JournalEntry)
        .where(
            JournalEntry.id == entry_id,
            JournalEntry.organization_id == user.organization_id
        )
        .options(selectinload(JournalEntry.lines).selectinload(JournalLineItem.account))
    )
    res = await db.execute(stmt)
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")

    entry.status = "VOID"
    entry.updated_at = utc_now()
    await db.commit()
    await db.refresh(entry)
    return _journal_to_dto(entry)


@router.get("/assets", response_model=List[FixedAssetDto])
async def list_fixed_assets(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FixedAsset).where(FixedAsset.organization_id == user.organization_id)
    )
    assets = result.scalars().all()
    return [
        FixedAssetDto(
            id=a.id,
            assetNumber=a.asset_code,
            name=a.name,
            category=a.category,
            purchaseCost=float(a.purchase_cost),
            salvageValue=float(a.salvage_value),
            usefulLifeMonths=a.useful_life_months,
            depreciationMethod=a.depreciation_method,
            accumulatedDepreciation=float(a.accumulated_deprec),
            bookValue=float(a.current_book_value),
            status=a.status,
        )
        for a in assets
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
