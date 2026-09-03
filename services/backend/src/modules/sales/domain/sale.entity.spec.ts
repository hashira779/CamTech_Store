import { SaleEntity } from './sale.entity';
import { Decimal } from '@prisma/client/runtime/library';

describe('SaleEntity', () => {
  const mockVariants = [
    {
      id: 'var-1',
      sku: 'COF-LAT-SM',
      name: 'Small',
      sellPrice: new Decimal(3.5),
      taxRatePct: new Decimal(10),
      product: { name: 'Latte' },
    },
    {
      id: 'var-2',
      sku: 'BAK-CRS',
      name: null,
      sellPrice: new Decimal(2.0),
      taxRatePct: new Decimal(0),
      product: { name: 'Croissant' },
    },
  ];

  it('recalculates line item totals with server-side price lookup and tax', () => {
    const lines = SaleEntity.calculateLines(mockVariants, [
      { productVariantId: 'var-1', quantity: 2, discount: 0.5 }, // (3.5 * 2) - 0.5 = 6.5 + 10% tax (0.65) = 7.15
      { productVariantId: 'var-2', quantity: 1, discount: 0 },   // 2.0 + 0% tax = 2.00
    ]);

    expect(lines).toHaveLength(2);

    expect(lines[0].sku).toBe('COF-LAT-SM');
    expect(lines[0].unitPrice).toBe(3.5);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].discount).toBe(0.5);
    expect(lines[0].taxRatePct).toBe(10);
    expect(lines[0].taxAmount).toBe(0.65);
    expect(lines[0].lineTotal).toBe(7.15);

    expect(lines[1].sku).toBe('BAK-CRS');
    expect(lines[1].unitPrice).toBe(2.0);
    expect(lines[1].quantity).toBe(1);
    expect(lines[1].taxAmount).toBe(0);
    expect(lines[1].lineTotal).toBe(2.0);
  });

  it('computes subtotal, discountTotal, taxTotal, and grandTotal accurately', () => {
    const lines = SaleEntity.calculateLines(mockVariants, [
      { productVariantId: 'var-1', quantity: 2, discount: 0.5 },
      { productVariantId: 'var-2', quantity: 1, discount: 0 },
    ]);

    const totals = SaleEntity.computeTotals(lines);

    // subtotal = (3.5 * 2) + (2.0 * 1) = 9.00
    expect(totals.subtotal).toBe(9.0);
    // discountTotal = 0.5
    expect(totals.discountTotal).toBe(0.5);
    // taxTotal = 0.65
    expect(totals.taxTotal).toBe(0.65);
    // grandTotal = 9.00 - 0.50 + 0.65 = 9.15
    expect(totals.grandTotal).toBe(9.15);
  });

  it('validates whether payments cover the grand total', () => {
    const valid = SaleEntity.validatePayments([{ amount: 10.0 }], 9.15);
    expect(valid.valid).toBe(true);
    expect(valid.totalPaid).toBe(10.0);
    expect(valid.change).toBe(0.85);

    const invalid = SaleEntity.validatePayments([{ amount: 5.0 }], 9.15);
    expect(invalid.valid).toBe(false);
    expect(invalid.totalPaid).toBe(5.0);
  });

  it('throws if a variant is not found in the server lookup map', () => {
    expect(() =>
      SaleEntity.calculateLines(mockVariants, [
        { productVariantId: 'non-existent-var', quantity: 1, discount: 0 },
      ]),
    ).toThrow('Product variant non-existent-var not found');
  });
});
