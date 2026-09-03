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
import { InventoryService } from '../application/inventory.service';
import { AdjustInventoryDto } from '../dto/inventory.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('locationId') locationId?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('search') search?: string,
  ) {
    return this.inventory.findAll(user.organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      locationId,
      lowStockOnly: lowStockOnly === 'true',
      search,
    });
  }

  @Post('adjust')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  async adjust(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdjustInventoryDto) {
    return this.inventory.adjust(user.organizationId, user.id, dto as any);
  }

  @Get(':variantId/movements')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  async getMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId') variantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventory.getMovements(
      user.organizationId,
      variantId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
