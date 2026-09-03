import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import {
  REPORT_INTERVALS,
  REPORT_EXPORT_TYPES,
  type ReportInterval,
  type ReportExportType,
} from '@mystore/contracts';

export class ReportDateRangeDto {
  @ApiPropertyOptional({ example: '2026-08-01T00:00:00Z', description: 'ISO 8601 start timestamp' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-01T23:59:59Z', description: 'ISO 8601 end timestamp' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ example: 'loc_branch_central', description: 'Filter by specific branch or location' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ enum: REPORT_INTERVALS, default: 'DAY', description: 'Time-series aggregation bucket' })
  @IsOptional()
  @IsIn(REPORT_INTERVALS as unknown as string[])
  interval?: ReportInterval;
}

export class ExportReportDto {
  @ApiProperty({ enum: REPORT_EXPORT_TYPES, example: 'SALES', description: 'Dataset to export as CSV' })
  @IsIn(REPORT_EXPORT_TYPES as unknown as string[])
  type!: ReportExportType;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-01T23:59:59Z' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ example: 'loc_branch_central' })
  @IsOptional()
  @IsString()
  locationId?: string;
}
