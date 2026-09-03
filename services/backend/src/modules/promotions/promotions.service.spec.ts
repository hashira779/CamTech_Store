import { PromotionsService } from './promotions.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConflictException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      promotion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new PromotionsService(prisma as PrismaService, audit as AuditService);
  });

  describe('createPromotion', () => {
    it('creates promotion and logs audit', async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);
      prisma.promotion.create.mockResolvedValue({
        id: 'promo-1',
        organizationId: 'org-1',
        name: 'Flash Sale',
        code: 'FLASH20',
        description: null,
        type: 'PERCENTAGE',
        scope: 'ORDER',
        discountValue: new Decimal(20),
        minOrderAmount: null,
        maxDiscountAmount: null,
        buyQuantity: null,
        getQuantity: null,
        startDate: null,
        endDate: null,
        usageLimit: null,
        currentUses: 0,
        isActive: true,
        targetVariantIds: null,
        targetCategoryIds: null,
        customerTypes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createPromotion(
        'org-1',
        { name: 'Flash Sale', code: 'FLASH20', type: 'PERCENTAGE', discountValue: 20 },
        'user-1',
      );

      expect(res.id).toBe('promo-1');
      expect(res.code).toBe('FLASH20');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PROMOTION_CREATED', resourceId: 'promo-1' }),
      );
    });

    it('rejects duplicate promo code in same organization', async () => {
      prisma.promotion.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createPromotion(
          'org-1',
          { name: 'Flash Sale', code: 'FLASH20', type: 'PERCENTAGE', discountValue: 20 },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('evaluateCart', () => {
    it('evaluates cart and computes valid discount', async () => {
      prisma.promotion.findFirst.mockResolvedValue({
        id: 'promo-1',
        organizationId: 'org-1',
        name: 'Flash Sale',
        code: 'FLASH20',
        type: 'PERCENTAGE',
        scope: 'ORDER',
        discountValue: new Decimal(20),
        minOrderAmount: new Decimal(50),
        maxDiscountAmount: null,
        buyQuantity: null,
        getQuantity: null,
        startDate: null,
        endDate: null,
        usageLimit: 100,
        currentUses: 5,
        isActive: true,
        targetVariantIds: null,
        targetCategoryIds: null,
        customerTypes: null,
      });

      const res = await service.evaluateCart('org-1', {
        promoCode: 'FLASH20',
        lines: [{ productVariantId: 'v1', quantity: 2, unitPrice: 50 }], // $100
      });

      expect(res.valid).toBe(true);
      expect(res.subtotal).toBe(100);
      expect(res.discountTotal).toBe(20);
      expect(res.netTotal).toBe(80);
    });

    it('returns valid=false for non-existent promo code', async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);

      const res = await service.evaluateCart('org-1', {
        promoCode: 'DOESNOTEXIST',
        lines: [{ productVariantId: 'v1', quantity: 1, unitPrice: 50 }],
      });

      expect(res.valid).toBe(false);
      expect(res.discountTotal).toBe(0);
    });
  });
});
