import datetime
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, or_

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.core.crypto import EncryptionService
from app.domain.enterprise_engines import TelegramCommandRouter, ApiKeyGenerator, FlowExecutionEngine

from .models import DeveloperApp, ApiKey, WebhookSubscription, TelegramChatBinding, TelegramBot, AutomationFlow, FlowExecution
from .schemas import DeveloperAppDto, ApiKeyDto, AutomationFlowDto, CreateFlowInput, FlowExecutionDto
from .telegram_schemas import (
    TelegramBotDto,
    CreateTelegramBotInput,
    UpdateTelegramBotInput,
    TelegramBindingDto,
    TelegramBindingInput,
    UpdateTelegramBindingInput,
)

router = APIRouter(tags=["Automations & Integrations"])

# ─── Developer Apps ─────────────────────────────────────────────────────────

@router.get("/developers/apps")
async def list_developer_apps(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DeveloperApp)
        .where(DeveloperApp.organization_id == user.organization_id)
        .order_by(DeveloperApp.created_at.desc())
    )
    apps = result.scalars().all()
    return [
        {
            "id": a.id,
            "organizationId": a.organization_id,
            "name": a.name,
            "description": a.description,
            "homepageUrl": a.homepage_url,
            "createdAt": a.created_at.isoformat() if a.created_at else None,
            "updatedAt": a.updated_at.isoformat() if a.updated_at else None,
            "status": "ACTIVE"
        } for a in apps
    ]

@router.post("/developers/apps")
async def create_developer_app(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="App name is required")

    app_record = DeveloperApp(
        organization_id=user.organization_id,
        name=name,
        description=data.get("description"),
        homepage_url=data.get("homepageUrl")
    )
    db.add(app_record)
    await db.commit()
    await db.refresh(app_record)

    return {
        "id": app_record.id,
        "organizationId": app_record.organization_id,
        "name": app_record.name,
        "description": app_record.description,
        "homepageUrl": app_record.homepage_url,
        "createdAt": app_record.created_at.isoformat() if app_record.created_at else None,
        "updatedAt": app_record.updated_at.isoformat() if app_record.updated_at else None,
        "status": "ACTIVE"
    }

# ─── API Keys ───────────────────────────────────────────────────────────────

@router.get("/developers/keys")
async def list_api_keys(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.organization_id == user.organization_id)
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        {
            "id": k.id,
            "organizationId": k.organization_id,
            "appId": k.app_id,
            "name": k.name,
            "keyPrefix": k.key_prefix,
            "scopes": k.scopes or [],
            "rateLimit": k.rate_limit,
            "expiresAt": k.expires_at.isoformat() if k.expires_at else None,
            "lastUsedAt": k.last_used_at.isoformat() if k.last_used_at else None,
            "revokedAt": k.revoked_at.isoformat() if k.revoked_at else None,
            "status": "REVOKED" if k.revoked_at else "ACTIVE",
            "createdAt": k.created_at.isoformat() if k.created_at else None
        } for k in keys
    ]

@router.post("/developers/keys")
async def create_api_key(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    name = (data.get("name") or "Default Key").strip()
    key_info = ApiKeyGenerator.generate_api_key("live")

    expires_in_days = data.get("expiresInDays")
    expires_at = None
    if expires_in_days:
        try:
            expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=int(expires_in_days))
        except (ValueError, TypeError):
            expires_at = None

    key_record = ApiKey(
        organization_id=user.organization_id,
        app_id=data.get("appId") or None,
        name=name,
        key_prefix=key_info["keyPrefix"],
        key_hash=key_info["keyHash"],
        scopes=data.get("scopes", ["products:read"]),
        rate_limit=int(data.get("rateLimit", 60)),
        expires_at=expires_at
    )
    db.add(key_record)
    await db.commit()
    await db.refresh(key_record)

    return {
        "id": key_record.id,
        "organizationId": key_record.organization_id,
        "appId": key_record.app_id,
        "name": key_record.name,
        "keyPrefix": key_record.key_prefix,
        "scopes": key_record.scopes or [],
        "rateLimit": key_record.rate_limit,
        "expiresAt": key_record.expires_at.isoformat() if key_record.expires_at else None,
        "lastUsedAt": None,
        "revokedAt": None,
        "status": "ACTIVE",
        "createdAt": key_record.created_at.isoformat() if key_record.created_at else None,
        "secretKey": key_info["rawKey"],
        "rawKey": key_info["rawKey"]
    }

