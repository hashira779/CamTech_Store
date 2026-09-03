from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import ApprovalRequest
from .schemas import ApprovalRequestDto, ApprovalDecisionInput, ApprovalSignResponse

router = APIRouter(tags=["Workflow & Approvals"])

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
            "stepNumber": r.step_number,
            "totalSteps": r.total_steps,
            "status": r.status,
            "submittedById": r.submitted_by_id,
            "createdAt": r.created_at.isoformat()
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

    decision = data.decision or "APPROVED"
    req.status = decision
    req.approved_by_id = user.id
    await db.commit()
    return {"id": req.id, "status": req.status, "approvedBy": user.id}
