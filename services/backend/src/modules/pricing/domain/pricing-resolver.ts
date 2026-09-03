import type { ResolvedPriceLineDto } from '@mystore/contracts';

export interface VariantBasePricing {
  id: string;
  sellPrice: number;
  costPrice: number;
}

export interface CandidatePriceListItem {
  productVariantId: string;
  unitPrice: number;
  minQuantity: number;
  priceListName?: string;
}

export class PricingResolver {
  /**
   * Resolve effective unit price for a given variant and order quantity.
   *
   * Priority:
   * 1. Candidate Price List items with highest qualifying minQuantity (quantity >= minQuantity)
   * 2. Fallback to base variant sellPrice
   */
  public static resolvePrice(
    variant: VariantBasePricing,
    quantity: number,
    candidateItems: CandidatePriceListItem[] = [],
  ): ResolvedPriceLineDto {
    const basePrice = Number(variant.sellPrice);

    // Find items that match this variant and where order quantity meets or exceeds minQuantity
    const qualifying = candidateItems
      .filter((item) => item.productVariantId === variant.id && quantity >= item.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity); // Highest threshold first

    if (qualifying.length > 0) {
      const best = qualifying[0];
      const resolvedUnitPrice = Number(best.unitPrice);
      const savingsPerUnit = Math.max(0, Number((basePrice - resolvedUnitPrice).toFixed(4)));
      const priceSource = best.minQuantity > 1 ? 'VOLUME_TIER' : 'PRICE_LIST';

      return {
        productVariantId: variant.id,
        quantity,
        basePrice,
        resolvedUnitPrice,
        savingsPerUnit,
        priceSource,
        tierMinQty: best.minQuantity,
        priceListName: best.priceListName,
      };
    }

    return {
      productVariantId: variant.id,
      quantity,
      basePrice,
      resolvedUnitPrice: basePrice,
      savingsPerUnit: 0,
      priceSource: 'BASE_PRICE',
    };
  }
}
