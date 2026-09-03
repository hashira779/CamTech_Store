from decimal import Decimal
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import Employee, Department
from app.domain.enterprise_engines import PayrollCalculator
from .schemas import EmployeeDto, DepartmentDto, PayrollCalculateInput, PayrollCalculateResponse

router = APIRouter(tags=["Human Resources & Workforce"])

@router.get("/hr/employees", response_model=List[EmployeeDto])
async def list_employees(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Employee).where(Employee.organization_id == user.organization_id)
    )
    emps = result.scalars().all()
    return [
        {
            "id": e.id,
            "firstName": e.first_name,
            "lastName": e.last_name,
            "email": e.email,
            "baseSalary": float(e.base_salary),
            "status": e.status
        } for e in emps
    ]

@router.get("/hr/departments", response_model=List[DepartmentDto])
async def list_departments(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Department).where(Department.organization_id == user.organization_id)
    )
    depts = result.scalars().all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "code": d.code
        } for d in depts
    ]

@router.post("/hr/payroll/calculate", response_model=PayrollCalculateResponse)
async def calculate_payroll(
    data: PayrollCalculateInput,
    user: TenantUser = Depends(get_current_user)
):
    base = Decimal(str(data.baseSalary))
    allow = Decimal(str(data.allowances))
    deduct = Decimal(str(data.deductions))
    tax_pct = Decimal(str(data.taxRatePct))
    res = PayrollCalculator.calculate_net_pay(base, allow, deduct, tax_pct)
    return {
        "baseSalary": float(res["baseSalary"]),
        "allowances": float(res["allowances"]),
        "grossPay": float(res["grossPay"]),
        "deductions": float(res["deductions"]),
        "taxAmount": float(res["taxAmount"]),
        "netPay": float(res["netPay"])
    }
