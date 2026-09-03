import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants & Enums
// ---------------------------------------------------------------------------

export const DOCUMENT_ENTITY_TYPES = [
  'PRODUCT',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'CUSTOMER',
  'SALE_RECEIPT',
  'OTHER',
] as const;
export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const createUploadIntentSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().refine((val) => ALLOWED_MIME_TYPES.includes(val as any), {
    message: 'Unsupported file MIME type',
  }),
  byteSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES, {
    message: 'File size exceeds maximum limit of 25MB',
  }),
  entityType: z.enum(DOCUMENT_ENTITY_TYPES).optional(),
  entityId: z.string().max(100).optional(),
  isPublic: z.boolean().optional().default(false),
});

export type CreateUploadIntentInput = z.input<typeof createUploadIntentSchema>;

export const confirmUploadSchema = z.object({
  documentId: z.string().min(1),
});

export type ConfirmUploadInput = z.input<typeof confirmUploadSchema>;

export const listDocumentsQuerySchema = z.object({
  entityType: z.enum(DOCUMENT_ENTITY_TYPES).optional(),
  entityId: z.string().optional(),
});

export type ListDocumentsQuery = z.input<typeof listDocumentsQuerySchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface UploadIntentDto {
  documentId: string;
  key: string;
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
}

export interface DocumentRecordDto {
  id: string;
  organizationId: string;
  bucket: string;
  key: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  isPublic: boolean;
  status: 'PENDING' | 'ACTIVE' | 'DELETED';
  entityType?: DocumentEntityType | null;
  entityId?: string | null;
  url: string;
  uploadedById?: string | null;
  createdAt: string;
}

export interface StorageStatsDto {
  totalFiles: number;
  totalBytes: number;
  activeStorageDriver: string;
}
