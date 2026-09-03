import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export const STOCK_TRANSFER_STATUSES = [
  'DRAFT',
  'REQUESTED',
  'APPROVED',
  'IN_TRANSIT',
  'RECEIVED',
  'CANCELLED',
] as const;
export type StockTransferStatus = (typeof STOCK_TRANSFER_STATUSES)[number];

export const WAREHOUSE_ZONE_TYPES = [
  'RECEIVING',
  'STORAGE',
  'PICKING',
  'SHIPPING',
  'COLD_STORAGE',
] as const;
export type WarehouseZoneType = (typeof WAREHOUSE_ZONE_TYPES)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const createWarehouseZoneSchema = z.object({
  locationId: z.string().min(1, 'Location ID is required'),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: z.enum(WAREHOUSE_ZONE_TYPES).default('STORAGE'),
});
export type CreateWarehouseZoneInput = z.infer<typeof createWarehouseZoneSchema>;

export const createWarehouseBinSchema = z.object({
  zoneId: z.string().min(1, 'Zone ID is required'),
  code: z.string().min(1).max(30),
  barcode: z.string().max(50).optional().nullable(),
  maxWeightKg: z.number().positive().optional().nullable(),
  maxVolumeCbm: z.number().positive().optional().nullable(),
});
export type CreateWarehouseBinInput = z.infer<typeof createWarehouseBinSchema>;

export const createProductBatchSchema = z.object({
  productVariantId: z.string().min(1, 'Product variant ID is required'),
  batchNumber: z.string().min(1).max(50),
  lotNumber: z.string().max(50).optional().nullable(),
  manufacturedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime({ message: 'Valid expiration date is required' }),
  quantityOnHand: z.number().nonnegative().default(0),
  costPrice: z.number().nonnegative().optional().nullable(),
});
export type CreateProductBatchInput = z.infer<typeof createProductBatchSchema>;

export const stockTransferLineInputSchema = z.object({
  productVariantId: z.string().min(1, 'Product variant ID is required'),
  requestedQty: z.number().positive('Requested quantity must be positive'),
  batchNumber: z.string().max(50).optional().nullable(),
  sourceBinId: z.string().optional().nullable(),
  destBinId: z.string().optional().nullable(),
});
export type StockTransferLineInput = z.infer<typeof stockTransferLineInputSchema>;

export const createStockTransferSchema = z.object({
  sourceLocationId: z.string().min(1, 'Source location is required'),
  destinationLocationId: z.string().min(1, 'Destination location is required'),
  notes: z.string().max(500).optional().nullable(),
  lines: z.array(stockTransferLineInputSchema).min(1, 'At least one line item is required'),
});
export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;

export const updateStockTransferStatusSchema = z.object({
  status: z.enum(STOCK_TRANSFER_STATUSES),
  notes: z.string().max(500).optional().nullable(),
});
export type UpdateStockTransferStatusInput = z.infer<typeof updateStockTransferStatusSchema>;

export const receiveStockTransferLineSchema = z.object({
  lineId: z.string().min(1),
  receivedQty: z.number().nonnegative('Received quantity cannot be negative'),
  destBinId: z.string().optional().nullable(),
});

export const receiveStockTransferSchema = z.object({
  lines: z.array(receiveStockTransferLineSchema).min(1),
  notes: z.string().max(500).optional().nullable(),
});
export type ReceiveStockTransferInput = z.infer<typeof receiveStockTransferSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface WarehouseZoneDto {
  id: string;
  locationId: string;
  code: string;
  name: string;
  type: WarehouseZoneType;
  isActive: boolean;
  createdAt: string;
  bins?: WarehouseBinDto[];
}

export interface WarehouseBinDto {
  id: string;
  zoneId: string;
  code: string;
  barcode: string | null;
  maxWeightKg: number | null;
  maxVolumeCbm: number | null;
  isActive: boolean;
}

export interface ProductBatchDto {
  id: string;
  organizationId: string;
  productVariantId: string;
  batchNumber: string;
  lotNumber: string | null;
  manufacturedAt: string | null;
  expiresAt: string;
  quantityOnHand: number;
  costPrice: number | null;
  isExpired: boolean;
}

export interface StockTransferLineDto {
  id: string;
  stockTransferId: string;
  productVariantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  requestedQty: number;
  sentQty: number;
  receivedQty: number;
  discrepancyQty: number;
  batchNumber: string | null;
  sourceBinId: string | null;
  destBinId: string | null;
}

export interface StockTransferDto {
  id: string;
  organizationId: string;
  transferNumber: string;
  sourceLocationId: string;
  sourceLocationName?: string;
  destinationLocationId: string;
  destinationLocationName?: string;
  status: StockTransferStatus;
  requestedById: string;
  requestedByName?: string;
  approvedById: string | null;
  shippedById: string | null;
  receivedById: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: StockTransferLineDto[];
}
