import { Product } from './product.entity';
import type { ProductType } from '@mystore/contracts';

describe('Product (domain)', () => {
  const base = {
    organizationId: 'org1',
    name: 'Test',
    type: 'PHYSICAL' as ProductType,
    variants: [
      {
        sku: 'SKU-1',
        unit: 'piece' as const,
        currency: 'USD' as const,
        costPrice: 6,
        sellPrice: 10,
        taxRatePct: 0,
      }
    ]
  };

  it('derives gross margin on the server', () => {
    const p = Product.create(base);
    // (10 - 6) / 10 * 100 = 40
    expect(p.toDto().variants[0].marginPct).toBe(40);
  });

  it('returns 0 margin when sell price is 0', () => {
    const p = Product.create({ ...base, variants: [{...base.variants[0], sellPrice: 0, costPrice: 0 }] });
    expect(p.toDto().variants[0].marginPct).toBe(0);
  });

  it('allows negative margin (selling at a loss) without throwing', () => {
    const p = Product.create({ ...base, variants: [{...base.variants[0], costPrice: 12, sellPrice: 10 }] });
    expect(p.toDto().variants[0].marginPct).toBeCloseTo(-20, 5);
  });

  it('rejects negative prices', () => {
    expect(() => Product.create({ ...base, variants: [{...base.variants[0], costPrice: -1 }] })).toThrow(/non-negative/);
  });

  it('rejects out-of-range tax', () => {
    expect(() => Product.create({ ...base, variants: [{...base.variants[0], taxRatePct: 150 }] })).toThrow(/Tax rate/);
  });

  it('trims strings and normalizes empty optionals to null', () => {
    const p = Product.create({ ...base, name: '  Latte  ', description: '   ', variants: [{...base.variants[0], sku: '  SKU-2 '}] });
    const dto = p.toDto();
    expect(dto.variants[0].sku).toBe('SKU-2');
    expect(dto.name).toBe('Latte');
    expect(dto.description).toBeNull();
  });
});
