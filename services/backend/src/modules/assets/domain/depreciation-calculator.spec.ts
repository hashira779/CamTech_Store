import { DepreciationCalculator } from './depreciation-calculator';

describe('DepreciationCalculator', () => {
  it('computes straight-line monthly depreciation accurately', () => {
    // Cost: $1,200, Salvage: $0, 12 months useful life -> $100/mo
    const monthly = DepreciationCalculator.computeMonthlyDepreciation({
      cost: 1200,
      salvageValue: 0,
      usefulLifeMonths: 12,
      method: 'STRAIGHT_LINE',
      accumulatedDepreciation: 0,
      currentBookValue: 1200,
    });

    expect(monthly).toBe(100);
  });

  it('caps depreciation at salvage value', () => {
    // Current book value is $120, salvage value is $100 -> can only depreciate $20 max
    const monthly = DepreciationCalculator.computeMonthlyDepreciation({
      cost: 1200,
      salvageValue: 100,
      usefulLifeMonths: 12,
      method: 'STRAIGHT_LINE',
      accumulatedDepreciation: 1080,
      currentBookValue: 120,
    });

    expect(monthly).toBe(20);
  });
});
