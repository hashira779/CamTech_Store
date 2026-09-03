export interface AvailableBatch {
  id: string;
  batchNumber: string;
  expiresAt: Date;
  quantityOnHand: number;
}

export interface AllocatedBatchItem {
  batchId: string;
  batchNumber: string;
  expiresAt: Date;
  allocatedQty: number;
}

export interface FefoAllocationResult {
  allocatedBatches: AllocatedBatchItem[];
  totalAllocated: number;
  unallocatedQty: number;
  isFullyAllocated: boolean;
}

export class FefoBatchAllocator {
  /**
   * Allocates quantity from available batches according to First-Expired, First-Out (FEFO).
   * Batches with earliest expiration dates are used first.
   */
  public static allocate(
    batches: AvailableBatch[],
    neededQty: number,
    asOfDate: Date = new Date(),
  ): FefoAllocationResult {
    if (neededQty <= 0) {
      return {
        allocatedBatches: [],
        totalAllocated: 0,
        unallocatedQty: 0,
        isFullyAllocated: true,
      };
    }

    // Filter non-expired batches with positive stock and sort by earliest expiration
    const validBatches = batches
      .filter((b) => b.quantityOnHand > 0 && new Date(b.expiresAt) > asOfDate)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());

    const allocatedBatches: AllocatedBatchItem[] = [];
    let remainingToAllocate = neededQty;

    for (const batch of validBatches) {
      if (remainingToAllocate <= 0) break;

      const takeQty = Math.min(batch.quantityOnHand, remainingToAllocate);
      allocatedBatches.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiresAt: new Date(batch.expiresAt),
        allocatedQty: takeQty,
      });

      remainingToAllocate -= takeQty;
    }

    const totalAllocated = neededQty - remainingToAllocate;

    return {
      allocatedBatches,
      totalAllocated,
      unallocatedQty: remainingToAllocate,
      isFullyAllocated: remainingToAllocate === 0,
    };
  }
}
