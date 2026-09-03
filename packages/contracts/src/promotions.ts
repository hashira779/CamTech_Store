import { z } from 'zod';
import { CUSTOMER_TYPES } from './customers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROMOTION_TYPES = [
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'BUY_X_GET_Y',
  'ORDER_THRESHOLD',
] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const PROMOTION_SCOPES = ['ORDER', 'CATEGORY', 'PRODUCT'] as const;
export type PromotionScope = (typeof PROMOTION_SCOPES)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const createPromotionSchema = z.object({
  name: z.string().trim().min(1, 'Promotion name is required').max(150),
  code: z
    .string()
    .trim()
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric')
    .optional()
    .nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  type: z.enum(PROMOTION_TYPES),
  scope: z.enum(PROMOTION_SCOPES).optional().default('ORDER'),
  discountValue: z.number().min(0, 'Discount value cannot be negative'),
  minOrderAmount: z.number().min(0).optional().nullable(),
  maxDiscountAmount: z.number().min(0).optional().nullable(),
  buyQuantity: z.number().int().positive().optional().nullable(),
  getQuantity: z.number().int().positive().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  targetVariantIds: z.array(z.string()).optional().nullable(),
  targetCategoryIds: z.array(z.string()).optional().nullable(),
  customerTypes: z.array(z.enum(CUSTOMER_TYPES)).optional().nullable(),
});

export type CreatePromotionInput = z.input<typeof createPromotionSchema>;

export const updatePromotionSchema = createPromotionSchema.partial();
export type UpdatePromotionInput = z.input<typeof updatePromotionSchema>;

export const listPromotionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  type: z.enum(PROMOTION_TYPES).optional(),
  scope: z.enum(PROMOTION_SCOPES).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListPromotionsQuery = z.infer<typeof listPromotionsQuerySchema>;

export const evaluateCartLineSchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  categoryId: z.string().optional().nullable(),
});

export const evaluatePromotionSchema = z.object({
  promoCode: z.string().trim().min(1, 'Promo code is required'),
  lines: z.array(evaluateCartLineSchema).min(1, 'Cart cannot be empty'),
  customerId: z.string().optional().nullable(),
  customerType: z.enum(CUSTOMER_TYPES).optional().nullable(),
});

export type EvaluatePromotionInput = z.infer<typeof evaluatePromotionSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface PromotionDto {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  description: string | null;
  type: PromotionType;
  scope: PromotionScope;
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  startDate: string | null;
  endDate: string | null;
  usageLimit: number | null;
  currentUses: number;
  isActive: boolean;
  targetVariantIds: string[] | null;
  targetCategoryIds: string[] | null;
  customerTypes: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface LineDiscountBreakdown {
  productVariantId: string;
  originalLineTotal: number;
  discount: number;
  netLineTotal: number;
}

export interface PromotionEvaluationResultDto {
  valid: boolean;
  message?: string;
  promotion?: {
    id: string;
    code: string | null;
    name: string;
    type: PromotionType;
    discountValue: number;
  };
  subtotal: number;
  discountTotal: number;
  netTotal: number;
  lineDiscounts: LineDiscountBreakdown[];
}
