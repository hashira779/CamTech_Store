import type { LoyaltyTier } from '@mystore/contracts';

export interface LoyaltyRedemptionResult {
  valid: boolean;
  discountAmount: number;
  error?: string;
}

export class LoyaltyCalculator {
  public static readonly TIER_MULTIPLIERS: Record<LoyaltyTier, number> = {
    BRONZE: 1.0,
    SILVER: 1.25,
    GOLD: 1.5,
    PLATINUM: 2.0,
  };

  public static readonly TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
    PLATINUM: 5000,
    GOLD: 1500,
    SILVER: 500,
    BRONZE: 0,
  };

  /**
   * Calculates points earned from eligible spend with tier multiplier.
   */
  public static calculatePointsEarned(
    eligibleAmount: number,
    earnRate: number = 1.0,
    tier: LoyaltyTier = 'BRONZE',
  ): number {
    if (eligibleAmount <= 0 || earnRate <= 0) return 0;
    const multiplier = this.TIER_MULTIPLIERS[tier] ?? 1.0;
    return Math.floor(eligibleAmount * earnRate * multiplier);
  }

  /**
   * Evaluates points redemption for direct discount.
   */
  public static calculateRedemptionDiscount(
    pointsToRedeem: number,
    redeemRate: number = 0.01,
    minPointsRedeem: number = 50,
    currentBalance: number = 0,
  ): LoyaltyRedemptionResult {
    if (pointsToRedeem <= 0) {
      return { valid: false, discountAmount: 0, error: 'Points to redeem must be greater than zero' };
    }
    if (pointsToRedeem < minPointsRedeem) {
      return {
        valid: false,
        discountAmount: 0,
        error: `Minimum points required to redeem is ${minPointsRedeem} points`,
      };
    }
    if (pointsToRedeem > currentBalance) {
      return {
        valid: false,
        discountAmount: 0,
        error: `Insufficient points balance (${currentBalance} points available)`,
      };
    }

    const discountAmount = Math.round(pointsToRedeem * redeemRate * 100) / 100;
    return {
      valid: true,
      discountAmount,
    };
  }

  /**
   * Determines customer loyalty tier based on cumulative annual/lifetime spend.
   */
  public static qualifyTier(lifetimeSpend: number): LoyaltyTier {
    if (lifetimeSpend >= this.TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
    if (lifetimeSpend >= this.TIER_THRESHOLDS.GOLD) return 'GOLD';
    if (lifetimeSpend >= this.TIER_THRESHOLDS.SILVER) return 'SILVER';
    return 'BRONZE';
  }
}
