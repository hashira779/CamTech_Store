import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PricingService } from './pricing.service';
import {
  CreatePriceListDto,
  UpdatePriceListDto,
  SetPriceListItemDto,
  ResolvePricesRequestDto,
} from './dto/pricing.dto';

@ApiTags('Pricing')
@ApiBearerAuth()
@Controller({ path: 'pricing', version: '1' })
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('lists')
  @RequirePermissions(PERMISSIONS.PRICING_WRITE)
  @ApiOperation({ summary: 'Create a new price list' })
  async createPriceList(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePriceListDto,
  ) {
    return this.pricingService.createPriceList(user.organizationId, dto as any, user.id);
  }

  @Get('lists')
  @RequirePermissions(PERMISSIONS.PRICING_READ)
  @ApiOperation({ summary: 'List price lists with pagination and filters' })
  async listPriceLists(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('customerType') customerType?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.pricingService.listPriceLists(user.organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      customerType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
  }

  @Get('lists/:id')
  @RequirePermissions(PERMISSIONS.PRICING_READ)
  @ApiOperation({ summary: 'Get full price list details with variant overrides and quantity breaks' })
  async getPriceListById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.pricingService.getPriceListById(user.organizationId, id);
  }

  @Patch('lists/:id')
  @RequirePermissions(PERMISSIONS.PRICING_WRITE)
  @ApiOperation({ summary: 'Update price list settings' })
  async updatePriceList(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePriceListDto,
  ) {
    return this.pricingService.updatePriceList(user.organizationId, id, dto as any, user.id);
  }

  @Post('lists/:id/items')
  @RequirePermissions(PERMISSIONS.PRICING_WRITE)
  @ApiOperation({ summary: 'Set or update variant price and quantity break for a price list' })
  async setPriceListItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') priceListId: string,
    @Body() dto: SetPriceListItemDto,
  ) {
    return this.pricingService.setPriceListItem(user.organizationId, priceListId, dto as any, user.id);
  }

  @Delete('lists/:id/items/:itemId')
  @RequirePermissions(PERMISSIONS.PRICING_WRITE)
  @ApiOperation({ summary: 'Remove a variant price override from a price list' })
  async deletePriceListItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') priceListId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.pricingService.deletePriceListItem(user.organizationId, priceListId, itemId, user.id);
  }

  @Post('resolve')
  @RequirePermissions(PERMISSIONS.PRICING_READ)
  @ApiOperation({ summary: 'Resolve customer/tier effective prices for a set of cart items' })
  async resolvePrices(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResolvePricesRequestDto,
  ) {
    return this.pricingService.resolvePrices(user.organizationId, dto as any);
  }
}
