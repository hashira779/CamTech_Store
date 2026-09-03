import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PayrollCalculator } from './domain/payroll-calculator';
import type {
  CreateDepartmentInput,
  DepartmentDto,
  CreateEmployeeInput,
  EmployeeDto,
  CreateLeaveRequestInput,
  LeaveRequestDto,
  CreatePayrollRunInput,
  PayrollRunDto,
  EmploymentStatus,
  LeaveType,
  LeaveStatus,
  PayrollStatus,
} from '@mystore/contracts';

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Departments ────────────────────────────────────────────────

  async listDepartments(orgId: string): Promise<DepartmentDto[]> {
    const depts = await this.prisma.department.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });

    return depts.map((d) => ({
      id: d.id,
      organizationId: d.organizationId,
      name: d.name,
      code: d.code,
      description: d.description,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async createDepartment(orgId: string, input: CreateDepartmentInput): Promise<DepartmentDto> {
    const existing = await this.prisma.department.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: input.name } },
    });
    if (existing) {
      throw new ConflictException(`Department '${input.name}' already exists`);
    }

    const created = await this.prisma.department.create({
      data: {
        organizationId: orgId,
        name: input.name,
        code: input.code,
        description: input.description,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'HR_DEPARTMENT_CREATED',
      resourceType: 'Department',
      resourceId: created.id,
      metadata: { name: created.name },
    });

    return {
      id: created.id,
      organizationId: created.organizationId,
      name: created.name,
      code: created.code,
      description: created.description,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  // ─── Employees ──────────────────────────────────────────────────

  async listEmployees(orgId: string): Promise<EmployeeDto[]> {
    const employees = await this.prisma.employee.findMany({
      where: { organizationId: orgId },
      include: { department: true },
      orderBy: { lastName: 'asc' },
    });

    return employees.map((e) => this.mapEmployeeDto(e));
  }

  async getEmployee(orgId: string, id: string): Promise<EmployeeDto> {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: orgId },
      include: { department: true },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return this.mapEmployeeDto(employee);
  }

  async createEmployee(orgId: string, input: CreateEmployeeInput): Promise<EmployeeDto> {
    const created = await this.prisma.employee.create({
      data: {
        organizationId: orgId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        departmentId: input.departmentId,
        position: input.position,
        status: input.status || 'FULL_TIME',
        baseSalary: input.baseSalary || 0,
        hireDate: input.hireDate ? new Date(input.hireDate) : new Date(),
      },
      include: { department: true },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'HR_EMPLOYEE_CREATED',
      resourceType: 'Employee',
      resourceId: created.id,
      metadata: { fullName: `${created.firstName} ${created.lastName}`, position: created.position },
    });

    return this.mapEmployeeDto(created);
  }

  // ─── Leave Requests ─────────────────────────────────────────────

  async listLeaveRequests(orgId: string): Promise<LeaveRequestDto[]> {
    const requests = await this.prisma.leaveRequest.findMany({
      where: { organizationId: orgId },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      employeeId: r.employeeId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      type: r.type as LeaveType,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      daysCount: r.daysCount,
      reason: r.reason,
      status: r.status as LeaveStatus,
      approvedById: r.approvedById,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async createLeaveRequest(orgId: string, input: CreateLeaveRequestInput): Promise<LeaveRequestDto> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, organizationId: orgId },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${input.employeeId} not found`);
    }

    const created = await this.prisma.leaveRequest.create({
      data: {
        organizationId: orgId,
        employeeId: input.employeeId,
        type: input.type,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        daysCount: input.daysCount,
        reason: input.reason,
        status: 'PENDING',
      },
      include: { employee: true },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'HR_LEAVE_REQUESTED',
      resourceType: 'LeaveRequest',
      resourceId: created.id,
      metadata: { employeeId: created.employeeId, days: created.daysCount },
    });

    return {
      id: created.id,
      organizationId: created.organizationId,
      employeeId: created.employeeId,
      employeeName: `${created.employee.firstName} ${created.employee.lastName}`,
      type: created.type as LeaveType,
      startDate: created.startDate.toISOString(),
      endDate: created.endDate.toISOString(),
      daysCount: created.daysCount,
      reason: created.reason,
      status: created.status as LeaveStatus,
      approvedById: created.approvedById,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async reviewLeaveRequest(
    orgId: string,
    id: string,
    action: 'APPROVED' | 'REJECTED',
    reviewerId?: string,
  ): Promise<LeaveRequestDto> {
    const req = await this.prisma.leaveRequest.findFirst({
      where: { id, organizationId: orgId },
      include: { employee: true },
    });
    if (!req) {
      throw new NotFoundException(`Leave request ${id} not found`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: action,
        approvedById: reviewerId,
      },
      include: { employee: true },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: reviewerId,
      action: `HR_LEAVE_${action}`,
      resourceType: 'LeaveRequest',
      resourceId: updated.id,
      metadata: { action },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      employeeId: updated.employeeId,
      employeeName: `${updated.employee.firstName} ${updated.employee.lastName}`,
      type: updated.type as LeaveType,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      daysCount: updated.daysCount,
      reason: updated.reason,
      status: updated.status as LeaveStatus,
      approvedById: updated.approvedById,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ─── Payroll ────────────────────────────────────────────────────

  async listPayrollRuns(orgId: string): Promise<PayrollRunDto[]> {
    const runs = await this.prisma.payrollRun.findMany({
      where: { organizationId: orgId },
      include: {
        items: { include: { employee: true } },
      },
      orderBy: { periodEnd: 'desc' },
    });

    return runs.map((r) => this.mapPayrollRunDto(r));
  }

  async createPayrollRun(orgId: string, input: CreatePayrollRunInput): Promise<PayrollRunDto> {
    // 1. Fetch active employees
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['FULL_TIME', 'PART_TIME', 'PROBATION', 'CONTRACT'] },
      },
    });

    const computed = PayrollCalculator.computeBatch(
      employees.map((e) => ({
        employeeId: e.id,
        baseSalary: Number(e.baseSalary),
        allowances: 0,
        deductions: 0,
      })),
    );

    // 2. Persist payroll run and items
    const run = await this.prisma.$transaction(async (tx) => {
      const pRun = await tx.payrollRun.create({
        data: {
          organizationId: orgId,
          name: input.name,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          status: 'CALCULATED',
          totalGross: computed.totalGross,
          totalNet: computed.totalNet,
        },
      });

      for (const item of computed.items) {
        await tx.payrollItem.create({
          data: {
            payrollRunId: pRun.id,
            employeeId: item.employeeId,
            baseSalary: item.baseSalary,
            allowances: item.allowances,
            deductions: item.deductions,
            netPay: item.netPay,
          },
        });
      }

      return tx.payrollRun.findUniqueOrThrow({
        where: { id: pRun.id },
        include: { items: { include: { employee: true } } },
      });
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'HR_PAYROLL_CALCULATED',
      resourceType: 'PayrollRun',
      resourceId: run.id,
      metadata: { totalGross: computed.totalGross, employeeCount: employees.length },
    });

    return this.mapPayrollRunDto(run);
  }

  private mapEmployeeDto(e: any): EmployeeDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      departmentId: e.departmentId,
      departmentName: e.department?.name,
      firstName: e.firstName,
      lastName: e.lastName,
      fullName: `${e.firstName} ${e.lastName}`,
      email: e.email,
      phone: e.phone,
      position: e.position,
      status: e.status as EmploymentStatus,
      baseSalary: Number(e.baseSalary),
      hireDate: e.hireDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  private mapPayrollRunDto(r: any): PayrollRunDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      name: r.name,
      status: r.status as PayrollStatus,
      totalGross: Number(r.totalGross),
      totalNet: Number(r.totalNet),
      journalEntryId: r.journalEntryId,
      items: (r.items || []).map((i: any) => ({
        id: i.id,
        payrollRunId: i.payrollRunId,
        employeeId: i.employeeId,
        employeeName: `${i.employee.firstName} ${i.employee.lastName}`,
        baseSalary: Number(i.baseSalary),
        allowances: Number(i.allowances),
        deductions: Number(i.deductions),
        netPay: Number(i.netPay),
      })),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
