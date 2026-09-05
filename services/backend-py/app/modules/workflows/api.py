import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import (
    WorkflowInstance,
    WorkflowStep,
    WorkflowLog,
    ApprovalRequest,
    gen_id,
)
from .schemas import (
    WorkflowInstanceDto,
    WorkflowStepDto,
    WorkflowLogDto,
    CreateWorkflowStepInput,
    SubmitApprovalInput,
    ReviewWorkflowStepInput,
    ApprovalRequestDto,
    ApprovalDecisionInput,
    ApprovalSignResponse,
)

router = APIRouter(tags=["Workflow & Approvals"])

# ─── Helper Mappers ─────────────────────────────────────────────────────────

def _build_step_dto(s: WorkflowStep) -> WorkflowStepDto:
    return WorkflowStepDto(
        id=s.id,
        instanceId=s.instance_id,
        stepOrder=s.step_order,
        name=s.name,
        assignedRole=s.assigned_role,
        assignedToId=s.assigned_to_id,
        status=s.status,
        decisionBy=s.decision_by,
        decisionAt=s.decision_at.isoformat() if s.decision_at else None,
        comment=s.comment,
    )

def _build_log_dto(l: WorkflowLog) -> WorkflowLogDto:
    return WorkflowLogDto(
        id=l.id,
        instanceId=l.instance_id,
        actorId=l.actor_id,
        action=l.action,
        comment=l.comment,
        createdAt=l.created_at.isoformat() if l.created_at else datetime.datetime.utcnow().isoformat(),
    )

def _build_instance_dto(
    i: WorkflowInstance,
    steps: List[WorkflowStep],
    logs: List[WorkflowLog],
) -> WorkflowInstanceDto:
    meta = i.metadata_ if hasattr(i, "metadata_") and i.metadata_ else {}
    if isinstance(meta, str):
        import json
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}

    return WorkflowInstanceDto(
        id=i.id,
        organizationId=i.organization_id,
        definitionId=i.definition_id,
        entityType=i.entity_type,
        entityId=i.entity_id,
        title=i.title,
        status=i.status,
        submittedById=i.submitted_by_id,
        currentStep=i.current_step,
        totalSteps=i.total_steps,
        metadata=meta if isinstance(meta, dict) else {},
        steps=[_build_step_dto(s) for s in sorted(steps, key=lambda s: s.step_order)],
        logs=[_build_log_dto(l) for l in sorted(logs, key=lambda l: l.created_at or datetime.datetime.min, reverse=True)],
        createdAt=i.created_at.isoformat() if i.created_at else datetime.datetime.utcnow().isoformat(),
        updatedAt=i.updated_at.isoformat() if i.updated_at else datetime.datetime.utcnow().isoformat(),
    )

# ─── Workflow Instances Endpoints (Spec §51) ───────────────────────────────

