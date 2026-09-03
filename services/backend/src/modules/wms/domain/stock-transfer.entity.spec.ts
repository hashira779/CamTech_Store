import { StockTransferEntity } from './stock-transfer.entity';
import { BadRequestException } from '@nestjs/common';

describe('StockTransferEntity (Spec §32)', () => {
  describe('validateCreation', () => {
    it('rejects if source and destination are the same location', () => {
      expect(() => {
        StockTransferEntity.validateCreation('loc-1', 'loc-1', [
          { productVariantId: 'var-1', requestedQty: 10 },
        ]);
      }).toThrow(BadRequestException);
    });

    it('rejects if no line items are provided', () => {
      expect(() => {
        StockTransferEntity.validateCreation('loc-1', 'loc-2', []);
      }).toThrow(BadRequestException);
    });

    it('rejects if any line quantity is zero or negative', () => {
      expect(() => {
        StockTransferEntity.validateCreation('loc-1', 'loc-2', [
          { productVariantId: 'var-1', requestedQty: 0 },
        ]);
      }).toThrow(BadRequestException);
    });

    it('accepts valid transfer parameters', () => {
      expect(() => {
        StockTransferEntity.validateCreation('loc-1', 'loc-2', [
          { productVariantId: 'var-1', requestedQty: 15 },
        ]);
      }).not.toThrow();
    });
  });

  describe('validateStatusTransition', () => {
    it('allows DRAFT -> REQUESTED -> APPROVED -> IN_TRANSIT -> RECEIVED', () => {
      expect(() => StockTransferEntity.validateStatusTransition('DRAFT', 'REQUESTED')).not.toThrow();
      expect(() => StockTransferEntity.validateStatusTransition('REQUESTED', 'APPROVED')).not.toThrow();
      expect(() => StockTransferEntity.validateStatusTransition('APPROVED', 'IN_TRANSIT')).not.toThrow();
      expect(() => StockTransferEntity.validateStatusTransition('IN_TRANSIT', 'RECEIVED')).not.toThrow();
    });

    it('rejects invalid jump from DRAFT directly to RECEIVED', () => {
      expect(() => StockTransferEntity.validateStatusTransition('DRAFT', 'RECEIVED')).toThrow(
        BadRequestException,
      );
    });

    it('rejects transition from terminal status RECEIVED', () => {
      expect(() => StockTransferEntity.validateStatusTransition('RECEIVED', 'CANCELLED')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('calculateLineDiscrepancy', () => {
    it('computes 0 when received matches sent', () => {
      expect(StockTransferEntity.calculateLineDiscrepancy(20, 20)).toBe(0);
    });

    it('computes positive discrepancy when items are missing', () => {
      expect(StockTransferEntity.calculateLineDiscrepancy(20, 18)).toBe(2);
    });
  });
});
