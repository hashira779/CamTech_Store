import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../../common/auth/permissions.decorator';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { SalesService } from '../application/sales.service';
import { CreateSaleDto, SyncBatchRequestDto } from '../dto/sale.dto';

@ApiTags('Sales')
@ApiBearerAuth()
@Controller({ path: 'sales', version: '1' })
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSaleDto) {
    return this.sales.createSale(user.organizationId, user.id, dto as any);
  }

  @Post('sync-batch')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  async syncBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SyncBatchRequestDto,
  ) {
    return this.sales.syncBatch(user.organizationId, user.id, dto as any);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sales.findAll(user.organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      channel,
      search,
      from,
      to,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  async findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sales.findById(user.organizationId, id);
  }

  @Post(':id/void')
  @RequirePermissions(PERMISSIONS.SALES_VOID)
  async voidSale(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sales.voidSale(user.organizationId, id, user.id);
  }
}
