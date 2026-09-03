import { WmsService } from './wms.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('WmsService (Spec §31, §32)', () => {
  let service: WmsService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      location: {
        findFirst: jest.fn(),
      },
      productVariant: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      stockTransfer: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      inventoryItem: {
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      stockTransferLine: {
        update: jest.fn(),
      },
      warehouseZone: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      warehouseBin: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      productBatch: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new WmsService(prisma as PrismaService, audit as AuditService);
  });

  describe('createTransfer', () => {
    it('creates a transfer with sequential transfer number and lines', async () => {
      prisma.location.findFirst
        .mockResolvedValueOnce({ id: 'loc-1', name: 'Main HQ' })
        .mockResolvedValueOnce({ id: 'loc-2', name: 'Branch 1' });

      prisma.productVariant.findMany.mockResolvedValue([{ id: 'var-1' }]);

      prisma.stockTransfer.create.mockResolvedValue({
        id: 'trans-1',
        organizationId: 'org-1',
        transferNumber: 'TR-2026-000001',
        sourceLocationId: 'loc-1',
        destinationLocationId: 'loc-2',
        status: 'REQUESTED',
        requestedById: 'user-1',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [
          {
            id: 'line-1',
            stockTransferId: 'trans-1',
            productVariantId: 'var-1',
            requestedQty: new Decimal(20),
            sentQty: new Decimal(0),
            receivedQty: new Decimal(0),
            batchNumber: null,
            sourceBinId: null,
            destBinId: null,
          },
        ],
      });

      const res = await service.createTransfer('org-1', 'user-1', {
        sourceLocationId: 'loc-1',
        destinationLocationId: 'loc-2',
        lines: [{ productVariantId: 'var-1', requestedQty: 20 }],
      });

      expect(res.transferNumber).toBe('TR-2026-000001');
      expect(res.status).toBe('REQUESTED');
      expect(res.lines).toHaveLength(1);
      expect(res.lines[0].requestedQty).toBe(20);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_TRANSFER_CREATED' }),
      );
    });
  });

  describe('shipTransfer', () => {
    it('deducts inventory and records TRANSFER_OUT on dispatch', async () => {
      prisma.stockTransfer.findFirst.mockResolvedValue({
        id: 'trans-1',
        organizationId: 'org-1',
        transferNumber: 'TR-2026-000001',
        sourceLocationId: 'loc-1',
        destinationLocationId: 'loc-2',
        status: 'APPROVED',
        lines: [{ id: 'line-1', productVariantId: 'var-1', requestedQty: new Decimal(10) }],
      });

      prisma.inventoryItem.findUnique.mockResolvedValue({
        id: 'item-1',
        stockOnHand: new Decimal(50),
      });

      prisma.inventoryItem.update.mockResolvedValue({
        id: 'item-1',
        stockOnHand: new Decimal(40),
      });

      prisma.stockTransfer.update.mockResolvedValue({
        id: 'trans-1',
        status: 'IN_TRANSIT',
      });

      // Mock getTransfer return
      jest.spyOn(service, 'getTransfer').mockResolvedValue({
        id: 'trans-1',
        organizationId: 'org-1',
        transferNumber: 'TR-2026-000001',
        sourceLocationId: 'loc-1',
        destinationLocationId: 'loc-2',
        status: 'IN_TRANSIT',
        requestedById: 'user-1',
        approvedById: null,
        shippedById: 'user-1',
        receivedById: null,
        shippedAt: new Date().toISOString(),
        receivedAt: null,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lines: [],
      });

      const res = await service.shipTransfer('org-1', 'user-1', 'trans-1');

      expect(res.status).toBe('IN_TRANSIT');
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { stockOnHand: new Decimal(40) },
        }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'TRANSFER_OUT', quantity: new Decimal(-10) }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_TRANSFER_SHIPPED' }),
      );
    });
  });
});
