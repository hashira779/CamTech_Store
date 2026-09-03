import { BadRequestException } from '@nestjs/common';
import type { StockTransferStatus } from '@mystore/contracts';

export interface StockTransferLineProps {
  productVariantId: string;
  requestedQty: number;
  sentQty?: number;
  receivedQty?: number;
  batchNumber?: string | null;
  sourceBinId?: string | null;
  destBinId?: string | null;
}

export class StockTransferEntity {
  /**
   * Validates invariant rules when creating a new stock transfer.
   */
  public static validateCreation(
    sourceLocationId: string,
    destinationLocationId: string,
    lines: StockTransferLineProps[],
  ): void {
    if (!sourceLocationId || !destinationLocationId) {
      throw new BadRequestException('Source and destination locations are required');
    }

    if (sourceLocationId === destinationLocationId) {
      throw new BadRequestException('Source and destination locations must be different');
    }

    if (!lines || lines.length === 0) {
      throw new BadRequestException('At least one item line is required for a stock transfer');
    }

    for (const line of lines) {
      if (line.requestedQty <= 0) {
        throw new BadRequestException('Line requested quantity must be greater than zero');
      }
    }
  }

  /**
   * Validates state machine status transitions for Stock Transfers.
   */
  public static validateStatusTransition(
    currentStatus: StockTransferStatus,
    targetStatus: StockTransferStatus,
  ): void {
    const validTransitions: Record<StockTransferStatus, StockTransferStatus[]> = {
      DRAFT: ['REQUESTED', 'CANCELLED'],
      REQUESTED: ['APPROVED', 'CANCELLED'],
      APPROVED: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['RECEIVED'],
      RECEIVED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid transfer status transition from '${currentStatus}' to '${targetStatus}'`,
      );
    }
  }

  /**
   * Calculates discrepancies between sent and received line quantities.
   */
  public static calculateLineDiscrepancy(sentQty: number, receivedQty: number): number {
    return Math.max(0, sentQty) - Math.max(0, receivedQty);
  }
}
