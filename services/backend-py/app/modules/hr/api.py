import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser
from app.core.db_enums import ENUM_LABELS
from app.models.entities import Employee, Department, LeaveRequest
from app.domain.enterprise_engines import PayrollCalculator
from .schemas import (
    EmployeeDto, CreateEmployeeInput,
    DepartmentDto, CreateDepartmentInput,
    LeaveRequestDto, CreateLeaveRequestInput,
    PayrollCalculateInput, PayrollCalculateResponse
)

router = APIRouter(tags=["Human Resources & Workforce"])

_EMPLOYMENT_STATUSES = set(ENUM_LABELS.get("EmploymentStatus", ["FULL_TIME", "PART_TIME", "CONTRACT", "PROBATION", "TERMINATED"]))
_LEAVE_TYPES = set(ENUM_LABELS.get("LeaveType", ["ANNUAL", "SICK", "MATERNITY", "UNPAID", "SPECIAL"]))


def _employee_to_dto(e: Employee, dept_name: Optional[str] = None) -> EmployeeDto:
    full_name = f"{e.first_name} {e.last_name}".strip()
    return EmployeeDto(
        id=e.id,
        organizationId=e.organization_id,
        departmentId=e.department_id,
        departmentName=dept_name,
        firstName=e.first_name,
        lastName=e.last_name,
        fullName=full_name,
        email=e.email,
        phone=e.phone,
        position=e.position or "Staff",
        baseSalary=float(e.base_salary or 0),
        status=e.status,
        hireDate=e.hire_date.isoformat() if e.hire_date else None,
        createdAt=e.created_at.isoformat() if e.created_at else None,
    )


def _leave_to_dto(l: LeaveRequest, emp_name: Optional[str] = None) -> LeaveRequestDto:
    return LeaveRequestDto(
        id=l.id,
        organizationId=l.organization_id,
        employeeId=l.employee_id,
        employeeName=emp_name,
        type=l.type,
        startDate=l.start_date.isoformat() if l.start_date else utc_now().isoformat(),
        endDate=l.end_date.isoformat() if l.end_date else utc_now().isoformat(),
        daysCount=l.days_count or 1,
        reason=l.reason,
        status=l.status,
        createdAt=l.created_at.isoformat() if l.created_at else None,
    )


# --- DEPARTMENTS ---
@router.get("/hr/departments", response_model=List[DepartmentDto])
async def list_departments(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Department).where(Department.organization_id == user.organization_id).order_by(Department.name.asc())
    )
    depts = result.scalars().all()
    return [
        DepartmentDto(
            id=d.id,
            organizationId=d.organization_id,
            name=d.name,
            code=d.code,
            description=d.description,
        )
        for d in depts
    ]


