import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, update

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import NotificationRecord, NotificationConfig
from app.modules.identity.models import User
from .schemas import (
    NotificationRecordDto,
    NotificationConfigDto,
    UpdateNotificationConfigInput,
    NotificationStatsDto,
    SendNotificationInput,
)

router = APIRouter(tags=["Notifications Platform"])


def _dto_from_record(n: NotificationRecord) -> NotificationRecordDto:
    return NotificationRecordDto(
        id=n.id,
        organizationId=n.organization_id,
        userId=n.user_id,
        channel=n.channel,
        type=n.type,
        title=n.title,
        message=n.message,
        status=n.status,
        isRead=bool(n.is_read),
        metadata=n.metadata_ if isinstance(n.metadata_, dict) else None,
        sentAt=n.sent_at.isoformat() if n.sent_at else (n.created_at.isoformat() if n.created_at else None),
        readAt=n.read_at.isoformat() if n.read_at else None,
        createdAt=n.created_at.isoformat() if n.created_at else None,
    )


@router.get("/notifications/stats", response_model=NotificationStatsDto)
async def get_notification_stats(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    total_q = await db.execute(
        select(func.count(NotificationRecord.id))
        .where(NotificationRecord.organization_id == user.organization_id)
    )
    total_dispatched = total_q.scalar_one_or_none() or 0

    unread_q = await db.execute(
        select(func.count(NotificationRecord.id))
        .where(
            NotificationRecord.organization_id == user.organization_id,
            NotificationRecord.is_read == False  # noqa: E712
        )
    )
    unread_in_app = unread_q.scalar_one_or_none() or 0

    # Get active channels from config
    cfg_q = await db.execute(
        select(NotificationConfig).where(NotificationConfig.organization_id == user.organization_id)
    )
    cfg = cfg_q.scalar_one_or_none()
    active_channels = ["IN_APP"]
    if cfg:
        if cfg.telegram_enabled:
            active_channels.append("TELEGRAM")
        if cfg.email_enabled:
            active_channels.append("EMAIL")

    return NotificationStatsDto(
        totalDispatched=total_dispatched,
        unreadInApp=unread_in_app,
        activeChannels=active_channels,
    )


@router.get("/notifications/config", response_model=NotificationConfigDto)
async def get_notification_config(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(NotificationConfig).where(NotificationConfig.organization_id == user.organization_id)
    res = await db.execute(stmt)
    cfg = res.scalar_one_or_none()

    if not cfg:
        # Auto-provision default config for tenant
        cfg = NotificationConfig(
            id=str(uuid.uuid4()),
            organization_id=user.organization_id,
            telegram_enabled=False,
            telegram_bot_token=None,
            telegram_chat_id=None,
            email_enabled=False,
            email_recipient=None,
            in_app_enabled=True,
        )
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)

    return NotificationConfigDto(
        id=cfg.id,
        organizationId=cfg.organization_id,
        telegramEnabled=cfg.telegram_enabled,
        telegramBotToken=cfg.telegram_bot_token,
        telegramChatId=cfg.telegram_chat_id,
        emailEnabled=cfg.email_enabled,
        emailRecipient=cfg.email_recipient,
        inAppEnabled=cfg.in_app_enabled,
        createdAt=cfg.created_at.isoformat() if cfg.created_at else None,
        updatedAt=cfg.updated_at.isoformat() if cfg.updated_at else None,
    )


@router.patch("/notifications/config", response_model=NotificationConfigDto)
async def update_notification_config(
    input_data: UpdateNotificationConfigInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(NotificationConfig).where(NotificationConfig.organization_id == user.organization_id)
    res = await db.execute(stmt)
    cfg = res.scalar_one_or_none()

    if not cfg:
        cfg = NotificationConfig(
            id=str(uuid.uuid4()),
            organization_id=user.organization_id,
            telegram_enabled=False,
            email_enabled=False,
            in_app_enabled=True,
        )
        db.add(cfg)

    if input_data.telegramEnabled is not None:
        cfg.telegram_enabled = input_data.telegramEnabled
    if input_data.telegramBotToken is not None:
        cfg.telegram_bot_token = input_data.telegramBotToken
    if input_data.telegramChatId is not None:
        cfg.telegram_chat_id = input_data.telegramChatId
    if input_data.emailEnabled is not None:
        cfg.email_enabled = input_data.emailEnabled
    if input_data.emailRecipient is not None:
        cfg.email_recipient = input_data.emailRecipient
    if input_data.inAppEnabled is not None:
        cfg.in_app_enabled = input_data.inAppEnabled

    cfg.updated_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(cfg)

    return NotificationConfigDto(
        id=cfg.id,
        organizationId=cfg.organization_id,
        telegramEnabled=cfg.telegram_enabled,
        telegramBotToken=cfg.telegram_bot_token,
        telegramChatId=cfg.telegram_chat_id,
        emailEnabled=cfg.email_enabled,
        emailRecipient=cfg.email_recipient,
        inAppEnabled=cfg.in_app_enabled,
        createdAt=cfg.created_at.isoformat() if cfg.created_at else None,
        updatedAt=cfg.updated_at.isoformat() if cfg.updated_at else None,
    )


@router.get("/notifications", response_model=List[NotificationRecordDto])
async def list_notifications(
    channel: Optional[str] = None,
    type: Optional[str] = None,
    isRead: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=100),
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(NotificationRecord)
        .where(NotificationRecord.organization_id == user.organization_id)
    )

    if channel:
        stmt = stmt.where(NotificationRecord.channel == channel.upper())
    if type:
        stmt = stmt.where(NotificationRecord.type == type)
    if isRead is not None:
        stmt = stmt.where(NotificationRecord.is_read == isRead)

    stmt = stmt.order_by(desc(NotificationRecord.created_at)).limit(limit)
    result = await db.execute(stmt)
    notes = result.scalars().all()
    return [_dto_from_record(n) for n in notes]


@router.post("/notifications/send", response_model=NotificationRecordDto)
async def send_notification(
    data: SendNotificationInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.datetime.utcnow()
    target_user_id = None
    desired_id = data.recipientUserId or (user.id if user else None)
    if desired_id:
        u_chk = await db.execute(select(User.id).where(User.id == desired_id))
        if u_chk.scalar_one_or_none():
            target_user_id = desired_id

    note = NotificationRecord(
        id=str(uuid.uuid4()),
        organization_id=user.organization_id,
        user_id=target_user_id,
        channel=data.channel.upper() if data.channel else "IN_APP",
        type=data.type or "GENERAL",
        title=data.title,
        message=data.message,
        status="SENT",
        metadata_=data.metadata,
        is_read=False,
        sent_at=now,
        created_at=now,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _dto_from_record(note)


@router.patch("/notifications/{note_id}/read", response_model=NotificationRecordDto)
async def mark_notification_read(
    note_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(NotificationRecord).where(
        NotificationRecord.id == note_id,
        NotificationRecord.organization_id == user.organization_id
    )
    res = await db.execute(stmt)
    note = res.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")

    note.is_read = True
    note.read_at = datetime.datetime.utcnow()
    note.status = "READ"
    await db.commit()
    await db.refresh(note)
    return _dto_from_record(note)


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.datetime.utcnow()
    stmt = (
        update(NotificationRecord)
        .where(
            NotificationRecord.organization_id == user.organization_id,
            NotificationRecord.is_read == False  # noqa: E712
        )
        .values(is_read=True, read_at=now, status="READ")
    )
    res = await db.execute(stmt)
    await db.commit()
    return {"updatedCount": res.rowcount}


@router.post("/notifications/test", response_model=NotificationRecordDto)
async def send_test_notification(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.datetime.utcnow()
    target_user_id = None
    if user and user.id:
        u_chk = await db.execute(select(User.id).where(User.id == user.id))
        if u_chk.scalar_one_or_none():
            target_user_id = user.id

    note = NotificationRecord(
        id=str(uuid.uuid4()),
        organization_id=user.organization_id,
        user_id=target_user_id,
        channel="IN_APP",
        type="GENERAL",
        title="🔔 Test Notification",
        message=f"Real-time notifications active at {now.strftime('%H:%M:%S UTC')}.",
        status="SENT",
        is_read=False,
        sent_at=now,
        created_at=now,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _dto_from_record(note)
