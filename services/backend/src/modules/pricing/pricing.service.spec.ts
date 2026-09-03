import { PricingService } from './pricing.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      priceList: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      priceListItem: {
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      productVariant: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new PricingService(prisma as PrismaService, audit as AuditService);
  });

  describe('createPriceList', () => {
    it('creates a price list and logs audit event', async () => {
      prisma.priceList.findFirst.mockResolvedValue(null);
      prisma.priceList.create.mockResolvedValue({
        id: 'pl-1',
        organizationId: 'org-1',
        name: 'Wholesale Standard',
        code: 'WHOLESALE',
        description: null,
        currency: 'USD',
        isDefault: false,
        customerType: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createPriceList(
        'org-1',
        { name: 'Wholesale Standard', code: 'WHOLESALE' },
        'user-1',
      );

      expect(res.id).toBe('pl-1');
      expect(res.code).toBe('WHOLESALE');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRICE_LIST_CREATED' }),
      );
    });

    it('rejects duplicate code in same org', async () => {
      prisma.priceList.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createPriceList('org-1', { name: 'Wholesale', code: 'WHOLESALE' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('resolvePrices', () => {
    it('resolves tiered prices from customer price list', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        priceListId: 'pl-1',
        type: 'WHOLESALE',
      });

      prisma.priceList.findFirst.mockResolvedValue({
        id: 'pl-1',
        name: 'Wholesale Tier',
        code: 'PL-WHOLESALE',
        items: [
          {
            productVariantId: 'v-1',
            unitPrice: new Decimal(85),
            minQuantity: new Decimal(10),
          },
        ],
      });

      prisma.productVariant.findMany.mockResolvedValue([
        {
          id: 'v-1',
          sellPrice: new Decimal(100),
          costPrice: new Decimal(60),
        },
      ]);

      const res = await service.resolvePrices('org-1', {
        customerId: 'cust-1',
        lines: [{ productVariantId: 'v-1', quantity: 12 }],
      });

      expect(res.priceListApplied?.name).toBe('Wholesale Tier');
      expect(res.lines[0].resolvedUnitPrice).toBe(85);
      expect(res.lines[0].savingsPerUnit).toBe(15);
      expect(res.lines[0].priceSource).toBe('VOLUME_TIER');
    });
  });
});
