"""
Bot Builder — Commands Controller.
CRUD for Telegram commands + sync to Telegram via setMyCommands API.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser
from app.core.crypto import EncryptionService
from app.modules.automations.models import TelegramBot
from ..models import BotCommand, gen_id
from ..schemas import BotCommandDto, CreateBotCommandInput, UpdateBotCommandInput
from ..engine.telegram_adapter import TelegramAdapter

router = APIRouter(tags=["Bot Builder — Commands"])


def _command_dto(c: BotCommand) -> BotCommandDto:
    return BotCommandDto(
        id=c.id,
        organizationId=c.organization_id,
        botId=c.bot_id,
        command=c.command,
        description=c.description,
        workflowId=c.workflow_id,
        scope=c.scope,
        isActive=c.is_active,
        createdAt=c.created_at.isoformat() if c.created_at else "",
        updatedAt=c.updated_at.isoformat() if c.updated_at else None,
    )


@router.get("/bot-builder/bots/{bot_id}/commands", response_model=List[BotCommandDto])
async def list_bot_commands(
    bot_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotCommand).where(
            BotCommand.bot_id == bot_id,
            BotCommand.organization_id == user.organization_id,
        ).order_by(BotCommand.command)
    )
    return [_command_dto(c) for c in result.scalars().all()]


@router.post("/bot-builder/bots/{bot_id}/commands", response_model=BotCommandDto, status_code=201)
async def create_bot_command(
    bot_id: str,
    data: CreateBotCommandInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Normalize command
    command_str = data.command.strip()
    if not command_str.startswith("/"):
        command_str = f"/{command_str}"

    cmd = BotCommand(
        id=gen_id(),
        organization_id=user.organization_id,
        bot_id=bot_id,
        command=command_str,
        description=data.description,
        workflow_id=data.workflowId,
        scope=data.scope,
        is_active=data.isActive,
    )
    db.add(cmd)
    await db.commit()
    await db.refresh(cmd)
    return _command_dto(cmd)


@router.patch("/bot-builder/commands/{command_id}", response_model=BotCommandDto)
async def update_bot_command(
    command_id: str,
    data: UpdateBotCommandInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotCommand).where(
            BotCommand.id == command_id,
            BotCommand.organization_id == user.organization_id,
        )
    )
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    if data.command is not None:
        cmd_str = data.command.strip()
        cmd.command = cmd_str if cmd_str.startswith("/") else f"/{cmd_str}"
    if data.description is not None:
        cmd.description = data.description
    if data.workflowId is not None:
        cmd.workflow_id = data.workflowId
    if data.scope is not None:
        cmd.scope = data.scope
    if data.isActive is not None:
        cmd.is_active = data.isActive

    cmd.updated_at = utc_now()
    await db.commit()
    await db.refresh(cmd)
    return _command_dto(cmd)


@router.delete("/bot-builder/commands/{command_id}")
async def delete_bot_command(
    command_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotCommand).where(
            BotCommand.id == command_id,
            BotCommand.organization_id == user.organization_id,
        )
    )
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")
    await db.delete(cmd)
    await db.commit()
    return {"success": True}


@router.post("/bot-builder/bots/{bot_id}/commands/sync")
async def sync_commands_to_telegram(
    bot_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Push all active commands for this bot to Telegram via setMyCommands."""
    # Get the bot's token
    bot_result = await db.execute(
        select(TelegramBot).where(
            TelegramBot.id == bot_id,
            TelegramBot.organization_id == user.organization_id,
        )
    )
    bot = bot_result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Telegram bot not found")

    try:
        token = EncryptionService.decrypt(bot.bot_token)
    except Exception:
        token = bot.bot_token

    # Get active commands
    cmd_result = await db.execute(
        select(BotCommand).where(
            BotCommand.bot_id == bot_id,
            BotCommand.organization_id == user.organization_id,
            BotCommand.is_active == True,
        )
    )
    commands = cmd_result.scalars().all()

    adapter = TelegramAdapter(token)
    tg_commands = [
        {"command": c.command.lstrip("/"), "description": c.description or c.command}
        for c in commands
    ]
    result = await adapter.set_my_commands(tg_commands)

    return {
        "success": result.get("ok", False),
        "commandsSynced": len(tg_commands),
        "commands": [c.command for c in commands],
    }
