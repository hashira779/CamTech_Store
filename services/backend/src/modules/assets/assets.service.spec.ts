import { AssetsService } from './assets.service';
import { ConflictException } from '@nestjs/common';

describe('AssetsService', () => {
  let service: AssetsService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      fixedAsset: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      depreciationRecord: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new AssetsService(mockPrisma, mockAudit);
  });

  describe('createAsset', () => {
    it('throws ConflictException on duplicate asset code', async () => {
      mockPrisma.fixedAsset.findUnique.mockResolvedValue({ id: 'fa_1', assetCode: 'FA-001' });

      await expect(
        service.createAsset('org_1', {
          assetCode: 'FA-001',
          name: 'POS Terminal',
          category: 'EQUIPMENT',
          purchaseDate: '2026-01-01',
          purchaseCost: 1000,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates new fixed asset and records audit log', async () => {
      mockPrisma.fixedAsset.findUnique.mockResolvedValue(null);
      mockPrisma.fixedAsset.create.mockResolvedValue({
        id: 'fa_new',
        organizationId: 'org_1',
        assetCode: 'FA-002',
        name: 'Barcode Scanner',
        category: 'EQUIPMENT',
        purchaseDate: new Date('2026-02-01'),
        purchaseCost: 200,
        salvageValue: 0,
        usefulLifeMonths: 24,
        depreciationMethod: 'STRAIGHT_LINE',
        accumulatedDeprec: 0,
        currentBookValue: 200,
        status: 'ACTIVE',
        locationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        depreciationRecords: [],
      });

      const res = await service.createAsset('org_1', {
        assetCode: 'FA-002',
        name: 'Barcode Scanner',
        category: 'EQUIPMENT',
        purchaseDate: '2026-02-01',
        purchaseCost: 200,
      } as any);

      expect(res.assetCode).toBe('FA-002');
      expect(res.currentBookValue).toBe(200);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ASSET_CREATED' }),
      );
    });
  });

  describe('runDepreciation', () => {
    it('computes and records monthly depreciation', async () => {
      mockPrisma.fixedAsset.findFirst.mockResolvedValue({
        id: 'fa_1',
        organizationId: 'org_1',
        assetCode: 'FA-001',
        purchaseCost: 1200,
        salvageValue: 0,
        usefulLifeMonths: 12,
        depreciationMethod: 'STRAIGHT_LINE',
        accumulatedDeprec: 0,
        currentBookValue: 1200,
      });

      const fakeRecord = {
        id: 'dr_1',
        assetId: 'fa_1',
        periodDate: new Date(),
        amount: 100,
        bookValueAfter: 1100,
        journalEntryId: null,
        createdAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          depreciationRecord: { create: jest.fn().mockResolvedValue(fakeRecord) },
          fixedAsset: { update: jest.fn() },
        };
        return cb(tx);
      });

      const res = await service.runDepreciation('org_1', 'fa_1');
      expect(res.amount).toBe(100);
      expect(res.bookValueAfter).toBe(1100);
    });
  });
});
