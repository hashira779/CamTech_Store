import { z } from 'zod';

export const CURRENCIES = ['USD', 'KHR', 'THB', 'CNY', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const UNITS = ['piece', 'box', 'pack', 'carton', 'kg', 'g', 'liter', 'ml'] as const;
export type Unit = (typeof UNITS)[number];

export const PRODUCT_TYPES = ['PHYSICAL', 'DIGITAL', 'SERVICE', 'BUNDLE', 'RAW_MATERIAL'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/** Money must be non-negative and sane (≤ 2 dp). */
const money = z
  .number()
  .nonnegative()
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
    message: 'Amount must have at most 2 decimal places',
  });

export const createProductVariantSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, 'SKU may contain letters, numbers, . _ -'),
  name: z.string().trim().max(100).optional().nullable(),
  barcode: z.string().trim().max(64).optional().nullable(),
  unit: z.enum(UNITS).default('piece'),
  currency: z.enum(CURRENCIES).default('USD'),
  costPrice: money,
  sellPrice: money,
  taxRatePct: z.number().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z.enum(PRODUCT_TYPES).default('PHYSICAL'),
  categoryId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  variants: z.array(createProductVariantSchema).min(1, 'At least one variant is required'),
});

export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export interface ProductVariantDto {
  id: string;
  productId: string;
  sku: string;
  name: string | null;
  barcode: string | null;
  unit: Unit;
  currency: Currency;
  costPrice: number;
  sellPrice: number;
  taxRatePct: number;
  marginPct: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDto {
  id: string;
  organizationId: string;
  categoryId: string | null;
  brandId: string | null;
  type: ProductType;
  name: string;
  description: string | null;
  isActive: boolean;
  variants: ProductVariantDto[];
  createdAt: string;
  updatedAt: string;
}
