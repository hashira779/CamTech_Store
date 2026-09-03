from pydantic import BaseModel
from typing import Optional, List

class ProjectDto(BaseModel):
    id: str
    name: str
    code: str
    status: str
    budget: float
    createdAt: str

class TimesheetDto(BaseModel):
    id: str
    projectId: str
    hours: float
    description: Optional[str] = None
    date: str
