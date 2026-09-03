import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PromotionsService } from './promotions.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  EvaluatePromotionDto,
} from './dto/promotion.dto';

@ApiTags('Promotions')
@ApiBearerAuth()
@Controller({ path: 'promotions', version: '1' })
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PROMOTIONS_WRITE)
  @ApiOperation({ summary: 'Create a new promotion or coupon campaign' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.promotionsService.createPromotion(user.organizationId, dto as any, user.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PROMOTIONS_READ)
  @ApiOperation({ summary: 'List promotions with pagination and filters' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('scope') scope?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.promotionsService.listPromotions(user.organizationId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      type,
      scope,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_WRITE)
  @ApiOperation({ summary: 'Update promotion campaign settings' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.updatePromotion(user.organizationId, id, dto as any, user.id);
  }

  @Post('evaluate')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_READ)
  @ApiOperation({ summary: 'Real-time cart promotion and discount calculation' })
  async evaluate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EvaluatePromotionDto,
  ) {
    return this.promotionsService.evaluateCart(user.organizationId, dto as any);
  }
}
