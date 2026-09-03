import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto, PaymentWebhookDto } from './dto/payments.dto';

@ApiTags('Payments')
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PAYMENTS_WRITE)
  @ApiOperation({ summary: 'Create a payment intent and generate dynamic KHQR payload' })
  async createPaymentIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentsService.createPaymentIntent(user.organizationId, user.id, dto as any);
  }

  @Get(':id/verify')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  @ApiOperation({ summary: 'Verify current status of a payment by ID' })
  async verifyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.paymentsService.verifyPayment(user.organizationId, id);
  }

  @Public()
  @Post('webhook/:provider')
  @ApiOperation({ summary: 'Ingest asynchronous payment confirmation webhook' })
  async processWebhook(
    @Param('provider') provider: string,
    @Body() dto: PaymentWebhookDto,
  ) {
    return this.paymentsService.processWebhook(provider, dto as any);
  }
}
