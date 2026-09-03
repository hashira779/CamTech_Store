import { PaymentsService } from './payments.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('PaymentsService (Spec §20, §21)', () => {
  let service: PaymentsService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
      },
      sale: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      salePayment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new PaymentsService(prisma as PrismaService, audit as AuditService);
  });

  describe('createPaymentIntent', () => {
    it('generates dynamic KHQR for QR payment method', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Central Mart',
        currency: 'USD',
      });

      const res = await service.createPaymentIntent('org-1', 'user-1', {
        method: 'QR',
        amount: 35.0,
        currency: 'USD',
        billNumber: 'S-2026-0088',
      });

      expect(res.status).toBe('PENDING');
      expect(res.amount).toBe(35.0);
      expect(res.qrString).toBeDefined();
      expect(res.qrString).toContain('CENTRAL MART');
      expect(res.qrString).toContain('540535.00');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_INTENT_CREATED' }),
      );
    });
  });

  describe('processWebhook', () => {
    it('marks payment COMPLETED and completes sale when fully paid', async () => {
      prisma.salePayment.findUnique.mockResolvedValue({
        id: 'pay-1',
        saleId: 'sale-1',
        amount: new Decimal(50),
        status: 'PENDING',
        sale: {
          id: 'sale-1',
          organizationId: 'org-1',
          grandTotal: new Decimal(50),
        },
      });

      prisma.salePayment.update.mockResolvedValue({
        id: 'pay-1',
        status: 'COMPLETED',
      });

      prisma.salePayment.findMany.mockResolvedValue([
        { id: 'pay-1', amount: new Decimal(50), status: 'COMPLETED' },
      ]);

      const res = await service.processWebhook('BAKONG_KHQR', {
        transactionId: 'pay-1',
        status: 'COMPLETED',
        amount: 50,
        currency: 'USD',
        externalReference: 'BAKONG-HASH-123456',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('COMPLETED');
      expect(prisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sale-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_WEBHOOK_PROCESSED' }),
      );
    });
  });
});
