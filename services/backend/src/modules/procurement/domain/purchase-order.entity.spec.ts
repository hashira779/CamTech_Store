import { PurchaseOrderEntity } from './purchase-order.entity';
import { BadRequestException } from '@nestjs/common';

describe('PurchaseOrderEntity', () => {
  describe('calculateLines', () => {
    it('accurately computes subtotal, tax, and grand total', () => {
      const result = PurchaseOrderEntity.calculateLines([
        { productVariantId: 'v1', quantity: 10, unitCost: 15, taxRatePct: 10 }, // 150 + 15 = 165
        { productVariantId: 'v2', quantity: 5, unitCost: 20, taxRatePct: 0 },   // 100 + 0 = 100
      ]);

      expect(result.subtotal).toBe(250);
      expect(result.taxTotal).toBe(15);
      expect(result.grandTotal).toBe(265);
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].lineTotal).toBe(165);
      expect(result.lines[1].lineTotal).toBe(100);
    });

    it('throws when no line items provided', () => {
      expect(() => PurchaseOrderEntity.calculateLines([])).toThrow(BadRequestException);
    });

    it('throws when quantity is <= 0', () => {
      expect(() =>
        PurchaseOrderEntity.calculateLines([{ productVariantId: 'v1', quantity: 0, unitCost: 10 }]),
      ).toThrow(BadRequestException);
    });

    it('throws when unit cost is negative', () => {
      expect(() =>
        PurchaseOrderEntity.calculateLines([{ productVariantId: 'v1', quantity: 1, unitCost: -5 }]),
      ).toThrow(BadRequestException);
    });
  });

  describe('validateTransition', () => {
    it('allows valid transitions', () => {
      expect(() => PurchaseOrderEntity.validateTransition('DRAFT', 'SUBMITTED')).not.toThrow();
      expect(() => PurchaseOrderEntity.validateTransition('SUBMITTED', 'APPROVED')).not.toThrow();
      expect(() => PurchaseOrderEntity.validateTransition('APPROVED', 'PARTIALLY_RECEIVED')).not.toThrow();
      expect(() => PurchaseOrderEntity.validateTransition('PARTIALLY_RECEIVED', 'COMPLETED')).not.toThrow();
      expect(() => PurchaseOrderEntity.validateTransition('APPROVED', 'CANCELLED')).not.toThrow();
    });

    it('blocks illegal transitions', () => {
      expect(() => PurchaseOrderEntity.validateTransition('DRAFT', 'COMPLETED')).toThrow(BadRequestException);
      expect(() => PurchaseOrderEntity.validateTransition('COMPLETED', 'DRAFT')).toThrow(BadRequestException);
      expect(() => PurchaseOrderEntity.validateTransition('CANCELLED', 'APPROVED')).toThrow(BadRequestException);
    });
  });

  describe('computeNextReceiptStatus', () => {
    const line1 = { id: 'line-1', quantity: 10, receivedQty: 0 };
    const line2 = { id: 'line-2', quantity: 20, receivedQty: 10 };
    const lineMap = new Map([
      ['line-1', line1],
      ['line-2', line2],
    ]);

    it('returns PARTIALLY_RECEIVED when some lines remain', () => {
      const nextStatus = PurchaseOrderEntity.computeNextReceiptStatus(
        [line1, line2],
        [{ poLineItemId: 'line-1', quantityReceived: 5 }],
        lineMap,
      );
      expect(nextStatus).toBe('PARTIALLY_RECEIVED');
    });

    it('returns COMPLETED when all lines are fully received', () => {
      const nextStatus = PurchaseOrderEntity.computeNextReceiptStatus(
        [line1, line2],
        [
          { poLineItemId: 'line-1', quantityReceived: 10 },
          { poLineItemId: 'line-2', quantityReceived: 10 },
        ],
        lineMap,
      );
      expect(nextStatus).toBe('COMPLETED');
    });

    it('throws when receiving more than remaining quantity', () => {
      expect(() =>
        PurchaseOrderEntity.computeNextReceiptStatus(
          [line1, line2],
          [{ poLineItemId: 'line-1', quantityReceived: 15 }], // only 10 ordered!
          lineMap,
        ),
      ).toThrow(BadRequestException);
    });
  });
});
