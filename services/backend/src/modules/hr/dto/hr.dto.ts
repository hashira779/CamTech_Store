import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EMPLOYMENT_STATUSES,
  LEAVE_TYPES,
  type EmploymentStatus,
  type LeaveType,
} from '@mystore/contracts';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Human Resources' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'HR' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'People and talent operations' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName!: string;

  @ApiPropertyOptional({ example: 'john.doe@enterprise.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+855 12 345 678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'dept_cuid_123' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ example: 'Senior Inventory Specialist' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position!: string;

  @ApiPropertyOptional({ enum: EMPLOYMENT_STATUSES, default: 'FULL_TIME' })
  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES as unknown as string[])
  status?: EmploymentStatus;

  @ApiProperty({ example: 2500, default: 0 })
  @IsNumber()
  @Min(0)
  baseSalary!: number;

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  hireDate?: string;
}

export class CreateLeaveRequestDto {
  @ApiProperty({ example: 'emp_cuid_123' })
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @ApiProperty({ enum: LEAVE_TYPES, example: 'ANNUAL' })
  @IsIn(LEAVE_TYPES as unknown as string[])
  type!: LeaveType;

  @ApiProperty({ example: '2026-09-10T00:00:00Z' })
  @IsISO8601()
  startDate!: string;

  @ApiProperty({ example: '2026-09-12T00:00:00Z' })
  @IsISO8601()
  endDate!: string;

  @ApiProperty({ example: 3, default: 1 })
  @IsInt()
  @Min(1)
  daysCount!: number;

  @ApiPropertyOptional({ example: 'Family vacation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePayrollRunDto {
  @ApiProperty({ example: '2026-09-01T00:00:00Z' })
  @IsISO8601()
  periodStart!: string;

  @ApiProperty({ example: '2026-09-30T23:59:59Z' })
  @IsISO8601()
  periodEnd!: string;

  @ApiProperty({ example: 'Monthly Payroll - September 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
