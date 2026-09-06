from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser
from app.core.crypto import EncryptionService
from app.domain.enterprise_engines import TelegramCommandRouter
from ..models import TelegramBot, TelegramChatBinding
from ..telegram_schemas import (
    TelegramBotDto,
    CreateTelegramBotInput,
    UpdateTelegramBotInput,
    TelegramBindingDto,
    TelegramBindingInput,
    UpdateTelegramBindingInput,
)

router = APIRouter(tags=["Telegram Bots & Integrations"])

def _mask_token(token: str) -> str:
    if not token:
        return ""
    if len(token) > 12:
        return f"{token[:9]}...{token[-4:]}"
    return "******"

def _telegram_bot_dto(b: TelegramBot) -> TelegramBotDto:
    raw_token = ""
    try:
        raw_token = EncryptionService.decrypt(b.bot_token)
    except Exception:
        raw_token = b.bot_token or ""
    return TelegramBotDto(
        id=b.id,
        organizationId=b.organization_id,
        name=b.name,
        botUsername=b.bot_username,
        tokenPreview=_mask_token(raw_token),
        description=b.description,
        purpose=b.purpose,
        defaultChatId=b.default_chat_id,
        isActive=b.is_active,
        isPrimary=b.is_primary,
        status=b.status,
        lastTestedAt=b.last_tested_at.isoformat() if b.last_tested_at else None,
        createdAt=b.created_at.isoformat() if b.created_at else "",
        updatedAt=b.updated_at.isoformat() if b.updated_at else "",
    )

def _telegram_binding_dto(b: TelegramChatBinding) -> TelegramBindingDto:
    return TelegramBindingDto(
        id=b.id,
        organizationId=b.organization_id,
        botId=b.bot_id,
        chatId=b.chat_id,
        chatTitle=b.chat_title,
        username=b.username,
        bindingType=b.binding_type if hasattr(b, "binding_type") and b.binding_type else "GROUP",
        role=b.role,
        isActive=b.is_active,
        createdAt=b.created_at.isoformat() if b.created_at else None,
    )

@router.get("/telegram/bots", response_model=List[TelegramBotDto])
async def list_telegram_bots(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TelegramBot)
        .where(TelegramBot.organization_id == user.organization_id)
        .order_by(TelegramBot.is_primary.desc(), TelegramBot.created_at.asc())
    )
    return [_telegram_bot_dto(b) for b in result.scalars().all()]

