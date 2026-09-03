import { z } from 'zod';
import { CUSTOMER_TYPES } from './customers';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const createPriceListSchema = z.object({
  name: z.string().trim().min(1, 'Price list name is required').max(150),
  code: z
    .string()
    .trim()
    .min(1, 'Price list code is required')
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric'),
  description: z.string().trim().max(1000).optional().nullable(),
  currency: z.string().trim().min(1).default('USD'),
  isDefault: z.boolean().optional().default(false),
  customerType: z.enum(CUSTOMER_TYPES).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type CreatePriceListInput = z.input<typeof createPriceListSchema>;

export const updatePriceListSchema = createPriceListSchema.partial();
export type UpdatePriceListInput = z.input<typeof updatePriceListSchema>;

export const listPriceListsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListPriceListsQuery = z.infer<typeof listPriceListsQuerySchema>;

export const setPriceListItemSchema = z.object({
  productVariantId: z.string().min(1, 'Product variant ID is required'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  minQuantity: z.number().min(1, 'Minimum quantity must be at least 1').default(1),
});

export type SetPriceListItemInput = z.input<typeof setPriceListItemSchema>;

export const resolvePriceLineSchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.number().positive(),
});

export const resolvePricesQuerySchema = z.object({
  customerId: z.string().optional().nullable(),
  priceListId: z.string().optional().nullable(),
  lines: z.array(resolvePriceLineSchema).min(1),
});

export type ResolvePricesInput = z.infer<typeof resolvePricesQuerySchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface PriceListItemDto {
  id: string;
  priceListId: string;
  productVariantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  baseSellPrice: number;
  costPrice: number;
  unitPrice: number;
  minQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceListDto {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  currency: string;
  isDefault: boolean;
  customerType: string | null;
  isActive: boolean;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
  items?: PriceListItemDto[];
}

export interface ResolvedPriceLineDto {
  productVariantId: string;
  quantity: number;
  basePrice: number;
  resolvedUnitPrice: number;
  savingsPerUnit: number;
  priceSource: 'PRICE_LIST' | 'VOLUME_TIER' | 'BASE_PRICE';
  tierMinQty?: number;
  priceListName?: string;
}

export interface ResolvedPricesResultDto {
  priceListApplied: {
    id: string;
    name: string;
    code: string;
  } | null;
  lines: ResolvedPriceLineDto[];
}
