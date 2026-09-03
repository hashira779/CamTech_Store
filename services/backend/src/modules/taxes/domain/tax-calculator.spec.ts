import { TaxCalculator } from './tax-calculator';

describe('TaxCalculator (Spec §25, §26)', () => {
  describe('Exclusive Tax Mode', () => {
    it('computes 10% exclusive sales tax on $100 line item', () => {
      const res = TaxCalculator.calculateLine({
        unitPrice: 100,
        quantity: 1,
        discount: 0,
        taxRatePct: 10,
        isInclusive: false,
      });

      expect(res.netSubtotal).toBe(100.0);
      expect(res.taxAmount).toBe(10.0);
      expect(res.grossAmount).toBe(110.0);
      expect(res.isInclusive).toBe(false);
    });

    it('accounts for line discount before applying tax', () => {
      const res = TaxCalculator.calculateLine({
        unitPrice: 50,
        quantity: 2, // $100
        discount: 20, // $80 net
        taxRatePct: 10,
        isInclusive: false,
      });

      expect(res.netSubtotal).toBe(80.0);
      expect(res.taxAmount).toBe(8.0);
      expect(res.grossAmount).toBe(88.0);
    });
  });

  describe('Inclusive Tax Mode', () => {
    it('extracts 10% inclusive VAT from a $110 retail shelf price', () => {
      const res = TaxCalculator.calculateLine({
        unitPrice: 110,
        quantity: 1,
        taxRatePct: 10,
        isInclusive: true,
      });

      // $110 gross with 10% VAT -> $100 net + $10 tax
      expect(res.grossAmount).toBe(110.0);
      expect(res.netSubtotal).toBe(100.0);
      expect(res.taxAmount).toBe(10.0);
      expect(res.isInclusive).toBe(true);
    });

    it('extracts inclusive VAT accurately with non-trivial rounding', () => {
      const res = TaxCalculator.calculateLine({
        unitPrice: 15.75,
        quantity: 1,
        taxRatePct: 10,
        isInclusive: true,
      });

      // $15.75 / 1.10 = $14.31818... -> $14.32 net
      // $15.75 - $14.32 = $1.43 tax
      expect(res.grossAmount).toBe(15.75);
      expect(res.netSubtotal).toBe(14.32);
      expect(res.taxAmount).toBe(1.43);
    });
  });

  describe('Cart Calculation', () => {
    it('aggregates mixed inclusive and exclusive items in a single cart', () => {
      const lines = [
        { unitPrice: 110, quantity: 1, taxRatePct: 10, isInclusive: true }, // Net: 100, Tax: 10, Gross: 110
        { unitPrice: 50, quantity: 1, taxRatePct: 10, isInclusive: false }, // Net: 50, Tax: 5, Gross: 55
        { unitPrice: 20, quantity: 1, taxRatePct: 0, isInclusive: false }, // Net: 20, Tax: 0, Gross: 20
      ];

      const res = TaxCalculator.calculateCart(lines);

      expect(res.subtotal).toBe(170.0);
      expect(res.taxTotal).toBe(15.0);
      expect(res.grandTotal).toBe(185.0);
      expect(res.lines).toHaveLength(3);
    });
  });
});