@router.delete("/developers/keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.organization_id == user.organization_id)
    )
    key_record = result.scalar_one_or_none()
    if not key_record:
        raise HTTPException(status_code=404, detail="API Key not found")

    key_record.revoked_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(key_record)

    return {
        "id": key_record.id,
        "organizationId": key_record.organization_id,
        "appId": key_record.app_id,
        "name": key_record.name,
        "keyPrefix": key_record.key_prefix,
        "scopes": key_record.scopes or [],
        "rateLimit": key_record.rate_limit,
        "expiresAt": key_record.expires_at.isoformat() if key_record.expires_at else None,
        "lastUsedAt": key_record.last_used_at.isoformat() if key_record.last_used_at else None,
        "revokedAt": key_record.revoked_at.isoformat() if key_record.revoked_at else None,
        "status": "REVOKED",
        "createdAt": key_record.created_at.isoformat() if key_record.created_at else None
    }

# ─── Webhook Subscriptions ──────────────────────────────────────────────────

@router.get("/developers/webhooks")
async def list_webhooks(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(WebhookSubscription)
        .where(WebhookSubscription.organization_id == user.organization_id)
        .order_by(WebhookSubscription.created_at.desc())
    )
    subs = result.scalars().all()
    return [
        {
            "id": s.id,
            "organizationId": s.organization_id,
            "url": s.url,
            "description": s.description,
            "events": s.events or [],
            "isActive": s.is_active,
            "createdAt": s.created_at.isoformat() if s.created_at else None,
            "updatedAt": s.updated_at.isoformat() if s.updated_at else None
        } for s in subs
    ]

