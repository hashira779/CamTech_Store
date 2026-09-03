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
import { LoyaltyService } from './loyalty.service';
import {
  UpdateLoyaltyConfigDto,
  AdjustLoyaltyPointsDto,
  AdjustStoreCreditDto,
  RedeemLoyaltyPointsDto,
} from './dto/loyalty.dto';

@ApiTags('Loyalty & Store Credit')
@ApiBearerAuth()
@Controller({ path: 'loyalty', version: '1' })
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('config')
  @RequirePermissions(PERMISSIONS.LOYALTY_READ)
  @ApiOperation({ summary: 'Get organization loyalty program configuration' })
  async getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.loyaltyService.getOrCreateConfig(user.organizationId);
  }

  @Patch('config')
  @RequirePermissions(PERMISSIONS.LOYALTY_WRITE)
  @ApiOperation({ summary: 'Update loyalty program parameters' })
  async updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLoyaltyConfigDto,
  ) {
    return this.loyaltyService.updateConfig(user.organizationId, user.id, dto as any);
  }

  @Get('customers/:id')
  @RequirePermissions(PERMISSIONS.LOYALTY_READ)
  @ApiOperation({ summary: 'Get customer loyalty profile, tier, and balances' })
  async getCustomerProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.loyaltyService.getCustomerProfile(user.organizationId, id);
  }

  @Post('points/adjust')
  @RequirePermissions(PERMISSIONS.LOYALTY_WRITE)
  @ApiOperation({ summary: 'Manually adjust customer loyalty points' })
  async adjustPoints(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdjustLoyaltyPointsDto,
  ) {
    return this.loyaltyService.adjustPoints(user.organizationId, user.id, dto as any);
  }

  @Post('points/redeem')
  @RequirePermissions(PERMISSIONS.LOYALTY_WRITE)
  @ApiOperation({ summary: 'Redeem customer loyalty points for discount' })
  async redeemPoints(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemLoyaltyPointsDto,
  ) {
    return this.loyaltyService.redeemPoints(user.organizationId, user.id, dto as any);
  }

  @Post('credit/adjust')
  @RequirePermissions(PERMISSIONS.LOYALTY_WRITE)
  @ApiOperation({ summary: 'Manually adjust customer store credit balance' })
  async adjustStoreCredit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdjustStoreCreditDto,
  ) {
    return this.loyaltyService.adjustStoreCredit(user.organizationId, user.id, dto as any);
  }

  @Get('transactions/points')
  @RequirePermissions(PERMISSIONS.LOYALTY_READ)
  @ApiOperation({ summary: 'List loyalty points transactions ledger' })
  async listLoyaltyTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
  ) {
    return this.loyaltyService.listLoyaltyTransactions(user.organizationId, customerId);
  }

  @Get('transactions/credit')
  @RequirePermissions(PERMISSIONS.LOYALTY_READ)
  @ApiOperation({ summary: 'List store credit transactions ledger' })
  async listStoreCreditTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
  ) {
    return this.loyaltyService.listStoreCreditTransactions(user.organizationId, customerId);
  }
}
