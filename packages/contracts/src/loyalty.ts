import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export const LOYALTY_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];

export const LOYALTY_TX_TYPES = ['EARN', 'REDEEM', 'ADJUST', 'EXPIRE'] as const;
export type LoyaltyTxType = (typeof LOYALTY_TX_TYPES)[number];

export const STORE_CREDIT_TX_TYPES = ['CREDIT', 'DEBIT', 'REFUND', 'ADJUST'] as const;
export type StoreCreditTxType = (typeof STORE_CREDIT_TX_TYPES)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const updateLoyaltyConfigSchema = z.object({
  earnRate: z.number().positive().optional(), // Points earned per $1 spent
  redeemRate: z.number().positive().optional(), // Dollar value per 1 point
  minPointsRedeem: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateLoyaltyConfigInput = z.input<typeof updateLoyaltyConfigSchema>;

export const adjustLoyaltyPointsSchema = z.object({
  customerId: z.string().min(1),
  points: z.number().int(), // positive or negative
  notes: z.string().max(500).optional(),
});

export type AdjustLoyaltyPointsInput = z.input<typeof adjustLoyaltyPointsSchema>;

export const adjustStoreCreditSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number(), // positive (credit) or negative (debit)
  notes: z.string().max(500).optional(),
});

export type AdjustStoreCreditInput = z.input<typeof adjustStoreCreditSchema>;

export const redeemLoyaltyPointsSchema = z.object({
  customerId: z.string().min(1),
  points: z.number().int().positive(),
});

export type RedeemLoyaltyPointsInput = z.input<typeof redeemLoyaltyPointsSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface LoyaltyProgramConfigDto {
  id: string;
  organizationId: string;
  earnRate: number;
  redeemRate: number;
  minPointsRedeem: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyTransactionDto {
  id: string;
  organizationId: string;
  customerId: string;
  type: LoyaltyTxType;
  points: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  actorId?: string | null;
  createdAt: string;
}

export interface StoreCreditTransactionDto {
  id: string;
  organizationId: string;
  customerId: string;
  type: StoreCreditTxType;
  amount: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  actorId?: string | null;
  createdAt: string;
}

export interface CustomerLoyaltyProfileDto {
  customerId: string;
  customerName: string;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  tierMultiplier: number;
  storeCredit: number;
  recentLoyaltyTransactions: LoyaltyTransactionDto[];
  recentCreditTransactions: StoreCreditTransactionDto[];
}
