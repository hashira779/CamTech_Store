from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import Project, Timesheet
from .schemas import ProjectDto, TimesheetDto

router = APIRouter(tags=["Projects & Timesheets"])

@router.get("/projects", response_model=List[ProjectDto])
async def list_projects(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Project).where(Project.organization_id == user.organization_id)
    )
    projects = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "status": p.status,
            "budget": float(p.budget),
            "createdAt": p.created_at.isoformat()
        } for p in projects
    ]

@router.get("/projects/{project_id}/timesheets", response_model=List[TimesheetDto])
async def list_project_timesheets(
    project_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Timesheet).where(
            Timesheet.project_id == project_id,
            Timesheet.organization_id == user.organization_id
        )
    )
    timesheets = result.scalars().all()
    return [
        {
            "id": t.id,
            "projectId": t.project_id,
            "hours": float(t.hours),
            "description": t.description,
            "date": t.date.isoformat() if hasattr(t.date, 'isoformat') else str(t.date)
        } for t in timesheets
    ]
