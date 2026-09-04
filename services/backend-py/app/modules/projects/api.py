from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import Project, Timesheet, ProjectTask
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
    proj_res = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == user.organization_id
        )
    )
    if not proj_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(Timesheet)
        .join(ProjectTask, Timesheet.task_id == ProjectTask.id)
        .where(ProjectTask.project_id == project_id)
    )
    timesheets = result.scalars().all()
    return [
        {
            "id": t.id,
            "projectId": project_id,
            "hours": float(t.hours),
            "description": t.notes,
            "date": t.date.isoformat() if hasattr(t.date, 'isoformat') else str(t.date)
        } for t in timesheets
    ]
