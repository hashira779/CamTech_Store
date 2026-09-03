import { FefoBatchAllocator } from './fefo-batch-allocator';

describe('FefoBatchAllocator (Spec §31)', () => {
  const now = new Date('2026-09-01T00:00:00Z');

  it('allocates from earliest expiring batch first', () => {
    const batches = [
      {
        id: 'b-later',
        batchNumber: 'LOT-DEC',
        expiresAt: new Date('2026-12-31T00:00:00Z'),
        quantityOnHand: 50,
      },
      {
        id: 'b-earlier',
        batchNumber: 'LOT-OCT',
        expiresAt: new Date('2026-10-15T00:00:00Z'),
        quantityOnHand: 20,
      },
    ];

    // Need 25 items: should take 20 from LOT-OCT and 5 from LOT-DEC
    const res = FefoBatchAllocator.allocate(batches, 25, now);

    expect(res.isFullyAllocated).toBe(true);
    expect(res.allocatedBatches).toHaveLength(2);
    expect(res.allocatedBatches[0].batchNumber).toBe('LOT-OCT');
    expect(res.allocatedBatches[0].allocatedQty).toBe(20);
    expect(res.allocatedBatches[1].batchNumber).toBe('LOT-DEC');
    expect(res.allocatedBatches[1].allocatedQty).toBe(5);
    expect(res.totalAllocated).toBe(25);
    expect(res.unallocatedQty).toBe(0);
  });

  it('ignores batches that are already expired', () => {
    const batches = [
      {
        id: 'b-expired',
        batchNumber: 'LOT-OLD',
        expiresAt: new Date('2026-08-01T00:00:00Z'),
        quantityOnHand: 100,
      },
      {
        id: 'b-valid',
        batchNumber: 'LOT-NEW',
        expiresAt: new Date('2026-11-01T00:00:00Z'),
        quantityOnHand: 10,
      },
    ];

    const res = FefoBatchAllocator.allocate(batches, 15, now);

    expect(res.isFullyAllocated).toBe(false);
    expect(res.totalAllocated).toBe(10);
    expect(res.unallocatedQty).toBe(5);
    expect(res.allocatedBatches).toHaveLength(1);
    expect(res.allocatedBatches[0].batchNumber).toBe('LOT-NEW');
  });
});
