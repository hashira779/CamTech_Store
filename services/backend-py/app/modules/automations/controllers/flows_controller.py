import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser
from app.domain.enterprise_engines import FlowExecutionEngine
from ..models import AutomationFlow, FlowExecution
from ..schemas import AutomationFlowDto, CreateFlowInput, FlowExecutionDto

router = APIRouter(tags=["Automation Flows"])

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
        started_at=datetime.datetime.fromisoformat(exec_result["startedAt"]) if exec_result.get("startedAt") else utc_now(),
        finished_at=datetime.datetime.fromisoformat(exec_result["completedAt"]) if exec_result.get("completedAt") else utc_now()
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
