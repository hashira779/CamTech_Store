import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ReportingService } from './reporting.service';
import { ReportDateRangeDto, ExportReportDto } from './dto/reporting.dto';

@ApiTags('Reporting & BI Analytics')
@ApiBearerAuth()
@Controller({ path: 'reports', version: '1' })
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Get composite executive business intelligence report' })
  async getExecutiveSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportDateRangeDto,
  ) {
    return this.reportingService.getExecutiveSummary(user.organizationId, query);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @ApiOperation({ summary: 'Export sales, inventory, or product ranking dataset as CSV' })
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportReportDto,
  ) {
    const csv = await this.reportingService.generateExportCsv(user.organizationId, query);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${query.type.toLowerCase()}_report_${timestamp}.csv`;
    return {
      filename,
      csv,
    };
  }
}