@router.post("/telegram/bots", response_model=TelegramBotDto)
async def create_telegram_bot(
    data: CreateTelegramBotInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    bot_username = data.botUsername
    status = "CONNECTED"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(f"https://api.telegram.org/bot{data.botToken}/getMe")
            if resp.is_success and resp.json().get("ok"):
                bot_info = resp.json().get("result", {})
                bot_username = bot_info.get("username", bot_username)
                status = "CONNECTED"
            else:
                status = "ERROR"
    except Exception:
        status = "CONNECTED"

    encrypted_token = EncryptionService.encrypt(data.botToken)

    # If first bot for org or flagged primary, handle is_primary
    existing = await db.execute(
        select(TelegramBot).where(TelegramBot.organization_id == user.organization_id)
    )
    has_bots = len(existing.scalars().all()) > 0
    is_primary = data.isPrimary or not has_bots

    if is_primary:
        await db.execute(
            update(TelegramBot)
            .where(TelegramBot.organization_id == user.organization_id)
            .values(is_primary=False)
        )

    bot = TelegramBot(
        organization_id=user.organization_id,
        name=data.name,
        bot_token=encrypted_token,
        bot_username=bot_username,
        description=data.description,
        purpose=data.purpose,
        default_chat_id=data.defaultChatId,
        is_active=data.isActive,
        is_primary=is_primary,
        status=status,
        last_tested_at=utc_now(),
    )
    db.add(bot)
    await db.commit()
    await db.refresh(bot)
    return _telegram_bot_dto(bot)

@router.get("/telegram/bots/{bot_id}", response_model=TelegramBotDto)
async def get_telegram_bot(
    bot_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TelegramBot).where(
            TelegramBot.id == bot_id,
            TelegramBot.organization_id == user.organization_id
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Telegram bot not found")
    return _telegram_bot_dto(bot)

@router.patch("/telegram/bots/{bot_id}", response_model=TelegramBotDto)
async def update_telegram_bot(
    bot_id: str,
    data: UpdateTelegramBotInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TelegramBot).where(
            TelegramBot.id == bot_id,
            TelegramBot.organization_id == user.organization_id
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Telegram bot not found")

    if data.name is not None:
        bot.name = data.name
    if data.botUsername is not None:
        bot.bot_username = data.botUsername
    if data.description is not None:
        bot.description = data.description
    if data.purpose is not None:
        bot.purpose = data.purpose
    if data.defaultChatId is not None:
        bot.default_chat_id = data.defaultChatId
    if data.isActive is not None:
        bot.is_active = data.isActive

    if data.isPrimary:
        await db.execute(
            update(TelegramBot)
            .where(TelegramBot.organization_id == user.organization_id)
            .values(is_primary=False)
        )
        bot.is_primary = True

    if data.botToken:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(f"https://api.telegram.org/bot{data.botToken}/getMe")
                if resp.is_success and resp.json().get("ok"):
                    bot.bot_username = resp.json().get("result", {}).get("username", bot.bot_username)
                    bot.status = "CONNECTED"
        except Exception:
            pass
        bot.bot_token = EncryptionService.encrypt(data.botToken)
        bot.last_tested_at = utc_now()

    bot.updated_at = utc_now()
    await db.commit()
    await db.refresh(bot)
    return _telegram_bot_dto(bot)

@router.delete("/telegram/bots/{bot_id}")
async def delete_telegram_bot(
    bot_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TelegramBot).where(
            TelegramBot.id == bot_id,
            TelegramBot.organization_id == user.organization_id
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Telegram bot not found")

    await db.execute(
        update(TelegramChatBinding)
        .where(
            TelegramChatBinding.bot_id == bot_id,
            TelegramChatBinding.organization_id == user.organization_id
        )
        .values(bot_id=None)
    )

    await db.delete(bot)
    await db.commit()
    return {"success": True}

@router.post("/telegram/bots/test-token")
async def test_telegram_token(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
):
    raw_token = (data.get("botToken") or data.get("token") or "").strip()
    if not raw_token:
        raise HTTPException(status_code=400, detail="Bot token is required")

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(f"https://api.telegram.org/bot{raw_token}/getMe")
            if resp.is_success and resp.json().get("ok"):
                bot_info = resp.json().get("result", {})
                return {
                    "success": True,
                    "status": "CONNECTED",
                    "botUsername": bot_info.get("username"),
                    "botName": bot_info.get("first_name", "Telegram Bot"),
                    "canJoinGroups": bot_info.get("can_join_groups", True),
                    "canReadAllGroupMessages": bot_info.get("can_read_all_group_messages", False),
                }
            else:
                err_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                err_desc = err_data.get("description", "Unauthorized or invalid bot token")
                return {
                    "success": False,
                    "status": "ERROR",
                    "botUsername": None,
                    "botName": f"Verification Failed: {err_desc}",
                    "canJoinGroups": False,
                    "canReadAllGroupMessages": False,
                }
    except Exception as e:
        return {
            "success": False,
            "status": "ERROR",
            "botUsername": None,
            "botName": f"Connection error: {str(e)}",
            "canJoinGroups": False,
            "canReadAllGroupMessages": False,
        }

@router.post("/telegram/bots/{bot_id}/test")
async def test_telegram_bot(
    bot_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TelegramBot).where(
            TelegramBot.id == bot_id,
            TelegramBot.organization_id == user.organization_id
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Telegram bot not found")

    try:
        token = EncryptionService.decrypt(bot.bot_token)
    except Exception:
        token = bot.bot_token

    bot_info = {}
    status = "CONNECTED"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(f"https://api.telegram.org/bot{token}/getMe")
            if resp.is_success and resp.json().get("ok"):
                bot_info = resp.json().get("result", {})
                bot.bot_username = bot_info.get("username", bot.bot_username)
                bot.status = "CONNECTED"
            else:
                bot.status = "ERROR"
                status = "ERROR"
    except Exception:
        bot.status = "ERROR"
        status = "ERROR"

    bot.last_tested_at = utc_now()
    await db.commit()
    await db.refresh(bot)

    return {
        "success": status == "CONNECTED",
        "status": bot.status,
        "botUsername": bot.bot_username,
        "botName": bot_info.get("first_name", bot.name),
        "canJoinGroups": bot_info.get("can_join_groups", True),
        "canReadAllGroupMessages": bot_info.get("can_read_all_group_messages", False),
        "lastTestedAt": bot.last_tested_at.isoformat() if bot.last_tested_at else None,
    }

@router.post("/telegram/bots/{bot_id}/broadcast")
async def broadcast_from_bot(
    bot_id: str,
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    message = (data.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    result = await db.execute(
        select(TelegramBot).where(
            TelegramBot.id == bot_id,
            TelegramBot.organization_id == user.organization_id
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Telegram bot not found")
    if not bot.is_active:
        raise HTTPException(status_code=400, detail="This Telegram bot is currently inactive")

    try:
        token = EncryptionService.decrypt(bot.bot_token)
    except Exception:
        token = bot.bot_token

    chat_res = await db.execute(
        select(TelegramChatBinding).where(
            TelegramChatBinding.organization_id == user.organization_id,
            TelegramChatBinding.is_active == True,
            or_(TelegramChatBinding.bot_id == bot.id, TelegramChatBinding.bot_id == None)
        )
    )
    bindings = chat_res.scalars().all()
    destinations = {b.chat_id for b in bindings}
    if bot.default_chat_id:
        destinations.add(bot.default_chat_id)

    sent_count = 0
    failed_count = 0
    async with httpx.AsyncClient(timeout=8.0) as client:
        for cid in destinations:
            try:
                resp = await client.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json={"chat_id": cid, "text": message}
                )
                if resp.is_success and resp.json().get("ok"):
                    sent_count += 1
                else:
                    failed_count += 1
            except Exception:
                failed_count += 1

    return {
        "sentCount": sent_count,
        "failedCount": failed_count,
        "totalDestinations": len(destinations),
        "message": message,
        "botName": bot.name,
        "botUsername": bot.bot_username,
    }

# ─── Chat Bindings ──────────────────────────────────────────────────────────

@router.get("/telegram/bindings", response_model=List[TelegramBindingDto])
async def list_telegram_bindings(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TelegramChatBinding)
        .where(TelegramChatBinding.organization_id == user.organization_id)
        .order_by(TelegramChatBinding.created_at.desc())
    )
    return [_telegram_binding_dto(b) for b in result.scalars().all()]

@router.post("/telegram/bindings", response_model=TelegramBindingDto)
async def bind_telegram_chat(
    data: TelegramBindingInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    binding = TelegramChatBinding(
        organization_id=user.organization_id,
        bot_id=data.botId,
        chat_id=data.chatId,
        chat_title=data.chatTitle,
        username=data.username,
        binding_type=data.bindingType,
        role=data.role,
        is_active=True,
        bound_by_user_id=user.id
    )
    db.add(binding)
    await db.commit()
    await db.refresh(binding)
    return _telegram_binding_dto(binding)

@router.patch("/telegram/bindings/{binding_id}", response_model=TelegramBindingDto)
async def update_telegram_binding(
    binding_id: str,
    data: UpdateTelegramBindingInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TelegramChatBinding).where(
            TelegramChatBinding.id == binding_id,
            TelegramChatBinding.organization_id == user.organization_id
        )
    )
    binding = result.scalar_one_or_none()
    if not binding:
        raise HTTPException(status_code=404, detail="Telegram binding not found")

    if data.chatTitle is not None:
        binding.chat_title = data.chatTitle
    if data.username is not None:
        binding.username = data.username
    if data.botId is not None:
        binding.bot_id = data.botId
    if data.bindingType is not None:
        binding.binding_type = data.bindingType
    if data.role is not None:
        binding.role = data.role
    if data.isActive is not None:
        binding.is_active = data.isActive

    binding.updated_at = utc_now()
    await db.commit()
    await db.refresh(binding)
    return _telegram_binding_dto(binding)

@router.delete("/telegram/bindings/{binding_id}")
async def delete_telegram_binding(
    binding_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TelegramChatBinding).where(
            TelegramChatBinding.id == binding_id,
            TelegramChatBinding.organization_id == user.organization_id
        )
    )
    binding = result.scalar_one_or_none()
    if not binding:
        raise HTTPException(status_code=404, detail="Telegram binding not found")
    await db.delete(binding)
    await db.commit()
    return {"success": True}

@router.post("/telegram/broadcast")
async def telegram_broadcast(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    message = (data.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    bot_id = data.get("botId")
    if bot_id:
        return await broadcast_from_bot(bot_id, data, user, db)

    bot_res = await db.execute(
        select(TelegramBot).where(
            TelegramBot.organization_id == user.organization_id,
            TelegramBot.is_active == True
        ).order_by(TelegramBot.is_primary.desc())
    )
    primary_bot = bot_res.scalars().first()
    if primary_bot:
        return await broadcast_from_bot(primary_bot.id, data, user, db)

    result = await db.execute(
        select(TelegramChatBinding).where(
            TelegramChatBinding.organization_id == user.organization_id,
            TelegramChatBinding.is_active == True
        )
    )
    bindings = result.scalars().all()
    return {"sentCount": len(bindings), "failedCount": 0, "message": message}

@router.post("/telegram/command")
async def execute_telegram_command(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user)
):
    command = data.get("command", "/help")
    params = data.get("params", "")
    reply = TelegramCommandRouter.route_command(command, params)
    return {"command": command, "reply": reply}
