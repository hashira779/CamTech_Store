import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { TaxesService } from './taxes.service';
import {
  CreateTaxRateDto,
  UpdateTaxRateDto,
  CalculateTaxesInputDto,
} from './dto/taxes.dto';

@ApiTags('Taxes')
@ApiBearerAuth()
@Controller({ path: 'taxes', version: '1' })
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Post('rates')
  @RequirePermissions(PERMISSIONS.TAXES_WRITE)
  @ApiOperation({ summary: 'Create a new tax rate' })
  async createTaxRate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaxRateDto,
  ) {
    return this.taxesService.createTaxRate(user.organizationId, user.id, dto as any);
  }

  @Get('rates')
  @RequirePermissions(PERMISSIONS.TAXES_READ)
  @ApiOperation({ summary: 'List all tax rates for organization (auto-seeds defaults if empty)' })
  async listTaxRates(@CurrentUser() user: AuthenticatedUser) {
    return this.taxesService.listTaxRates(user.organizationId);
  }

  @Patch('rates/:id')
  @RequirePermissions(PERMISSIONS.TAXES_WRITE)
  @ApiOperation({ summary: 'Update a tax rate' })
  async updateTaxRate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaxRateDto,
  ) {
    return this.taxesService.updateTaxRate(user.organizationId, user.id, id, dto as any);
  }

  @Delete('rates/:id')
  @RequirePermissions(PERMISSIONS.TAXES_WRITE)
  @ApiOperation({ summary: 'Deactivate a tax rate' })
  async deleteTaxRate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.taxesService.deleteTaxRate(user.organizationId, user.id, id);
  }

  @Post('calculate')
  @RequirePermissions(PERMISSIONS.TAXES_READ)
  @ApiOperation({ summary: 'Simulate and calculate tax amounts across cart line items' })
  async calculateTaxes(@Body() dto: CalculateTaxesInputDto) {
    return this.taxesService.calculateTaxes(dto as any);
  }
}
