"""
Bot Builder — Workflows Controller.
CRUD for bot workflows, draft save, publish (snapshot → immutable version),
rollback, and version history.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser
from ..models import (
    BotWorkflow, BotWorkflowVersion, BotCommand,
    gen_id,
)
from ..schemas import (
    BotWorkflowDto,
    CreateBotWorkflowInput,
    UpdateBotWorkflowInput,
    PublishWorkflowInput,
    BotWorkflowVersionDto,
)

router = APIRouter(tags=["Bot Builder — Workflows"])


import json

def _ensure_json(val, default=list):
    if val is None:
        return default()
    while isinstance(val, str):
        try:
            val = json.loads(val)
        except Exception:
            return default()
    return val if val is not None else default()


def _workflow_dto(w: BotWorkflow) -> BotWorkflowDto:
    return BotWorkflowDto(
        id=w.id,
        organizationId=w.organization_id,
        botId=w.bot_id,
        name=w.name,
        description=w.description,
        status=w.status,
        draftNodes=_ensure_json(w.draft_nodes, list),
        draftEdges=_ensure_json(w.draft_edges, list),
        draftVariables=_ensure_json(w.draft_variables, list),
        publishedVersionId=w.published_version_id,
        publishedVersionNumber=w.published_version_number or 0,
        createdBy=w.created_by,
        createdAt=w.created_at.isoformat() if w.created_at else "",
        updatedAt=w.updated_at.isoformat() if w.updated_at else None,
    )


def _version_dto(v: BotWorkflowVersion) -> BotWorkflowVersionDto:
    return BotWorkflowVersionDto(
        id=v.id,
        organizationId=v.organization_id,
        workflowId=v.workflow_id,
        versionNumber=v.version_number,
        nodes=_ensure_json(v.nodes, list),
        edges=_ensure_json(v.edges, list),
        variables=_ensure_json(v.variables, list),
        commands=_ensure_json(v.commands, list),
        publishedBy=v.published_by,
        publishedAt=v.published_at.isoformat() if v.published_at else "",
        notes=v.notes,
    )


# ─── CRUD ───────────────────────────────────────────────────────────────────

@router.get("/bot-builder/bots/{bot_id}/workflows", response_model=List[BotWorkflowDto])
async def list_bot_workflows(
    bot_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotWorkflow).where(
            BotWorkflow.bot_id == bot_id,
            BotWorkflow.organization_id == user.organization_id,
        ).order_by(desc(BotWorkflow.updated_at))
    )
    return [_workflow_dto(w) for w in result.scalars().all()]


@router.post("/bot-builder/bots/{bot_id}/workflows", response_model=BotWorkflowDto, status_code=201)
async def create_bot_workflow(
    bot_id: str,
    data: CreateBotWorkflowInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Build initial start node for the canvas
    start_node = {
        "id": "start-1",
        "type": "start",
        "position": {"x": 400, "y": 80},
        "data": {"label": "Start", "config": {}},
    }
    initial_nodes = data.draftNodes if data.draftNodes else [start_node]

    wf = BotWorkflow(
        id=gen_id(),
        organization_id=user.organization_id,
        bot_id=bot_id,
        name=data.name,
        description=data.description,
        status="DRAFT",
        draft_nodes=initial_nodes,
        draft_edges=data.draftEdges,
        draft_variables=data.draftVariables,
        created_by=user.id,
    )
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return _workflow_dto(wf)


@router.post("/bot-builder/workflows", response_model=BotWorkflowDto, status_code=201)
async def create_bot_workflow_root(
    data: CreateBotWorkflowInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not data.botId:
        raise HTTPException(status_code=400, detail="botId is required")
    return await create_bot_workflow(bot_id=data.botId, data=data, user=user, db=db)


@router.get("/bot-builder/workflows/{workflow_id}", response_model=BotWorkflowDto)
async def get_bot_workflow(
    workflow_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotWorkflow).where(
            BotWorkflow.id == workflow_id,
            BotWorkflow.organization_id == user.organization_id,
        )
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _workflow_dto(wf)


@router.patch("/bot-builder/workflows/{workflow_id}", response_model=BotWorkflowDto)
async def update_bot_workflow(
    workflow_id: str,
    data: UpdateBotWorkflowInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotWorkflow).where(
            BotWorkflow.id == workflow_id,
            BotWorkflow.organization_id == user.organization_id,
        )
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if data.name is not None:
        wf.name = data.name
    if data.description is not None:
        wf.description = data.description
    if data.status is not None:
        wf.status = data.status
    if data.draftNodes is not None:
        wf.draft_nodes = data.draftNodes
    if data.draftEdges is not None:
        wf.draft_edges = data.draftEdges
    if data.draftVariables is not None:
        wf.draft_variables = data.draftVariables

    wf.updated_at = utc_now()
    await db.commit()
    await db.refresh(wf)
    return _workflow_dto(wf)


@router.delete("/bot-builder/workflows/{workflow_id}")
async def delete_bot_workflow(
    workflow_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotWorkflow).where(
            BotWorkflow.id == workflow_id,
            BotWorkflow.organization_id == user.organization_id,
        )
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(wf)
    await db.commit()
    return {"success": True}


# ─── Publish & Version ──────────────────────────────────────────────────────

@router.post("/bot-builder/workflows/{workflow_id}/publish", response_model=BotWorkflowVersionDto, status_code=201)
async def publish_workflow(
    workflow_id: str,
    data: PublishWorkflowInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Snapshot current draft → create immutable version → point workflow to it."""
    result = await db.execute(
        select(BotWorkflow).where(
            BotWorkflow.id == workflow_id,
            BotWorkflow.organization_id == user.organization_id,
        )
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # If draft payload is provided in publish request, atomically update draft
    if data.draftNodes is not None:
        wf.draft_nodes = data.draftNodes
    if data.draftEdges is not None:
        wf.draft_edges = data.draftEdges
    if data.draftVariables is not None:
        wf.draft_variables = data.draftVariables

    current_nodes = _ensure_json(wf.draft_nodes, list)
    if not current_nodes or len(current_nodes) == 0:
        raise HTTPException(status_code=400, detail="Cannot publish an empty workflow — add at least one node")

    # Get commands for this bot to snapshot
    cmd_result = await db.execute(
        select(BotCommand).where(
            BotCommand.bot_id == wf.bot_id,
            BotCommand.organization_id == user.organization_id,
            BotCommand.is_active == True,
        )
    )
    commands = [
        {"command": c.command, "description": c.description or "", "workflowId": c.workflow_id}
        for c in cmd_result.scalars().all()
    ]

    new_version_number = (wf.published_version_number or 0) + 1

    version = BotWorkflowVersion(
        id=gen_id(),
        organization_id=user.organization_id,
        workflow_id=wf.id,
        version_number=new_version_number,
        nodes=current_nodes,
        edges=_ensure_json(wf.draft_edges, list),
        variables=_ensure_json(wf.draft_variables, list),
        commands=commands,
        published_by=user.id,
        published_at=utc_now(),
        notes=data.notes,
    )
    db.add(version)

    wf.published_version_id = version.id
    wf.published_version_number = new_version_number
    wf.status = "PUBLISHED"
    wf.updated_at = utc_now()

    await db.commit()
    await db.refresh(version)

    # Auto-register webhook with Telegram so the workflow is immediately live
    try:
        from app.modules.automations.models import TelegramBot
        from ..engine.telegram_adapter import TelegramAdapter
        from app.core.crypto import EncryptionService
        bot_res = await db.execute(
            select(TelegramBot).where(TelegramBot.id == wf.bot_id)
        )
        bot_entity = bot_res.scalar_one_or_none()
        if bot_entity and bot_entity.bot_token:
            try:
                decrypted_token = EncryptionService.decrypt(bot_entity.bot_token)
            except Exception:
                decrypted_token = bot_entity.bot_token
            adapter = TelegramAdapter(decrypted_token)
            from app.core.config import settings
            gateway_base = getattr(settings, "GATEWAY_URL", "").rstrip("/")
            if not gateway_base or not gateway_base.startswith("https://"):
                gateway_base = "https://gateway.camtech.cam"
            webhook_url = f"{gateway_base}/api/v1/bot-builder/webhook/{wf.bot_id}"
            await adapter.set_webhook(webhook_url)
    except Exception as exc:
        logger.warning("Auto webhook registration skipped or failed on publish: %s", exc)

    return _version_dto(version)


@router.post("/bot-builder/workflows/{workflow_id}/rollback/{version_number}", response_model=BotWorkflowDto)
async def rollback_workflow(
    workflow_id: str,
    version_number: int,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rollback production to a previous version without touching the draft."""
    wf_result = await db.execute(
        select(BotWorkflow).where(
            BotWorkflow.id == workflow_id,
            BotWorkflow.organization_id == user.organization_id,
        )
    )
    wf = wf_result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    ver_result = await db.execute(
        select(BotWorkflowVersion).where(
            BotWorkflowVersion.workflow_id == workflow_id,
            BotWorkflowVersion.version_number == version_number,
        )
    )
    version = ver_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail=f"Version v{version_number} not found")

    wf.published_version_id = version.id
    wf.published_version_number = version.version_number
    wf.status = "PUBLISHED"
    wf.updated_at = utc_now()

    await db.commit()
    await db.refresh(wf)
    return _workflow_dto(wf)


# ─── Version History ────────────────────────────────────────────────────────

@router.get("/bot-builder/workflows/{workflow_id}/versions", response_model=List[BotWorkflowVersionDto])
async def list_workflow_versions(
    workflow_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotWorkflowVersion).where(
            BotWorkflowVersion.workflow_id == workflow_id,
            BotWorkflowVersion.organization_id == user.organization_id,
        ).order_by(desc(BotWorkflowVersion.version_number))
    )
    return [_version_dto(v) for v in result.scalars().all()]


@router.get("/bot-builder/workflows/{workflow_id}/versions/{version_number}", response_model=BotWorkflowVersionDto)
async def get_workflow_version(
    workflow_id: str,
    version_number: int,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotWorkflowVersion).where(
            BotWorkflowVersion.workflow_id == workflow_id,
            BotWorkflowVersion.version_number == version_number,
            BotWorkflowVersion.organization_id == user.organization_id,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail=f"Version v{version_number} not found")
    return _version_dto(version)
