import { z } from 'zod';
import { createSaleSchema } from './sales';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const offlineSalePayloadSchema = createSaleSchema.extend({
  localId: z.string().min(1, 'localId is required'),
  clientCreatedAt: z.string().datetime().or(z.string().min(1)),
});

export type OfflineSalePayload = z.infer<typeof offlineSalePayloadSchema>;

export const syncBatchRequestSchema = z.object({
  sales: z.array(offlineSalePayloadSchema).min(1, 'At least one sale is required for sync batch'),
});

export type SyncBatchRequest = z.infer<typeof syncBatchRequestSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export type OfflineSaleSyncStatus = 'SYNCED' | 'FAILED' | 'DUPLICATE';

export interface OfflineSaleResultDto {
  localId: string;
  status: OfflineSaleSyncStatus;
  saleId?: string;
  saleNumber?: string;
  grandTotal?: number;
  error?: string;
}

export interface SyncBatchResponseDto {
  syncedCount: number;
  failedCount: number;
  results: OfflineSaleResultDto[];
}
