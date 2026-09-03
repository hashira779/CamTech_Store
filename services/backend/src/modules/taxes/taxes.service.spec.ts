import { TaxesService } from './taxes.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';
import { ConflictException } from '@nestjs/common';

describe('TaxesService (Spec §25, §26)', () => {
  let service: TaxesService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      taxRate: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new TaxesService(prisma as PrismaService, audit as AuditService);
  });

  describe('createTaxRate', () => {
    it('creates a new tax rate and records audit log', async () => {
      prisma.taxRate.findUnique.mockResolvedValue(null);
      prisma.taxRate.create.mockResolvedValue({
        id: 'tax-1',
        organizationId: 'org-1',
        code: 'VAT-10',
        name: 'Standard VAT',
        ratePct: new Decimal(10),
        isInclusive: false,
        isCompound: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createTaxRate('org-1', 'user-1', {
        code: 'VAT-10',
        name: 'Standard VAT',
        ratePct: 10,
      });

      expect(res.code).toBe('VAT-10');
      expect(res.ratePct).toBe(10);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TAX_RATE_CREATED' }),
      );
    });

    it('rejects duplicate tax code within tenant', async () => {
      prisma.taxRate.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createTaxRate('org-1', 'user-1', {
          code: 'VAT-10',
          name: 'Standard VAT',
          ratePct: 10,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('calculateTaxes', () => {
    it('calculates cart taxes using pure domain engine', () => {
      const res = service.calculateTaxes({
        lines: [
          { unitPrice: 100, quantity: 1, discount: 0, taxRatePct: 10, isInclusive: false, isCompound: false },
        ],
      });

      expect(res.subtotal).toBe(100);
      expect(res.taxTotal).toBe(10);
      expect(res.grandTotal).toBe(110);
    });
  });
});