@router.post("/hr/departments", response_model=DepartmentDto, status_code=status.HTTP_201_CREATED)
async def create_department(
    input_data: CreateDepartmentInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    dept = Department(
        organization_id=user.organization_id,
        name=input_data.name.strip(),
        code=input_data.code.strip().upper() if input_data.code else None,
        description=input_data.description,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return DepartmentDto(
        id=dept.id,
        organizationId=dept.organization_id,
        name=dept.name,
        code=dept.code,
        description=dept.description,
    )


# --- EMPLOYEES ---
@router.get("/hr/employees", response_model=List[EmployeeDto])
async def list_employees(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Employee).where(Employee.organization_id == user.organization_id).order_by(Employee.first_name.asc())
    )
    emps = result.scalars().all()

    # Pre-fetch department names
    dept_ids = [e.department_id for e in emps if e.department_id]
    dept_map = {}
    if dept_ids:
        d_res = await db.execute(select(Department).where(Department.id.in_(dept_ids)))
        dept_map = {d.id: d.name for d in d_res.scalars().all()}

    return [_employee_to_dto(e, dept_map.get(e.department_id)) for e in emps]


@router.get("/hr/employees/{employee_id}", response_model=EmployeeDto)
async def get_employee(
    employee_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.organization_id == user.organization_id
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    dept_name = None
    if emp.department_id:
        d_res = await db.execute(select(Department.name).where(Department.id == emp.department_id))
        dept_name = d_res.scalar_one_or_none()

    return _employee_to_dto(emp, dept_name)


@router.post("/hr/employees", response_model=EmployeeDto, status_code=status.HTTP_201_CREATED)
async def create_employee(
    input_data: CreateEmployeeInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    emp_status = input_data.status.upper() if input_data.status else "FULL_TIME"
    if emp_status not in _EMPLOYMENT_STATUSES:
        emp_status = "FULL_TIME"

    hire_date = utc_now()
    if input_data.hireDate:
        try:
            hire_date = datetime.datetime.fromisoformat(input_data.hireDate.replace("Z", "+00:00"))
        except Exception:
            hire_date = utc_now()

    # Validate department if provided
    dept_name = None
    if input_data.departmentId:
        d_res = await db.execute(
            select(Department).where(
                Department.id == input_data.departmentId,
                Department.organization_id == user.organization_id
            )
        )
        dept = d_res.scalar_one_or_none()
        if dept:
            dept_name = dept.name

    emp = Employee(
        organization_id=user.organization_id,
        department_id=input_data.departmentId,
        first_name=input_data.firstName.strip(),
        last_name=input_data.lastName.strip(),
        email=input_data.email.strip().lower() if input_data.email else None,
        phone=input_data.phone.strip() if input_data.phone else None,
        position=input_data.position.strip() if input_data.position else "Staff",
        status=emp_status,
        base_salary=Decimal(str(input_data.baseSalary or 0.0)),
        hire_date=hire_date,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return _employee_to_dto(emp, dept_name)


# --- LEAVES ---
@router.get("/hr/leaves", response_model=List[LeaveRequestDto])
async def list_leave_requests(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(LeaveRequest, Employee)
        .join(Employee, LeaveRequest.employee_id == Employee.id)
        .where(LeaveRequest.organization_id == user.organization_id)
        .order_by(desc(LeaveRequest.created_at))
    )
    rows = result.all()
    return [
        _leave_to_dto(lr, f"{emp.first_name} {emp.last_name}".strip())
        for lr, emp in rows
    ]


@router.post("/hr/leaves", response_model=LeaveRequestDto, status_code=status.HTTP_201_CREATED)
async def create_leave_request(
    input_data: CreateLeaveRequestInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    leave_type = input_data.type.upper() if input_data.type else "ANNUAL"
    if leave_type not in _LEAVE_TYPES:
        leave_type = "ANNUAL"

    emp_res = await db.execute(
        select(Employee).where(
            Employee.id == input_data.employeeId,
            Employee.organization_id == user.organization_id
        )
    )
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    start_date = utc_now()
    end_date = utc_now()
    try:
        start_date = datetime.datetime.fromisoformat(input_data.startDate.replace("Z", "+00:00"))
        end_date = datetime.datetime.fromisoformat(input_data.endDate.replace("Z", "+00:00"))
    except Exception:
        pass

    lr = LeaveRequest(
        organization_id=user.organization_id,
        employee_id=emp.id,
        type=leave_type,
        start_date=start_date,
        end_date=end_date,
        days_count=max(1, input_data.daysCount),
        reason=input_data.reason,
        status="PENDING",
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(lr)
    await db.commit()
    await db.refresh(lr)
    return _leave_to_dto(lr, f"{emp.first_name} {emp.last_name}".strip())


@router.post("/hr/leaves/{leave_id}/approve", response_model=LeaveRequestDto)
async def approve_leave_request(
    leave_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(LeaveRequest, Employee)
        .join(Employee, LeaveRequest.employee_id == Employee.id)
        .where(
            LeaveRequest.id == leave_id,
            LeaveRequest.organization_id == user.organization_id
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
    lr, emp = row

    lr.status = "APPROVED"
    lr.approved_by_id = user.id
    lr.updated_at = utc_now()
    await db.commit()
    await db.refresh(lr)
    return _leave_to_dto(lr, f"{emp.first_name} {emp.last_name}".strip())


@router.post("/hr/leaves/{leave_id}/reject", response_model=LeaveRequestDto)
async def reject_leave_request(
    leave_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(LeaveRequest, Employee)
        .join(Employee, LeaveRequest.employee_id == Employee.id)
        .where(
            LeaveRequest.id == leave_id,
            LeaveRequest.organization_id == user.organization_id
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
    lr, emp = row

    lr.status = "REJECTED"
    lr.approved_by_id = user.id
    lr.updated_at = utc_now()
    await db.commit()
    await db.refresh(lr)
    return _leave_to_dto(lr, f"{emp.first_name} {emp.last_name}".strip())


# --- PAYROLL ---
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
