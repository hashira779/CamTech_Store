from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.domain.enterprise_engines import TelegramCommandRouter, ApiKeyGenerator, FlowExecutionEngine
import datetime

from .models import DeveloperApp, ApiKey, TelegramChatBinding, AutomationFlow, FlowExecution
from .schemas import DeveloperAppDto, ApiKeyDto, AutomationFlowDto, CreateFlowInput, FlowExecutionDto

router = APIRouter(tags=["Automations & Integrations"])

@router.get("/developers/apps")
async def list_developer_apps(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DeveloperApp).where(DeveloperApp.organization_id == user.organization_id)
    )
    apps = result.scalars().all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "status": "ACTIVE" # Model does not have status
        } for a in apps
    ]

@router.post("/developers/keys")
async def create_api_key(
    data: Dict[str, Any],
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    name = data.get("name", "Default Key")
    key_info = ApiKeyGenerator.generate_api_key("live")

    key_record = ApiKey(
        organization_id=user.organization_id,
        app_id=data.get("appId"),
        name=name,
        key_prefix=key_info["keyPrefix"],
        key_hash=key_info["keyHash"],
        scopes=data.get("scopes", ["products:read"]),
        rate_limit=int(data.get("rateLimit", 60)),
    )
    db.add(key_record)
    await db.commit()
    await db.refresh(key_record)

    return {
        "id": key_record.id,
        "name": key_record.name,
        "keyPrefix": key_record.key_prefix,
        "rawKey": key_info["rawKey"],
        "status": "ACTIVE", # Model does not have status
        "createdAt": key_record.created_at.isoformat()
    }

@router.get("/telegram/bindings")
async def list_telegram_bindings(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TelegramChatBinding).where(TelegramChatBinding.organization_id == user.organization_id)
    )
    bindings = result.scalars().all()
    return [
        {
            "id": b.id,
            "chatId": b.chat_id,
            "chatTitle": b.chat_title,
            "role": b.role,
            "isActive": b.is_active
        } for b in bindings
    ]

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
            name=f.name,
            description=f.description,
            isActive=f.is_active,
            triggerType=f.trigger_type,
            nodes=f.nodes or [],
            edges=f.edges or [],
            createdAt=f.created_at.isoformat()
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
        name=flow.name,
        description=flow.description,
        isActive=flow.is_active,
        triggerType=flow.trigger_type,
        nodes=flow.nodes or [],
        edges=flow.edges or [],
        createdAt=flow.created_at.isoformat()
    )

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
        execution_trace=exec_result.get("trace", []),
        started_at=datetime.datetime.fromisoformat(exec_result["startedAt"]) if exec_result.get("startedAt") else datetime.datetime.utcnow(),
        finished_at=datetime.datetime.fromisoformat(exec_result["completedAt"]) if exec_result.get("completedAt") else datetime.datetime.utcnow()
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    return FlowExecutionDto(
        id=execution.id,
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
            flowId=e.flow_id,
            triggerType=e.trigger_type,
            status=e.status,
            triggerPayload=e.trigger_payload,
            executionTrace=e.execution_trace,
            startedAt=e.started_at.isoformat(),
            finishedAt=e.finished_at.isoformat() if e.finished_at else None
        ) for e in execs
    ]
