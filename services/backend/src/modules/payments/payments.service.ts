import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { KhqrGenerator } from './domain/khqr-generator';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  CreatePaymentIntentInput,
  PaymentIntentDto,
  PaymentVerificationDto,
  PaymentWebhookPayload,
} from '@mystore/contracts';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Initiates a payment intent, generating dynamic KHQR if method is QR.
   */
  async createPaymentIntent(
    orgId: string,
    actorId: string,
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);

    let qrString: string | null = null;
    const currency = input.currency || org.currency || 'USD';

    // 1. Generate KHQR if QR payment method or Bakong provider
    if (input.method === 'QR' || input.provider === 'BAKONG_KHQR') {
      qrString = KhqrGenerator.generateDynamicQr({
        bakongAccountId: input.accountInformation || 'mystore@nbc',
        merchantName: input.merchantName || org.name,
        merchantCity: input.merchantCity || 'Phnom Penh',
        amount: input.amount,
        currency,
        billNumber: input.billNumber || undefined,
      });
    }

    // 2. If a saleId is provided, attach payment to that sale; otherwise create a temporary holder
    let paymentRecord: any = null;

    if (input.saleId) {
      const sale = await this.prisma.sale.findFirst({
        where: { id: input.saleId, organizationId: orgId },
      });
      if (!sale) throw new NotFoundException(`Sale ${input.saleId} not found`);

      paymentRecord = await this.prisma.salePayment.create({
        data: {
          saleId: sale.id,
          method: input.method as any,
          status: 'PENDING',
          provider: input.provider || 'BAKONG_KHQR',
          amount: new Decimal(input.amount),
          reference: input.billNumber || null,
          qrString,
        },
      });
    }

    const paymentId = paymentRecord ? paymentRecord.id : `intent_${Date.now()}`;

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PAYMENT_INTENT_CREATED',
      resourceType: 'Payment',
      resourceId: paymentId,
      metadata: {
        method: input.method,
        provider: input.provider,
        amount: input.amount,
        saleId: input.saleId,
      },
    });

    const method = input.method || 'QR';
    const provider = input.provider || 'BAKONG_KHQR';

    return {
      paymentId,
      saleId: input.saleId || null,
      status: 'PENDING',
      method,
      provider,
      amount: input.amount,
      currency,
      qrString,
      reference: input.billNumber || null,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Checks current status of a payment by ID.
   */
  async verifyPayment(orgId: string, paymentId: string): Promise<PaymentVerificationDto> {
    const payment = await this.prisma.salePayment.findUnique({
      where: { id: paymentId },
      include: { sale: true },
    });

    if (!payment || payment.sale.organizationId !== orgId) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    return {
      paymentId: payment.id,
      status: payment.status as any,
      amount: Number(payment.amount),
      currency: payment.sale.currency,
      reference: payment.reference,
      paidAt: payment.status === 'COMPLETED' ? payment.paidAt.toISOString() : null,
    };
  }

  /**
   * Ingests asynchronous webhook callback from payment provider.
   */
  async processWebhook(
    provider: string,
    payload: PaymentWebhookPayload,
  ): Promise<{ success: boolean; paymentId: string; status: string }> {
    const payment = await this.prisma.salePayment.findUnique({
      where: { id: payload.transactionId },
      include: { sale: { include: { payments: true } } },
    });

    if (!payment) {
      throw new NotFoundException(`Transaction ${payload.transactionId} not found`);
    }

    const updatedPayment = await this.prisma.salePayment.update({
      where: { id: payment.id },
      data: {
        status: payload.status as any,
        externalId: payload.externalReference || payload.hash || null,
        paidAt: new Date(),
      },
    });

    // If payment belongs to an active sale and is COMPLETED, check if sale can be marked COMPLETED
    if (payload.status === 'COMPLETED' && payment.sale) {
      const allPayments = await this.prisma.salePayment.findMany({
        where: { saleId: payment.saleId, status: 'COMPLETED' },
      });
      const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0);

      if (totalPaid >= Number(payment.sale.grandTotal)) {
        await this.prisma.sale.update({
          where: { id: payment.saleId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }
    }

    await this.audit.record({
      organizationId: payment.sale.organizationId,
      actorId: 'WEBHOOK_SYSTEM',
      action: 'PAYMENT_WEBHOOK_PROCESSED',
      resourceType: 'Payment',
      resourceId: payment.id,
      metadata: {
        provider,
        status: payload.status,
        externalReference: payload.externalReference,
      },
    });

    return {
      success: true,
      paymentId: updatedPayment.id,
      status: updatedPayment.status,
    };
  }
}
