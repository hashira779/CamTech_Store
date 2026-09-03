import { PromotionEvaluator, type PromotionDomainData } from './promotion-evaluator';

describe('PromotionEvaluator', () => {
  const basePromo: PromotionDomainData = {
    id: 'promo-1',
    name: 'Summer Sale 20%',
    code: 'SUMMER20',
    type: 'PERCENTAGE',
    scope: 'ORDER',
    discountValue: 20,
    minOrderAmount: null,
    maxDiscountAmount: null,
    buyQuantity: null,
    getQuantity: null,
    startDate: null,
    endDate: null,
    usageLimit: null,
    currentUses: 0,
    isActive: true,
    targetVariantIds: null,
    targetCategoryIds: null,
    customerTypes: null,
  };

  const sampleCart = [
    { productVariantId: 'v1', quantity: 2, unitPrice: 50 }, // $100
    { productVariantId: 'v2', quantity: 1, unitPrice: 50 }, // $50
  ]; // subtotal = $150

  it('correctly calculates 20% discount across order', () => {
    const res = PromotionEvaluator.evaluate(basePromo, sampleCart);

    expect(res.valid).toBe(true);
    expect(res.subtotal).toBe(150);
    expect(res.discountTotal).toBe(30); // 20% of 150
    expect(res.netTotal).toBe(120);
    expect(res.lineDiscounts[0].discount).toBe(20); // 20% of 100
    expect(res.lineDiscounts[1].discount).toBe(10); // 20% of 50
  });

  it('enforces maxDiscountAmount cap', () => {
    const cappedPromo: PromotionDomainData = {
      ...basePromo,
      discountValue: 50, // 50% of 150 is $75
      maxDiscountAmount: 25, // cap at $25
    };

    const res = PromotionEvaluator.evaluate(cappedPromo, sampleCart);
    expect(res.valid).toBe(true);
    expect(res.discountTotal).toBe(25);
    expect(res.netTotal).toBe(125);
  });

  it('rejects if subtotal is below minOrderAmount', () => {
    const thresholdPromo: PromotionDomainData = {
      ...basePromo,
      minOrderAmount: 200,
    };

    const res = PromotionEvaluator.evaluate(thresholdPromo, sampleCart);
    expect(res.valid).toBe(false);
    expect(res.message).toContain('below the required minimum');
    expect(res.discountTotal).toBe(0);
  });

  it('rejects if promotion is inactive or expired', () => {
    const inactivePromo: PromotionDomainData = { ...basePromo, isActive: false };
    expect(PromotionEvaluator.evaluate(inactivePromo, sampleCart).valid).toBe(false);

    const expiredPromo: PromotionDomainData = {
      ...basePromo,
      endDate: new Date(Date.now() - 10000),
    };
    expect(PromotionEvaluator.evaluate(expiredPromo, sampleCart).valid).toBe(false);
  });

  it('rejects if usage limit is reached', () => {
    const maxedPromo: PromotionDomainData = {
      ...basePromo,
      usageLimit: 10,
      currentUses: 10,
    };

    const res = PromotionEvaluator.evaluate(maxedPromo, sampleCart);
    expect(res.valid).toBe(false);
    expect(res.message).toContain('maximum redemption limit');
  });

  it('evaluates BUY_X_GET_Y promotion correctly (Buy 2 Get 1 Free)', () => {
    const bogoPromo: PromotionDomainData = {
      ...basePromo,
      type: 'BUY_X_GET_Y',
      buyQuantity: 2,
      getQuantity: 1,
      targetVariantIds: ['v1'],
      scope: 'PRODUCT',
    };

    // Cart with 3 of v1 (Buy 2 Get 1 Free) -> 1 free ($50 discount)
    const cart = [{ productVariantId: 'v1', quantity: 3, unitPrice: 50 }];

    const res = PromotionEvaluator.evaluate(bogoPromo, cart);
    expect(res.valid).toBe(true);
    expect(res.subtotal).toBe(150);
    expect(res.discountTotal).toBe(50);
    expect(res.netTotal).toBe(100);
  });

  it('evaluates FIXED_AMOUNT discount distributed proportionally', () => {
    const fixedPromo: PromotionDomainData = {
      ...basePromo,
      type: 'FIXED_AMOUNT',
      discountValue: 15,
    };

    const res = PromotionEvaluator.evaluate(fixedPromo, sampleCart);
    expect(res.valid).toBe(true);
    expect(res.discountTotal).toBe(15);
    expect(res.netTotal).toBe(135);
  });

  it('clamps a >100% PERCENTAGE promo so the order total never goes negative', () => {
    // A misconfigured 200% discount must not make the store owe the customer.
    const overPromo: PromotionDomainData = { ...basePromo, discountValue: 200 };

    const res = PromotionEvaluator.evaluate(overPromo, sampleCart);
    expect(res.valid).toBe(true);
    expect(res.discountTotal).toBe(150); // capped at subtotal, not $300
    expect(res.netTotal).toBe(0); // floored at zero, never negative
    expect(res.lineDiscounts.every((l) => l.netLineTotal >= 0)).toBe(true);
    expect(res.lineDiscounts.every((l) => l.discount <= l.originalLineTotal)).toBe(true);
  });
});
