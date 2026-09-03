import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STOCK_MOVEMENT_TYPES = [
  'SALE', 'SALE_VOID', 'SALE_REFUND',
  'PURCHASE_RECEIPT',
  'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
  'TRANSFER_IN', 'TRANSFER_OUT',
  'DAMAGE', 'EXPIRED', 'COUNT',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

export const adjustInventorySchema = z.object({
  productVariantId: z.string().min(1),
  locationId: z.string().min(1),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRED', 'COUNT']),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;

export const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  locationId: z.string().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  search: z.string().trim().max(200).optional(),
});

export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface InventoryItemDto {
  id: string;
  organizationId: string;
  productVariantId: string;
  locationId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  stockOnHand: number;
  reservedQty: number;
  availableQty: number; // computed: stockOnHand - reservedQty
  minimumStock: number;
  maximumStock: number | null;
  reorderPoint: number | null;
  isLowStock: boolean; // computed: stockOnHand <= reorderPoint
  locationName: string;
  updatedAt: string;
}

export interface StockMovementDto {
  id: string;
  type: StockMovementType;
  quantity: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  userId: string;
  createdAt: string;
}
