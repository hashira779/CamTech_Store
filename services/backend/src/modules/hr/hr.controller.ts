import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { HrService } from './hr.service';
import {
  CreateDepartmentDto,
  CreateEmployeeDto,
  CreateLeaveRequestDto,
  CreatePayrollRunDto,
} from './dto/hr.dto';

@ApiTags('Human Resources & Payroll')
@ApiBearerAuth()
@Controller({ path: 'hr', version: '1' })
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // ─── Departments ────────────────────────────────────────────────

  @Get('departments')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'List organization departments' })
  async listDepartments(@CurrentUser() user: AuthenticatedUser) {
    return this.hrService.listDepartments(user.organizationId);
  }

  @Post('departments')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'Create a new department' })
  async createDepartment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.hrService.createDepartment(user.organizationId, dto as any);
  }

  // ─── Employees ──────────────────────────────────────────────────

  @Get('employees')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'List all employees' })
  async listEmployees(@CurrentUser() user: AuthenticatedUser) {
    return this.hrService.listEmployees(user.organizationId);
  }

  @Get('employees/:id')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'Get employee profile' })
  async getEmployee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.hrService.getEmployee(user.organizationId, id);
  }

  @Post('employees')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'Register a new employee' })
  async createEmployee(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.hrService.createEmployee(user.organizationId, dto as any);
  }

  // ─── Leave Requests ─────────────────────────────────────────────

  @Get('leaves')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'List employee leave requests' })
  async listLeaves(@CurrentUser() user: AuthenticatedUser) {
    return this.hrService.listLeaveRequests(user.organizationId);
  }

  @Post('leaves')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'Submit a leave request' })
  async createLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.hrService.createLeaveRequest(user.organizationId, dto as any);
  }

  @Post('leaves/:id/approve')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'Approve a leave request' })
  async approveLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.hrService.reviewLeaveRequest(user.organizationId, id, 'APPROVED', user.id);
  }

  @Post('leaves/:id/reject')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'Reject a leave request' })
  async rejectLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.hrService.reviewLeaveRequest(user.organizationId, id, 'REJECTED', user.id);
  }

  // ─── Payroll Runs ───────────────────────────────────────────────

  @Get('payroll')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'List payroll calculation runs' })
  async listPayrollRuns(@CurrentUser() user: AuthenticatedUser) {
    return this.hrService.listPayrollRuns(user.organizationId);
  }

  @Post('payroll')
  @RequirePermissions(PERMISSIONS.PAYROLL_RUN)
  @ApiOperation({ summary: 'Execute a batch payroll run for active employees' })
  async createPayrollRun(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePayrollRunDto,
  ) {
    return this.hrService.createPayrollRun(user.organizationId, dto as any);
  }
}
