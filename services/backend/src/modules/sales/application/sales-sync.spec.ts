import { SalesService } from './sales.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('SalesService - Offline Sync Batch (Spec §17, §18)', () => {
  let service: SalesService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      sale: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new SalesService(prisma as PrismaService, audit as AuditService);
  });

  it('replays valid offline sale successfully and logs audit trail', async () => {
    prisma.sale.findFirst.mockResolvedValue(null);

    // Mock createSale internally
    jest.spyOn(service, 'createSale').mockResolvedValue({
      id: 'sale-123',
      saleNumber: 'S-2026-0001',
      grandTotal: 150,
    } as any);

    const res = await service.syncBatch('org-1', 'user-1', {
      sales: [
        {
          localId: 'offline-uuid-1',
          clientCreatedAt: '2026-09-02T10:00:00.000Z',
          idempotencyKey: 'idemp-1',
          lineItems: [{ productVariantId: 'v-1', quantity: 2 }],
          payments: [{ method: 'CASH', amount: 150 }],
        } as any,
      ],
    });

    expect(res.syncedCount).toBe(1);
    expect(res.failedCount).toBe(0);
    expect(res.results[0]).toEqual({
      localId: 'offline-uuid-1',
      status: 'SYNCED',
      saleId: 'sale-123',
      saleNumber: 'S-2026-0001',
      grandTotal: 150,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'OFFLINE_SALE_SYNCED',
        resourceId: 'sale-123',
      }),
    );
  });

  it('deduplicates offline sale if idempotency key already exists on server', async () => {
    prisma.sale.findFirst.mockResolvedValue({
      id: 'existing-sale',
      saleNumber: 'S-2026-0099',
      grandTotal: new Decimal(200),
    });

    const createSaleSpy = jest.spyOn(service, 'createSale');

    const res = await service.syncBatch('org-1', 'user-1', {
      sales: [
        {
          localId: 'offline-uuid-2',
          clientCreatedAt: '2026-09-02T10:00:00.000Z',
          idempotencyKey: 'idemp-duplicate',
          lineItems: [{ productVariantId: 'v-1', quantity: 1 }],
          payments: [{ method: 'CASH', amount: 200 }],
        } as any,
      ],
    });

    expect(createSaleSpy).not.toHaveBeenCalled();
    expect(res.syncedCount).toBe(1);
    expect(res.results[0].status).toBe('DUPLICATE');
    expect(res.results[0].saleNumber).toBe('S-2026-0099');
  });

  it('isolates failure of one item without aborting remaining valid batch items', async () => {
    prisma.sale.findFirst.mockResolvedValue(null);

    jest.spyOn(service, 'createSale')
      .mockRejectedValueOnce(new Error('Product variant not found'))
      .mockResolvedValueOnce({
        id: 'sale-valid',
        saleNumber: 'S-2026-0002',
        grandTotal: 50,
      } as any);

    const res = await service.syncBatch('org-1', 'user-1', {
      sales: [
        {
          localId: 'offline-fail',
          clientCreatedAt: '2026-09-02T10:00:00.000Z',
          lineItems: [{ productVariantId: 'invalid-v', quantity: 1 }],
          payments: [{ method: 'CASH', amount: 50 }],
        } as any,
        {
          localId: 'offline-ok',
          clientCreatedAt: '2026-09-02T10:01:00.000Z',
          lineItems: [{ productVariantId: 'v-2', quantity: 1 }],
          payments: [{ method: 'CASH', amount: 50 }],
        } as any,
      ],
    });

    expect(res.syncedCount).toBe(1);
    expect(res.failedCount).toBe(1);
    expect(res.results[0].status).toBe('FAILED');
    expect(res.results[0].error).toContain('Product variant not found');
    expect(res.results[1].status).toBe('SYNCED');
    expect(res.results[1].saleNumber).toBe('S-2026-0002');
  });
});
