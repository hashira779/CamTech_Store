import type { DepreciationMethod } from '@mystore/contracts';

export interface AssetDepreciationInput {
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  method: DepreciationMethod;
  accumulatedDepreciation: number;
  currentBookValue: number;
}

export class DepreciationCalculator {
  static computeMonthlyDepreciation(input: AssetDepreciationInput): number {
    const depreciableBase = Math.max(0, input.cost - input.salvageValue);
    if (depreciableBase <= 0 || input.currentBookValue <= input.salvageValue) {
      return 0;
    }

    let monthly = 0;

    if (input.method === 'STRAIGHT_LINE') {
      const months = Math.max(1, input.usefulLifeMonths);
      monthly = depreciableBase / months;
    } else {
      // Double declining balance
      const years = Math.max(1, input.usefulLifeMonths / 12);
      const annualRate = 2 / years;
      monthly = (input.currentBookValue * annualRate) / 12;
    }

    // Ensure we don't depreciate below salvage value
    const maxDepreciable = Math.max(0, input.currentBookValue - input.salvageValue);
    return Number(Math.min(monthly, maxDepreciable).toFixed(2));
  }
}
