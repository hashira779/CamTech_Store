from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

class EmployeeDto(BaseModel):
    id: str
    firstName: str
    lastName: str
    email: Optional[str] = None
    baseSalary: float
    status: str

class DepartmentDto(BaseModel):
    id: str
    name: str
    code: Optional[str] = None

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
