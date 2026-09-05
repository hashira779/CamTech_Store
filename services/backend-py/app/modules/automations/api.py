import datetime
import uuid
from typing import Dict, Any, List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.exc import IntegrityError

from app.core.crypto import EncryptionService
from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.domain.enterprise_engines import TelegramCommandRouter, ApiKeyGenerator, FlowExecutionEngine
from app.models.entities import NotificationConfig

from .models import DeveloperApp, ApiKey, WebhookSubscription, TelegramChatBinding, AutomationFlow, FlowExecution
from .schemas import DeveloperAppDto, ApiKeyDto, AutomationFlowDto, CreateFlowInput, FlowExecutionDto
from .telegram_schemas import (
    TelegramBindingDto,
    TelegramBindingInput,
    TelegramConfigDto,
    UpdateTelegramBindingInput,
    UpdateTelegramConfigInput,
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

# ─── Telegram Integrations ──────────────────────────────────────────────────


def _telegram_config_dto(config: NotificationConfig) -> TelegramConfigDto:
    token_preview = None
    if config.telegram_bot_token:
        try:
            token = EncryptionService.decrypt(config.telegram_bot_token)
            token_preview = f"••••••{token[-6:]}"
        except ValueError:
            token_preview = "••••••"
    return TelegramConfigDto(
        enabled=config.telegram_enabled,
        hasToken=bool(config.telegram_bot_token),
        tokenPreview=token_preview,
        defaultChatId=config.telegram_chat_id,
        updatedAt=config.updated_at.isoformat() if config.updated_at else None,
    )


def _telegram_binding_dto(binding: TelegramChatBinding) -> TelegramBindingDto:
    return TelegramBindingDto(
        id=binding.id,
        organizationId=binding.organization_id,
        chatId=binding.chat_id,
        chatTitle=binding.chat_title,
        username=binding.username,
        bindingType=binding.binding_type,
        role=binding.role,
        isActive=binding.is_active,
        boundByUserId=binding.bound_by_user_id,
        createdAt=binding.created_at.isoformat() if binding.created_at else None,
        updatedAt=binding.updated_at.isoformat() if binding.updated_at else None,
    )


async def _get_or_create_telegram_config(db: AsyncSession, organization_id: str) -> NotificationConfig:
    result = await db.execute(
        select(NotificationConfig).where(NotificationConfig.organization_id == organization_id)
    )
    config = result.scalar_one_or_none()
    if config:
        return config
    config = NotificationConfig(organization_id=organization_id)
    db.add(config)
    await db.flush()
    return config


@router.get("/telegram/config", response_model=TelegramConfigDto)
async def get_telegram_config(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_or_create_telegram_config(db, user.organization_id)
    await db.commit()
    return _telegram_config_dto(config)


@router.patch("/telegram/config", response_model=TelegramConfigDto)
async def update_telegram_config(
    data: UpdateTelegramConfigInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_or_create_telegram_config(db, user.organization_id)
    if data.enabled is not None:
        config.telegram_enabled = data.enabled
    if data.clearToken:
        config.telegram_bot_token = None
    elif data.botToken:
        config.telegram_bot_token = EncryptionService.encrypt(data.botToken)
    if data.defaultChatId is not None:
        config.telegram_chat_id = data.defaultChatId or None
    config.updated_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(config)
    return _telegram_config_dto(config)


@router.post("/telegram/config/test")
async def test_telegram_config(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NotificationConfig).where(NotificationConfig.organization_id == user.organization_id)
    )
    config = result.scalar_one_or_none()
    if not config or not config.telegram_bot_token:
        raise HTTPException(status_code=400, detail="Configure a Telegram bot token first")
    try:
        token = EncryptionService.decrypt(config.telegram_bot_token)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"https://api.telegram.org/bot{token}/getMe")
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Unable to reach Telegram with this token") from exc
    if not response.is_success or not payload.get("ok"):
        raise HTTPException(status_code=400, detail="Telegram rejected the configured bot token")
    return {
        "success": True,
        "botUsername": payload.get("result", {}).get("username"),
        "botName": payload.get("result", {}).get("first_name"),
    }


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
    return [_telegram_binding_dto(binding) for binding in result.scalars().all()]


@router.post("/telegram/bindings", response_model=TelegramBindingDto)
async def bind_telegram_chat(
    data: TelegramBindingInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    binding = TelegramChatBinding(
        organization_id=user.organization_id,
        chat_id=data.chatId,
        chat_title=data.chatTitle,
        username=data.username,
        binding_type=data.bindingType,
        role=data.role,
        is_active=True,
        bound_by_user_id=user.id
    )
    db.add(binding)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="This Telegram destination is already bound") from exc
    await db.refresh(binding)
    return _telegram_binding_dto(binding)


@router.patch("/telegram/bindings/{binding_id}", response_model=TelegramBindingDto)
async def update_telegram_binding(
    binding_id: str,
    data: UpdateTelegramBindingInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TelegramChatBinding).where(
            TelegramChatBinding.id == binding_id,
            TelegramChatBinding.organization_id == user.organization_id,
        )
    )
    binding = result.scalar_one_or_none()
    if not binding:
        raise HTTPException(status_code=404, detail="Telegram binding not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(binding, {
            "chatTitle": "chat_title",
            "bindingType": "binding_type",
            "isActive": "is_active",
        }.get(field, field), value)
    binding.updated_at = datetime.datetime.now(datetime.timezone.utc)
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
    config_result = await db.execute(
        select(NotificationConfig).where(NotificationConfig.organization_id == user.organization_id)
    )
    config = config_result.scalar_one_or_none()
    if not config or not config.telegram_enabled or not config.telegram_bot_token:
        raise HTTPException(status_code=400, detail="Telegram bot is not enabled or configured")
    result = await db.execute(
        select(TelegramChatBinding).where(
            TelegramChatBinding.organization_id == user.organization_id,
            TelegramChatBinding.is_active == True,
        )
    )
    bindings = result.scalars().all()
    token = EncryptionService.decrypt(config.telegram_bot_token)
    sent_count = 0
    failed_count = 0
    async with httpx.AsyncClient(timeout=10.0) as client:
        for binding in bindings:
            try:
                response = await client.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json={"chat_id": binding.chat_id, "text": message},
                )
                if response.is_success and response.json().get("ok"):
                    sent_count += 1
                else:
                    failed_count += 1
            except httpx.HTTPError:
                failed_count += 1
    return {"sentCount": sent_count, "failedCount": failed_count, "message": message}

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
