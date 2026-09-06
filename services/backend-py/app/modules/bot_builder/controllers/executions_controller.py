"""
Bot Builder — Executions Controller.
View execution history and individual execution traces for debugging.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from ..models import BotExecution
from ..schemas import BotExecutionDto, BotExecutionTraceItemDto

router = APIRouter(tags=["Bot Builder — Executions"])


import json

def _ensure_json(val, default=list):
    if val is None:
        return default()
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return default()
    return val


def _execution_dto(e: BotExecution) -> BotExecutionDto:
    trace = _ensure_json(e.execution_trace, list)
    return BotExecutionDto(
        id=e.id,
        organizationId=e.organization_id,
        botId=e.bot_id,
        workflowId=e.workflow_id,
        workflowVersionId=e.workflow_version_id,
        versionNumber=e.version_number,
        telegramUserId=e.telegram_user_id,
        chatId=e.chat_id,
        triggerType=e.trigger_type,
        triggerData=_ensure_json(e.trigger_data, dict),
        executionTrace=[
            BotExecutionTraceItemDto(
                nodeId=t.get("nodeId", ""),
                nodeName=t.get("nodeName", ""),
                nodeType=t.get("nodeType", ""),
                status=t.get("status", "SUCCESS"),
                inputData=t.get("inputData"),
                outputData=t.get("outputData"),
                errorMessage=t.get("errorMessage"),
                durationMs=t.get("durationMs", 0),
            ) for t in trace
        ],
        status=e.status,
        errorMessage=e.error_message,
        startedAt=e.started_at.isoformat() if e.started_at else "",
        finishedAt=e.finished_at.isoformat() if e.finished_at else None,
    )


@router.get("/bot-builder/bots/{bot_id}/executions", response_model=List[BotExecutionDto])
async def list_bot_executions(
    bot_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(BotExecution).where(
        BotExecution.bot_id == bot_id,
        BotExecution.organization_id == user.organization_id,
    )
    if status:
        query = query.where(BotExecution.status == status.upper())
    query = query.order_by(desc(BotExecution.started_at)).offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    return [_execution_dto(e) for e in result.scalars().all()]


@router.get("/bot-builder/executions/{execution_id}", response_model=BotExecutionDto)
async def get_execution(
    execution_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotExecution).where(
            BotExecution.id == execution_id,
            BotExecution.organization_id == user.organization_id,
        )
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return _execution_dto(execution)


@router.get("/bot-builder/bots/{bot_id}/analytics")
async def bot_analytics(
    bot_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Basic analytics for a bot: total executions, success rate, unique users."""
    base_filter = [
        BotExecution.bot_id == bot_id,
        BotExecution.organization_id == user.organization_id,
    ]

    total_result = await db.execute(
        select(func.count(BotExecution.id)).where(*base_filter)
    )
    total = total_result.scalar() or 0

    success_result = await db.execute(
        select(func.count(BotExecution.id)).where(
            *base_filter, BotExecution.status == "SUCCESS",
        )
    )
    success = success_result.scalar() or 0

    users_result = await db.execute(
        select(func.count(func.distinct(BotExecution.telegram_user_id))).where(*base_filter)
    )
    unique_users = users_result.scalar() or 0

    return {
        "totalExecutions": total,
        "successCount": success,
        "failedCount": total - success,
        "successRate": round((success / total * 100), 1) if total > 0 else 0,
        "uniqueUsers": unique_users,
    }