@router.post("/developers/webhooks")
async def create_webhook(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    url = (data.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Webhook URL is required")

    secret = f"whsec_{uuid.uuid4().hex}"
    events = data.get("events", [])
    if not isinstance(events, list) or len(events) == 0:
        events = ["order.created"]

    sub = WebhookSubscription(
        organization_id=user.organization_id,
        url=url,
        secret=secret,
        description=data.get("description"),
        events=events,
        is_active=True
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    return {
        "id": sub.id,
        "organizationId": sub.organization_id,
        "url": sub.url,
        "description": sub.description,
        "events": sub.events or [],
        "isActive": sub.is_active,
        "createdAt": sub.created_at.isoformat() if sub.created_at else None,
        "updatedAt": sub.updated_at.isoformat() if sub.updated_at else None
    }

@router.delete("/developers/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.id == webhook_id,
            WebhookSubscription.organization_id == user.organization_id
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Webhook subscription not found")

    await db.delete(sub)
    await db.commit()
    return {"success": True}

# ─── Telegram Multi-Bot & Integrations ────────────────────────────────────────

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
        last_tested_at=datetime.datetime.utcnow(),
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
        bot.last_tested_at = datetime.datetime.utcnow()

    bot.updated_at = datetime.datetime.utcnow()
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

    # Unlink any chat bindings referencing this bot before deleting
    from sqlalchemy import update
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

    bot.last_tested_at = datetime.datetime.utcnow()
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

    # Find destinations: all bindings mapped to this bot, or general bindings if none
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

    binding.updated_at = datetime.datetime.utcnow()
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

@router.get("/flows", response_model=List[AutomationFlowDto])
async def list_flows(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AutomationFlow).where(AutomationFlow.organization_id == user.organization_id)
    )
    flows = result.scalars().all()
    return [
        AutomationFlowDto(
            id=f.id,
            organizationId=f.organization_id,
            name=f.name,
            description=f.description,
            isActive=f.is_active,
            triggerType=f.trigger_type,
            nodes=f.nodes or [],
            edges=f.edges or [],
            createdAt=f.created_at.isoformat(),
            updatedAt=f.updated_at.isoformat() if hasattr(f, 'updated_at') and f.updated_at else None
        ) for f in flows
    ]

@router.post("/flows", response_model=AutomationFlowDto)
async def create_flow(
    flow_in: CreateFlowInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    flow = AutomationFlow(
        organization_id=user.organization_id,
        name=flow_in.name,
        description=flow_in.description,
        is_active=flow_in.isActive if flow_in.isActive is not None else True,
        trigger_type=flow_in.triggerType,
        nodes=flow_in.nodes,
        edges=flow_in.edges
    )
    db.add(flow)
    await db.commit()
    await db.refresh(flow)

    return AutomationFlowDto(
        id=flow.id,
        organizationId=flow.organization_id,
        name=flow.name,
        description=flow.description,
        isActive=flow.is_active,
        triggerType=flow.trigger_type,
        nodes=flow.nodes or [],
        edges=flow.edges or [],
        createdAt=flow.created_at.isoformat(),
        updatedAt=flow.updated_at.isoformat() if hasattr(flow, 'updated_at') and flow.updated_at else None
    )

@router.get("/flows/{flow_id}", response_model=AutomationFlowDto)
async def get_flow(
    flow_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AutomationFlow).where(
            AutomationFlow.id == flow_id,
            AutomationFlow.organization_id == user.organization_id
        )
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return AutomationFlowDto(
        id=flow.id,
        organizationId=flow.organization_id,
        name=flow.name,
        description=flow.description,
        isActive=flow.is_active,
        triggerType=flow.trigger_type,
        nodes=flow.nodes or [],
        edges=flow.edges or [],
        createdAt=flow.created_at.isoformat(),
        updatedAt=flow.updated_at.isoformat() if hasattr(flow, 'updated_at') and flow.updated_at else None
    )

@router.patch("/flows/{flow_id}", response_model=AutomationFlowDto)
async def update_flow(
    flow_id: str,
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AutomationFlow).where(
            AutomationFlow.id == flow_id,
            AutomationFlow.organization_id == user.organization_id
        )
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    if "name" in data:
        flow.name = data["name"]
    if "description" in data:
        flow.description = data["description"]
    if "isActive" in data:
        flow.is_active = data["isActive"]
    if "triggerType" in data:
        flow.trigger_type = data["triggerType"]
    if "nodes" in data:
        flow.nodes = data["nodes"]
    if "edges" in data:
        flow.edges = data["edges"]
    await db.commit()
    await db.refresh(flow)
    return AutomationFlowDto(
        id=flow.id,
        organizationId=flow.organization_id,
        name=flow.name,
        description=flow.description,
        isActive=flow.is_active,
        triggerType=flow.trigger_type,
        nodes=flow.nodes or [],
        edges=flow.edges or [],
        createdAt=flow.created_at.isoformat(),
        updatedAt=flow.updated_at.isoformat() if hasattr(flow, 'updated_at') and flow.updated_at else None
    )

@router.delete("/flows/{flow_id}")
async def delete_flow(
    flow_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AutomationFlow).where(
            AutomationFlow.id == flow_id,
            AutomationFlow.organization_id == user.organization_id
        )
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    await db.delete(flow)
    await db.commit()
    return {"success": True}

@router.post("/flows/{flow_id}/execute", response_model=FlowExecutionDto)
async def execute_flow(
    flow_id: str,
    payload: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AutomationFlow).where(
            AutomationFlow.id == flow_id,
            AutomationFlow.organization_id == user.organization_id
        )
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    exec_result = await FlowExecutionEngine.execute(flow.nodes, flow.edges, payload)

    execution = FlowExecution(
        organization_id=user.organization_id,
        flow_id=flow.id,
        trigger_type="MANUAL",
        status=exec_result["status"],
        trigger_payload=payload,
        execution_trace=exec_result.get("executionTrace", []),
        started_at=datetime.datetime.fromisoformat(exec_result["startedAt"]) if exec_result.get("startedAt") else datetime.datetime.utcnow(),
        finished_at=datetime.datetime.fromisoformat(exec_result["completedAt"]) if exec_result.get("completedAt") else datetime.datetime.utcnow()
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    return FlowExecutionDto(
        id=execution.id,
        organizationId=execution.organization_id,
        flowId=execution.flow_id,
        triggerType=execution.trigger_type,
        status=execution.status,
        triggerPayload=execution.trigger_payload,
        executionTrace=execution.execution_trace,
        startedAt=execution.started_at.isoformat(),
        finishedAt=execution.finished_at.isoformat() if execution.finished_at else None
    )

@router.get("/flows/{flow_id}/executions", response_model=List[FlowExecutionDto])
async def list_flow_executions(
    flow_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FlowExecution)
        .where(
            FlowExecution.flow_id == flow_id,
            FlowExecution.organization_id == user.organization_id
        )
        .order_by(desc(FlowExecution.started_at))
        .limit(20)
    )
    execs = result.scalars().all()
    return [
        FlowExecutionDto(
            id=e.id,
            organizationId=e.organization_id,
            flowId=e.flow_id,
            triggerType=e.trigger_type,
            status=e.status,
            triggerPayload=e.trigger_payload,
            executionTrace=e.execution_trace,
            startedAt=e.started_at.isoformat(),
            finishedAt=e.finished_at.isoformat() if e.finished_at else None
        ) for e in execs
    ]
