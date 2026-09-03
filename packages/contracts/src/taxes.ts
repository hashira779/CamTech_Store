import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export const TAX_MODES = ['INCLUSIVE', 'EXCLUSIVE'] as const;
export type TaxMode = (typeof TAX_MODES)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const createTaxRateSchema = z.object({
  code: z
    .string()
    .min(1, 'Tax code is required')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric, hyphens or underscores'),
  name: z.string().min(1, 'Tax name is required').max(100),
  ratePct: z
    .number()
    .min(0, 'Rate percentage cannot be negative')
    .max(100, 'Rate percentage cannot exceed 100%'),
  isInclusive: z.boolean().optional().default(false),
  isCompound: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export type CreateTaxRateInput = z.input<typeof createTaxRateSchema>;

export const updateTaxRateSchema = createTaxRateSchema.partial().omit({ code: true });
export type UpdateTaxRateInput = z.input<typeof updateTaxRateSchema>;

export const taxCalculationLineSchema = z.object({
  unitPrice: z.number().nonnegative(),
  quantity: z.number().positive(),
  discount: z.number().nonnegative().optional().default(0),
  taxRatePct: z.number().min(0).max(100).optional().default(0),
  isInclusive: z.boolean().optional().default(false),
  isCompound: z.boolean().optional().default(false),
});

export const calculateTaxesInputSchema = z.object({
  lines: z.array(taxCalculationLineSchema).min(1),
});

export type CalculateTaxesInput = z.input<typeof calculateTaxesInputSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface TaxRateDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  ratePct: number;
  isInclusive: boolean;
  isCompound: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxLineCalculationDto {
  grossAmount: number;
  netSubtotal: number;
  taxAmount: number;
  effectiveRatePct: number;
  isInclusive: boolean;
}

export interface TaxCalculationResultDto {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: TaxLineCalculationDto[];
}
