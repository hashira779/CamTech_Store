import { BadRequestException } from '@nestjs/common';
import type { PurchaseOrderStatus } from '@mystore/contracts';

export interface POLineCalc {
  productVariantId: string;
  quantity: number;
  unitCost: number;
  taxRatePct: number;
  taxAmount: number;
  lineTotal: number;
  receivedQty: number;
}

export class PurchaseOrderEntity {
  public static calculateLines(
    rawLines: Array<{
      productVariantId: string;
      quantity: number;
      unitCost: number;
      taxRatePct?: number;
      receivedQty?: number;
    }>,
  ): {
    lines: POLineCalc[];
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
  } {
    if (!rawLines || rawLines.length === 0) {
      throw new BadRequestException('Purchase order must contain at least one line item');
    }

    let subtotal = 0;
    let taxTotal = 0;

    const lines: POLineCalc[] = rawLines.map((line) => {
      if (line.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than zero');
      }
      if (line.unitCost < 0) {
        throw new BadRequestException('Unit cost cannot be negative');
      }

      const lineSubtotal = line.quantity * line.unitCost;
      const taxRatePct = line.taxRatePct ?? 0;
      const taxAmount = Number(((lineSubtotal * taxRatePct) / 100).toFixed(4));
      const lineTotal = Number((lineSubtotal + taxAmount).toFixed(4));

      subtotal += lineSubtotal;
      taxTotal += taxAmount;

      return {
        productVariantId: line.productVariantId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        taxRatePct,
        taxAmount,
        lineTotal,
        receivedQty: line.receivedQty ?? 0,
      };
    });

    subtotal = Number(subtotal.toFixed(4));
    taxTotal = Number(taxTotal.toFixed(4));
    const grandTotal = Number((subtotal + taxTotal).toFixed(4));

    return { lines, subtotal, taxTotal, grandTotal };
  }

  public static validateTransition(
    currentStatus: PurchaseOrderStatus,
    newStatus: PurchaseOrderStatus,
  ): void {
    const validTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      DRAFT: ['SUBMITTED', 'APPROVED', 'CANCELLED'],
      SUBMITTED: ['APPROVED', 'CANCELLED', 'DRAFT'],
      APPROVED: ['PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED'],
      PARTIALLY_RECEIVED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition purchase order from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  public static computeNextReceiptStatus(
    poLines: Array<{ id: string; quantity: number; receivedQty: number }>,
    receiptLines: Array<{ poLineItemId: string; quantityReceived: number }>,
    lineIdMap: Map<string, { quantity: number; receivedQty: number }>,
  ): PurchaseOrderStatus {
    for (const receipt of receiptLines) {
      const line = lineIdMap.get(receipt.poLineItemId);
      if (!line) {
        throw new BadRequestException(`PO line item ${receipt.poLineItemId} not found on this order`);
      }
      const remaining = line.quantity - line.receivedQty;
      if (receipt.quantityReceived > remaining) {
        throw new BadRequestException(
          `Cannot receive ${receipt.quantityReceived} units; only ${remaining} remaining on line item`,
        );
      }
    }

    // Check if after this receipt, all lines are fully received
    const allComplete = poLines.every((l) => {
      const additional =
        receiptLines.find((r) => r.poLineItemId === l.id)?.quantityReceived ?? 0;
      return l.receivedQty + additional >= l.quantity;
    });

    return allComplete ? 'COMPLETED' : 'PARTIALLY_RECEIVED';
  }
}
