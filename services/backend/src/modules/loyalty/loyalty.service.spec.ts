import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestException } from '@nestjs/common';

describe('LoyaltyService (Spec §43, §44)', () => {
  let service: LoyaltyService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      loyaltyProgramConfig: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customer: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      loyaltyTransaction: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      storeCreditTransaction: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new LoyaltyService(prisma as PrismaService, audit as AuditService);
  });

  describe('adjustPoints', () => {
    it('increases loyalty points and records ADJUST transaction', async () => {
      prisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        name: 'John Doe',
        loyaltyPoints: 100,
        loyaltyTier: 'BRONZE',
      });

      prisma.loyaltyTransaction.create.mockResolvedValue({
        id: 'tx-1',
        organizationId: 'org-1',
        customerId: 'cust-1',
        type: 'ADJUST',
        points: 50,
        balanceAfter: 150,
        notes: 'Goodwill adjustment',
        actorId: 'user-1',
        createdAt: new Date(),
      });

      const res = await service.adjustPoints('org-1', 'user-1', {
        customerId: 'cust-1',
        points: 50,
        notes: 'Goodwill adjustment',
      });

      expect(res.points).toBe(50);
      expect(res.balanceAfter).toBe(150);
      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { loyaltyPoints: 150 } }),
      );
    });

    it('rejects deduction exceeding available balance', async () => {
      prisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        name: 'John Doe',
        loyaltyPoints: 30,
      });

      await expect(
        service.adjustPoints('org-1', 'user-1', {
          customerId: 'cust-1',
          points: -50,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('adjustStoreCredit', () => {
    it('adds store credit and records CREDIT transaction', async () => {
      prisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        name: 'John Doe',
        storeCredit: new Decimal(20.0),
      });

      prisma.storeCreditTransaction.create.mockResolvedValue({
        id: 'ctx-1',
        organizationId: 'org-1',
        customerId: 'cust-1',
        type: 'CREDIT',
        amount: new Decimal(30.0),
        balanceAfter: new Decimal(50.0),
        notes: 'Gift card',
        actorId: 'user-1',
        createdAt: new Date(),
      });

      const res = await service.adjustStoreCredit('org-1', 'user-1', {
        customerId: 'cust-1',
        amount: 30.0,
        notes: 'Gift card',
      });

      expect(res.amount).toBe(30.0);
      expect(res.balanceAfter).toBe(50.0);
      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { storeCredit: new Decimal(50.0) } }),
      );
    });
  });
});
