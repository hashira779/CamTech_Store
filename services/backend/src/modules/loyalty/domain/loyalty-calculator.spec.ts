import { LoyaltyCalculator } from './loyalty-calculator';

describe('LoyaltyCalculator (Spec §43, §44)', () => {
  describe('calculatePointsEarned', () => {
    it('earns 1 point per $1 on BRONZE tier (1.0x)', () => {
      const points = LoyaltyCalculator.calculatePointsEarned(100, 1.0, 'BRONZE');
      expect(points).toBe(100);
    });

    it('applies 1.25x multiplier on SILVER tier', () => {
      const points = LoyaltyCalculator.calculatePointsEarned(100, 1.0, 'SILVER');
      expect(points).toBe(125);
    });

    it('applies 1.5x multiplier on GOLD tier', () => {
      const points = LoyaltyCalculator.calculatePointsEarned(100, 1.0, 'GOLD');
      expect(points).toBe(150);
    });

    it('applies 2.0x multiplier on PLATINUM tier', () => {
      const points = LoyaltyCalculator.calculatePointsEarned(100, 1.0, 'PLATINUM');
      expect(points).toBe(200);
    });

    it('floors points for fractional amounts', () => {
      const points = LoyaltyCalculator.calculatePointsEarned(15.75, 1.0, 'BRONZE');
      expect(points).toBe(15);
    });
  });

  describe('calculateRedemptionDiscount', () => {
    it('converts 100 points to $1.00 at 0.01 rate', () => {
      const res = LoyaltyCalculator.calculateRedemptionDiscount(100, 0.01, 50, 200);
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(1.0);
    });

    it('rejects redemption below minimum points threshold', () => {
      const res = LoyaltyCalculator.calculateRedemptionDiscount(30, 0.01, 50, 200);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Minimum points required');
    });

    it('rejects redemption exceeding available balance', () => {
      const res = LoyaltyCalculator.calculateRedemptionDiscount(150, 0.01, 50, 100);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Insufficient points balance');
    });
  });

  describe('qualifyTier', () => {
    it('qualifies BRONZE for spend below $500', () => {
      expect(LoyaltyCalculator.qualifyTier(499)).toBe('BRONZE');
    });

    it('qualifies SILVER for spend between $500 and $1499', () => {
      expect(LoyaltyCalculator.qualifyTier(500)).toBe('SILVER');
      expect(LoyaltyCalculator.qualifyTier(1200)).toBe('SILVER');
    });

    it('qualifies GOLD for spend between $1500 and $4999', () => {
      expect(LoyaltyCalculator.qualifyTier(1500)).toBe('GOLD');
      expect(LoyaltyCalculator.qualifyTier(3500)).toBe('GOLD');
    });

    it('qualifies PLATINUM for spend of $5000 or greater', () => {
      expect(LoyaltyCalculator.qualifyTier(5000)).toBe('PLATINUM');
      expect(LoyaltyCalculator.qualifyTier(12000)).toBe('PLATINUM');
    });
  });
});