@router.get("/workflows/instances", response_model=List[WorkflowInstanceDto])
async def list_workflow_instances(
    status: Optional[str] = Query(None),
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(WorkflowInstance).where(
        WorkflowInstance.organization_id == user.organization_id
    )
    if status and status.upper() != "ALL":
        query = query.where(WorkflowInstance.status == status.upper().strip())
    query = query.order_by(WorkflowInstance.created_at.desc())

    result = await db.execute(query)
    instances = result.scalars().all()
    if not instances:
        return []

    inst_ids = [inst.id for inst in instances]
    steps_res = await db.execute(
        select(WorkflowStep).where(WorkflowStep.instance_id.in_(inst_ids)).order_by(WorkflowStep.step_order.asc())
    )
    all_steps = steps_res.scalars().all()
    steps_by_inst: Dict[str, List[WorkflowStep]] = {}
    for s in all_steps:
        steps_by_inst.setdefault(s.instance_id, []).append(s)

    logs_res = await db.execute(
        select(WorkflowLog).where(WorkflowLog.instance_id.in_(inst_ids)).order_by(WorkflowLog.created_at.desc())
    )
    all_logs = logs_res.scalars().all()
    logs_by_inst: Dict[str, List[WorkflowLog]] = {}
    for l in all_logs:
        logs_by_inst.setdefault(l.instance_id, []).append(l)

    return [
        _build_instance_dto(inst, steps_by_inst.get(inst.id, []), logs_by_inst.get(inst.id, []))
        for inst in instances
    ]

@router.get("/workflows/instances/{instance_id}", response_model=WorkflowInstanceDto)
async def get_workflow_instance(
    instance_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowInstance).where(
            WorkflowInstance.id == instance_id,
            WorkflowInstance.organization_id == user.organization_id,
        )
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found")

    steps_res = await db.execute(
        select(WorkflowStep).where(WorkflowStep.instance_id == instance_id).order_by(WorkflowStep.step_order.asc())
    )
    steps = steps_res.scalars().all()

    logs_res = await db.execute(
        select(WorkflowLog).where(WorkflowLog.instance_id == instance_id).order_by(WorkflowLog.created_at.desc())
    )
    logs = logs_res.scalars().all()

    return _build_instance_dto(instance, steps, logs)

@router.post("/workflows/instances", response_model=WorkflowInstanceDto, status_code=201)
async def submit_workflow_instance(
    data: SubmitApprovalInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    steps_data = data.steps if data.steps and len(data.steps) > 0 else [
        CreateWorkflowStepInput(stepOrder=1, name="Manager Review", assignedRole="BRANCH_MANAGER"),
        CreateWorkflowStepInput(stepOrder=2, name="Executive Approval", assignedRole="SUPER_ADMIN"),
    ]

    now = datetime.datetime.utcnow()
    instance_id = gen_id()
    instance = WorkflowInstance(
        id=instance_id,
        organization_id=user.organization_id,
        definition_id=data.definitionId,
        entity_type=data.entityType,
        entity_id=data.entityId,
        title=data.title,
        status="PENDING",
        submitted_by_id=user.id,
        current_step=1,
        total_steps=len(steps_data),
        metadata_=data.metadata,
        created_at=now,
        updated_at=now,
    )
    db.add(instance)

    created_steps = []
    for s in steps_data:
        step = WorkflowStep(
            id=gen_id(),
            instance_id=instance_id,
            step_order=s.stepOrder,
            name=s.name,
            assigned_role=s.assignedRole,
            assigned_to_id=s.assignedToId,
            status="PENDING",
        )
        db.add(step)
        created_steps.append(step)

    log = WorkflowLog(
        id=gen_id(),
        instance_id=instance_id,
        actor_id=user.id,
        action="SUBMITTED",
        comment=f"Approval request submitted for {data.entityType} #{data.entityId}",
        created_at=now,
    )
    db.add(log)

    await db.commit()
    await db.refresh(instance)

    return _build_instance_dto(instance, created_steps, [log])

@router.post("/workflows/instances/{instance_id}/steps/{step_id}/review", response_model=WorkflowInstanceDto)
async def review_workflow_step(
    instance_id: str,
    step_id: str,
    data: ReviewWorkflowStepInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    inst_res = await db.execute(
        select(WorkflowInstance).where(
            WorkflowInstance.id == instance_id,
            WorkflowInstance.organization_id == user.organization_id,
        )
    )
    instance = inst_res.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found")

    step_res = await db.execute(
        select(WorkflowStep).where(
            WorkflowStep.id == step_id,
            WorkflowStep.instance_id == instance_id,
        )
    )
    target_step = step_res.scalar_one_or_none()
    if not target_step:
        raise HTTPException(status_code=404, detail="Workflow step not found")

    action = (data.action or "APPROVE").upper().strip()
    if action not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail=f"Invalid review action: '{data.action}'. Must be APPROVE or REJECT.")

    now = datetime.datetime.utcnow()
    target_step.status = "APPROVED" if action == "APPROVE" else "REJECTED"
    target_step.decision_by = user.id
    target_step.decision_at = now
    target_step.comment = data.comment

    all_steps_res = await db.execute(
        select(WorkflowStep).where(WorkflowStep.instance_id == instance_id).order_by(WorkflowStep.step_order.asc())
    )
    all_steps = all_steps_res.scalars().all()

    if action == "APPROVE":
        has_next = False
        for s in all_steps:
            if s.step_order > target_step.step_order and s.status == "PENDING":
                instance.current_step = s.step_order
                has_next = True
                break
        if not has_next:
            instance.status = "APPROVED"
    else:  # REJECT
        instance.status = "REJECTED"
        for s in all_steps:
            if s.step_order > target_step.step_order and s.status == "PENDING":
                s.status = "SKIPPED"

    instance.updated_at = now

    log = WorkflowLog(
        id=gen_id(),
        instance_id=instance_id,
        actor_id=user.id,
        action=action,
        comment=data.comment or f"Step '{target_step.name}' {action.lower()}d",
        created_at=now,
    )
    db.add(log)

    await db.commit()
    await db.refresh(instance)

    updated_steps_res = await db.execute(
        select(WorkflowStep).where(WorkflowStep.instance_id == instance_id).order_by(WorkflowStep.step_order.asc())
    )
    updated_steps = updated_steps_res.scalars().all()

    logs_res = await db.execute(
        select(WorkflowLog).where(WorkflowLog.instance_id == instance_id).order_by(WorkflowLog.created_at.desc())
    )
    logs = logs_res.scalars().all()

    return _build_instance_dto(instance, updated_steps, logs)

# ─── Legacy Approvals Endpoints (Backward Compatibility) ────────────────────

@router.get("/approvals", response_model=List[ApprovalRequestDto])
async def list_approvals(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.organization_id == user.organization_id)
    )
    reqs = result.scalars().all()
    return [
        {
            "id": r.id,
            "entityType": r.entity_type,
            "entityId": r.entity_id,
            "stepNumber": r.current_step,
            "totalSteps": r.total_steps,
            "status": r.status,
            "submittedById": r.submitted_by_id,
            "createdAt": r.created_at.isoformat() if r.created_at else datetime.datetime.utcnow().isoformat()
        } for r in reqs
    ]

@router.post("/approvals/{req_id}/sign", response_model=ApprovalSignResponse)
async def sign_approval(
    req_id: str,
    data: ApprovalDecisionInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.id == req_id,
            ApprovalRequest.organization_id == user.organization_id
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")

    decision = (data.decision or "APPROVED").upper().strip()
    valid_decisions = ["APPROVED", "REJECTED", "CANCELLED", "PENDING"]
    if decision not in valid_decisions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision: '{data.decision}'. Allowed: {valid_decisions}"
        )
    req.status = decision
    await db.commit()
    return {"id": req.id, "status": req.status, "approvedBy": user.id}

