import { Decimal } from '@prisma/client/runtime/library';

/**
 * Sale domain entity — the aggregate root for sales transactions.
 *
 * ALL prices are recalculated server-side (spec §11, §23).
 * The client sends productVariantIds and quantities; the server looks up prices.
 *
 * Business rules:
 *  1. lineTotal = (unitPrice * quantity) - discount + taxAmount
 *  2. subtotal = sum of (unitPrice * quantity) for all lines
 *  3. discountTotal = sum of line discounts
 *  4. taxTotal = sum of line taxes
 *  5. grandTotal = subtotal - discountTotal + taxTotal
 *  6. A sale cannot be COMPLETED unless payments >= grandTotal
 *  7. A COMPLETED sale is immutable (only void/refund allowed)
 */

export interface SaleLineCalc {
  productVariantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;     // Looked up from ProductVariant.sellPrice
  discount: number;      // Validated/capped by server
  taxRatePct: number;    // From ProductVariant.taxRatePct
  taxAmount: number;     // Calculated
  lineTotal: number;     // Calculated
}

import { TaxCalculator } from '../../taxes/domain/tax-calculator';

export class SaleEntity {
  /**
   * Server-side recalculation of a sale from variant data + client quantities.
   *
   * @param variants - Product variants looked up by the server (NEVER from client)
   * @param lineInputs - Client-submitted line items (only variantId, qty, discount)
   */
  static calculateLines(
    variants: Array<{
      id: string;
      sku: string;
      name: string | null;
      sellPrice: Decimal;
      taxRatePct: Decimal;
      taxRate?: { ratePct: Decimal | number; isInclusive: boolean } | null;
      product: { name: string };
    }>,
    lineInputs: Array<{
      productVariantId: string;
      quantity: number;
      discount: number;
    }>,
  ): SaleLineCalc[] {
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    return lineInputs.map((input) => {
      const variant = variantMap.get(input.productVariantId);
      if (!variant) {
        throw new Error(`Product variant ${input.productVariantId} not found`);
      }

      const unitPrice = Number(variant.sellPrice);
      const quantity = input.quantity;
      const discount = Math.min(input.discount, unitPrice * quantity); // Cap discount
      const taxRatePct = variant.taxRate ? Number(variant.taxRate.ratePct) : Number(variant.taxRatePct);
      const isInclusive = variant.taxRate?.isInclusive ?? false;

      const taxCalc = TaxCalculator.calculateLine({
        unitPrice,
        quantity,
        discount,
        taxRatePct,
        isInclusive,
      });

      return {
        productVariantId: variant.id,
        sku: variant.sku,
        productName: variant.product.name,
        variantName: variant.name,
        quantity,
        unitPrice,
        discount: round2(discount),
        taxRatePct,
        taxAmount: taxCalc.taxAmount,
        lineTotal: taxCalc.grossAmount,
      };
    });
  }

  /**
   * Compute sale totals from calculated lines.
   */
  static computeTotals(lines: SaleLineCalc[]) {
    const discountTotal = round2(lines.reduce((sum, l) => sum + l.discount, 0));
    const taxTotal = round2(lines.reduce((sum, l) => sum + l.taxAmount, 0));
    const grandTotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const subtotal = round2(grandTotal - taxTotal + discountTotal);

    return { subtotal, discountTotal, taxTotal, grandTotal };
  }

  /**
   * Validate that payments cover the grand total.
   */
  static validatePayments(
    payments: Array<{ amount: number }>,
    grandTotal: number,
  ): { valid: boolean; totalPaid: number; change: number } {
    const totalPaid = round2(payments.reduce((sum, p) => sum + p.amount, 0));
    return {
      valid: totalPaid >= grandTotal,
      totalPaid,
      change: round2(totalPaid - grandTotal),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
