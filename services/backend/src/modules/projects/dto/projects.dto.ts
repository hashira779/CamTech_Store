import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsPositive,
} from 'class-validator';
import {
  PROJECT_STATUSES,
  TASK_STATUSES,
  type ProjectStatus,
  type TaskStatus,
} from '@mystore/contracts';

export class CreateProjectDto {
  @ApiProperty({ example: 'PRJ-2026-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Retail Store POS Upgrade' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Upgrade 10 POS terminals across branches' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 15000.0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({ enum: PROJECT_STATUSES, default: 'PLANNING' })
  @IsOptional()
  @IsIn(PROJECT_STATUSES as unknown as string[])
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-31T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}

export class CreateProjectTaskDto {
  @ApiProperty({ example: 'Install POS terminal drivers' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional({ example: 'Configuration and thermal printer setup' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TASK_STATUSES, default: 'TODO' })
  @IsOptional()
  @IsIn(TASK_STATUSES as unknown as string[])
  status?: TaskStatus;

  @ApiPropertyOptional({ example: 'worker_cuid_123' })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ example: 8.5, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;
}

export class LogTimesheetDto {
  @ApiProperty({ example: 4.5 })
  @IsNumber()
  @IsPositive()
  hours!: number;

  @ApiPropertyOptional({ example: '2026-09-03T12:00:00Z' })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ example: 'Configured barcode scanner and receipt printer' })
  @IsOptional()
  @IsString()
  notes?: string;
}
