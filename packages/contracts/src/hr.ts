import { z } from 'zod';

export const EMPLOYMENT_STATUSES = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'PROBATION',
  'TERMINATED',
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const LEAVE_TYPES = ['ANNUAL', 'SICK', 'MATERNITY', 'UNPAID', 'SPECIAL'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const PAYROLL_STATUSES = ['DRAFT', 'CALCULATED', 'APPROVED', 'PAID'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

// ─── Department Schemas ──────────────────────────────────────────

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  description: z.string().optional(),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

// ─── Employee Schemas ────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  position: z.string().min(1).max(100),
  status: z.enum(EMPLOYMENT_STATUSES).optional(),
  baseSalary: z.number().min(0).optional(),
  hireDate: z.string().optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// ─── Leave Schemas ───────────────────────────────────────────────

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(LEAVE_TYPES),
  startDate: z.string(),
  endDate: z.string(),
  daysCount: z.number().int().min(1),
  reason: z.string().optional(),
});
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

// ─── Payroll Schemas ─────────────────────────────────────────────

export const createPayrollRunSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  name: z.string().min(1).max(100),
});
export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

// ─── DTOs ────────────────────────────────────────────────────────

export interface DepartmentDto {
  id: string;
  organizationId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDto {
  id: string;
  organizationId: string;
  departmentId?: string | null;
  departmentName?: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  position: string;
  status: EmploymentStatus;
  baseSalary: number;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequestDto {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName?: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string | null;
  status: LeaveStatus;
  approvedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollItemDto {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName?: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
}

export interface PayrollRunDto {
  id: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  name: string;
  status: PayrollStatus;
  totalGross: number;
  totalNet: number;
  journalEntryId?: string | null;
  items: PayrollItemDto[];
  createdAt: string;
  updatedAt: string;
}
