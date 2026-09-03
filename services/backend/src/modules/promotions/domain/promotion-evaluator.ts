import {
  type PromotionType,
  type PromotionScope,
  type CustomerType,
  type LineDiscountBreakdown,
  type PromotionEvaluationResultDto,
} from '@mystore/contracts';

export interface PromotionDomainData {
  id: string;
  name: string;
  code: string | null;
  type: PromotionType;
  scope: PromotionScope;
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  startDate: Date | null;
  endDate: Date | null;
  usageLimit: number | null;
  currentUses: number;
  isActive: boolean;
  targetVariantIds: string[] | null;
  targetCategoryIds: string[] | null;
  customerTypes: CustomerType[] | null;
}

export interface CartLineItemForEval {
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  categoryId?: string | null;
}

export class PromotionEvaluator {
  public static evaluate(
    promo: PromotionDomainData,
    lines: CartLineItemForEval[],
    customerType?: CustomerType | null,
    now: Date = new Date(),
  ): PromotionEvaluationResultDto {
    const subtotal = Number(
      lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0).toFixed(4),
    );

    // 1. Inactive check
    if (!promo.isActive) {
      return {
        valid: false,
        message: 'This promotion is currently inactive',
        subtotal,
        discountTotal: 0,
        netTotal: subtotal,
        lineDiscounts: [],
      };
    }

    // 2. Date window check
    if (promo.startDate && now < promo.startDate) {
      return {
        valid: false,
        message: 'This promotion has not started yet',
        subtotal,
        discountTotal: 0,
        netTotal: subtotal,
        lineDiscounts: [],
      };
    }
    if (promo.endDate && now > promo.endDate) {
      return {
        valid: false,
        message: 'This promotion has expired',
        subtotal,
        discountTotal: 0,
        netTotal: subtotal,
        lineDiscounts: [],
      };
    }

    // 3. Usage limit check
    if (promo.usageLimit !== null && promo.currentUses >= promo.usageLimit) {
      return {
        valid: false,
        message: 'This promotion has reached its maximum redemption limit',
        subtotal,
        discountTotal: 0,
        netTotal: subtotal,
        lineDiscounts: [],
      };
    }

    // 4. Customer tier eligibility check
    if (promo.customerTypes && promo.customerTypes.length > 0) {
      if (!customerType || !promo.customerTypes.includes(customerType)) {
        return {
          valid: false,
          message: 'This promotion is exclusive to specific customer tiers',
          subtotal,
          discountTotal: 0,
          netTotal: subtotal,
          lineDiscounts: [],
        };
      }
    }

    // 5. Minimum order amount check
    if (promo.minOrderAmount !== null && subtotal < promo.minOrderAmount) {
      return {
        valid: false,
        message: `Order subtotal ($${subtotal.toFixed(2)}) is below the required minimum of $${promo.minOrderAmount.toFixed(2)}`,
        subtotal,
        discountTotal: 0,
        netTotal: subtotal,
        lineDiscounts: [],
      };
    }

    // 6. Compute discounts per line
    const lineDiscounts: LineDiscountBreakdown[] = [];
    let rawDiscountTotal = 0;

    if (promo.type === 'PERCENTAGE') {
      // Clamp to [0, 100]% so a misconfigured discountValue (e.g. 200) can never
      // produce a per-line discount larger than the line itself (spec §106).
      const pct = Math.min(Math.max(promo.discountValue, 0), 100) / 100;
      for (const line of lines) {
        const lineTotal = line.unitPrice * line.quantity;
        const isEligible = this.isLineEligible(line, promo);
        const discount = isEligible ? Number((lineTotal * pct).toFixed(4)) : 0;
        rawDiscountTotal += discount;
        lineDiscounts.push({
          productVariantId: line.productVariantId,
          originalLineTotal: lineTotal,
          discount,
          netLineTotal: Number((lineTotal - discount).toFixed(4)),
        });
      }
    } else if (promo.type === 'FIXED_AMOUNT' || promo.type === 'ORDER_THRESHOLD') {
      const targetDiscount = Math.min(promo.discountValue, subtotal);
      rawDiscountTotal = targetDiscount;

      // Distribute fixed discount proportionally across lines
      let distributed = 0;
      lines.forEach((line, index) => {
        const lineTotal = line.unitPrice * line.quantity;
        let lineDisc = 0;
        if (index === lines.length - 1) {
          lineDisc = Number((targetDiscount - distributed).toFixed(4));
        } else {
          lineDisc = Number(((lineTotal / subtotal) * targetDiscount).toFixed(4));
          distributed += lineDisc;
        }
        lineDiscounts.push({
          productVariantId: line.productVariantId,
          originalLineTotal: lineTotal,
          discount: lineDisc,
          netLineTotal: Number((lineTotal - lineDisc).toFixed(4)),
        });
      });
    } else if (promo.type === 'BUY_X_GET_Y') {
      const buyQty = promo.buyQuantity || 1;
      const getQty = promo.getQuantity || 1;
      const setSize = buyQty + getQty;

      for (const line of lines) {
        const lineTotal = line.unitPrice * line.quantity;
        const isEligible = this.isLineEligible(line, promo);
        let discount = 0;
        if (isEligible && line.quantity >= setSize) {
          const freeSets = Math.floor(line.quantity / setSize);
          const freeUnits = freeSets * getQty;
          discount = Number((freeUnits * line.unitPrice).toFixed(4));
        }
        rawDiscountTotal += discount;
        lineDiscounts.push({
          productVariantId: line.productVariantId,
          originalLineTotal: lineTotal,
          discount,
          netLineTotal: Number((lineTotal - discount).toFixed(4)),
        });
      }
    }

    // 7. Enforce maxDiscountAmount cap if configured
    let finalDiscountTotal = rawDiscountTotal;
    if (promo.maxDiscountAmount !== null && finalDiscountTotal > promo.maxDiscountAmount) {
      finalDiscountTotal = promo.maxDiscountAmount;
      // Re-normalize line discounts
      const ratio = promo.maxDiscountAmount / rawDiscountTotal;
      for (const ld of lineDiscounts) {
        ld.discount = Number((ld.discount * ratio).toFixed(4));
        ld.netLineTotal = Number((ld.originalLineTotal - ld.discount).toFixed(4));
      }
    }

    // Final safety net (spec §106): a promotion can never discount more than the
    // cart is worth, so the order total can never go negative.
    finalDiscountTotal = Number(Math.min(Math.max(finalDiscountTotal, 0), subtotal).toFixed(4));
    const netTotal = Number(Math.max(subtotal - finalDiscountTotal, 0).toFixed(4));

    return {
      valid: true,
      promotion: {
        id: promo.id,
        code: promo.code,
        name: promo.name,
        type: promo.type,
        discountValue: promo.discountValue,
      },
      subtotal,
      discountTotal: finalDiscountTotal,
      netTotal,
      lineDiscounts,
    };
  }

  private static isLineEligible(line: CartLineItemForEval, promo: PromotionDomainData): boolean {
    if (promo.scope === 'ORDER') return true;
    if (promo.scope === 'PRODUCT') {
      return (promo.targetVariantIds ?? []).includes(line.productVariantId);
    }
    if (promo.scope === 'CATEGORY' && line.categoryId) {
      return (promo.targetCategoryIds ?? []).includes(line.categoryId);
    }
    return false;
  }
}
