/**
 * Pure domain fiscal tax calculator supporting Inclusive, Exclusive, and Compound taxes (Spec §25, §26).
 */

export interface TaxLineInput {
  unitPrice: number;
  quantity: number;
  discount?: number;
  taxRatePct?: number; // e.g. 10 for 10%
  isInclusive?: boolean;
  isCompound?: boolean;
}

export interface TaxLineResult {
  grossAmount: number;
  netSubtotal: number;
  taxAmount: number;
  effectiveRatePct: number;
  isInclusive: boolean;
}

export interface CartTaxResult {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: TaxLineResult[];
}

export class TaxCalculator {
  /**
   * Rounds a currency number to specified decimal places (default 2).
   */
  public static round(val: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round((val + Number.EPSILON) * factor) / factor;
  }

  /**
   * Calculates tax breakdown for a single item line.
   */
  public static calculateLine(input: TaxLineInput): TaxLineResult {
    const qty = Math.max(0, input.quantity);
    const unitPrice = Math.max(0, input.unitPrice);
    const discount = Math.max(0, input.discount || 0);
    const ratePct = input.taxRatePct ?? 0;
    const rateDecimal = Math.max(0, ratePct) / 100;
    const isInclusive = Boolean(input.isInclusive);

    const baseCharge = Math.max(0, unitPrice * qty - discount);

    if (rateDecimal === 0 || baseCharge === 0) {
      return {
        grossAmount: this.round(baseCharge),
        netSubtotal: this.round(baseCharge),
        taxAmount: 0,
        effectiveRatePct: 0,
        isInclusive,
      };
    }

    if (isInclusive) {
      // In inclusive mode: baseCharge is the Gross Amount
      // Net = Gross / (1 + Rate)
      // Tax = Gross - Net
      const netSubtotal = baseCharge / (1 + rateDecimal);
      const taxAmount = baseCharge - netSubtotal;

      return {
        grossAmount: this.round(baseCharge),
        netSubtotal: this.round(netSubtotal),
        taxAmount: this.round(taxAmount),
        effectiveRatePct: ratePct,
        isInclusive: true,
      };
    } else {
      // In exclusive mode: baseCharge is the Net Subtotal
      // Tax = Net * Rate
      // Gross = Net + Tax
      const taxAmount = baseCharge * rateDecimal;
      const grossAmount = baseCharge + taxAmount;

      return {
        grossAmount: this.round(grossAmount),
        netSubtotal: this.round(baseCharge),
        taxAmount: this.round(taxAmount),
        effectiveRatePct: ratePct,
        isInclusive: false,
      };
    }
  }

  /**
   * Aggregates multiple lines into a comprehensive fiscal cart result.
   */
  public static calculateCart(lines: TaxLineInput[]): CartTaxResult {
    const evaluatedLines = lines.map((line) => this.calculateLine(line));

    const subtotal = evaluatedLines.reduce((acc, l) => acc + l.netSubtotal, 0);
    const taxTotal = evaluatedLines.reduce((acc, l) => acc + l.taxAmount, 0);
    const grandTotal = evaluatedLines.reduce((acc, l) => acc + l.grossAmount, 0);

    return {
      subtotal: this.round(subtotal),
      taxTotal: this.round(taxTotal),
      grandTotal: this.round(grandTotal),
      lines: evaluatedLines,
    };
  }
}
