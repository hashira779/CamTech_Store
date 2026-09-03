"""HR & Workforce Module (Spec §39 - §40, §199)"""
from .api import router
from .schemas import EmployeeDto, DepartmentDto, PayrollCalculateInput, PayrollCalculateResponse

__all__ = ["router", "EmployeeDto", "DepartmentDto", "PayrollCalculateInput", "PayrollCalculateResponse"]
