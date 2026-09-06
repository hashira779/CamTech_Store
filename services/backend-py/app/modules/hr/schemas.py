from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

class DepartmentDto(BaseModel):
    id: str
    organizationId: Optional[str] = None
    name: str
    code: Optional[str] = None
    description: Optional[str] = None

class CreateDepartmentInput(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None

class EmployeeDto(BaseModel):
    id: str
    organizationId: Optional[str] = None
    departmentId: Optional[str] = None
    departmentName: Optional[str] = None
    firstName: str
    lastName: str
    fullName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = "Staff"
    baseSalary: float = 0.0
    status: str = "FULL_TIME"
    hireDate: Optional[str] = None
    createdAt: Optional[str] = None

class CreateEmployeeInput(BaseModel):
    firstName: str
    lastName: str
    email: Optional[str] = None
    phone: Optional[str] = None
    departmentId: Optional[str] = None
    position: str = "Staff"
    status: Optional[str] = "FULL_TIME"
    baseSalary: Optional[float] = 0.0
    hireDate: Optional[str] = None

class LeaveRequestDto(BaseModel):
    id: str
    organizationId: Optional[str] = None
    employeeId: str
    employeeName: Optional[str] = None
    type: str
    startDate: str
    endDate: str
    daysCount: int = 1
    reason: Optional[str] = None
    status: str = "PENDING"
    createdAt: Optional[str] = None

class CreateLeaveRequestInput(BaseModel):
    employeeId: str
    type: str
    startDate: str
    endDate: str
    daysCount: int = 1
    reason: Optional[str] = None

class PayrollCalculateInput(BaseModel):
    baseSalary: float = 0.0
    allowances: float = 0.0
    deductions: float = 0.0
    taxRatePct: float = 5.0

class PayrollCalculateResponse(BaseModel):
    baseSalary: float
    allowances: float
    grossPay: float
    deductions: float
    taxAmount: float
    netPay: float
