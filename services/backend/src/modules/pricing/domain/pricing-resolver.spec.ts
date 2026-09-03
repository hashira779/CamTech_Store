import { PricingResolver } from './pricing-resolver';

describe('PricingResolver', () => {
  const sampleVariant = {
    id: 'v-1',
    sellPrice: 100,
    costPrice: 60,
  };

  const candidateItems = [
    { productVariantId: 'v-1', unitPrice: 90, minQuantity: 1, priceListName: 'Wholesale Standard' },
    { productVariantId: 'v-1', unitPrice: 80, minQuantity: 10, priceListName: 'Wholesale Standard' },
    { productVariantId: 'v-1', unitPrice: 70, minQuantity: 50, priceListName: 'Wholesale Standard' },
  ];

  it('falls back to base price when no price list candidates match', () => {
    const res = PricingResolver.resolvePrice(sampleVariant, 1, []);

    expect(res.resolvedUnitPrice).toBe(100);
    expect(res.basePrice).toBe(100);
    expect(res.savingsPerUnit).toBe(0);
    expect(res.priceSource).toBe('BASE_PRICE');
  });

  it('resolves standard tier 1 price list price for quantity 1', () => {
    const res = PricingResolver.resolvePrice(sampleVariant, 1, candidateItems);

    expect(res.resolvedUnitPrice).toBe(90);
    expect(res.savingsPerUnit).toBe(10);
    expect(res.priceSource).toBe('PRICE_LIST');
  });

  it('resolves 10+ volume break price when ordering 15 units', () => {
    const res = PricingResolver.resolvePrice(sampleVariant, 15, candidateItems);

    expect(res.resolvedUnitPrice).toBe(80);
    expect(res.savingsPerUnit).toBe(20);
    expect(res.priceSource).toBe('VOLUME_TIER');
    expect(res.tierMinQty).toBe(10);
  });

  it('resolves 50+ highest volume break price when ordering 100 units', () => {
    const res = PricingResolver.resolvePrice(sampleVariant, 100, candidateItems);

    expect(res.resolvedUnitPrice).toBe(70);
    expect(res.savingsPerUnit).toBe(30);
    expect(res.priceSource).toBe('VOLUME_TIER');
    expect(res.tierMinQty).toBe(50);
  });
});
