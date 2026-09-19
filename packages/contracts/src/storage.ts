import { z } from 'zod';

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

export interface CreateUploadIntentInput {
  filename: string;
  mimeType: string;
  byteSize: number;
  entityType?: DocumentEntityType;
  entityId?: string;
  isPublic?: boolean;
  providerId?: string;
}

export interface ConfirmUploadInput {
  objectId: string;
}

export interface ListDocumentsQuery {
  entityType?: DocumentEntityType;
  entityId?: string;
}

export interface StorageProviderDto {
  id: string;
  name: string;
  type: string;
  status: string;
  isDefault: boolean;
  createdAt: string;
}

export interface StorageObjectDto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl?: string;
  status: string;
  createdAt: string;
  providerId: string;
  entityType?: DocumentEntityType | null;
  entityId?: string | null;
}

export interface StoragePolicyDto {
  id: string;
  name: string;
  entityType: string;
  providerId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface StoragePolicyCreateInput {
  name: string;
  entityType: string;
  providerId: string;
}

export interface UploadIntentDto {
  uploadUrl: string;
  method: string;
  headers?: Record<string, string>;
  objectId: string;
  expiresIn: number;
}

export interface StorageStatsDto {
  totalFiles: number;
  totalBytes: number;
  activeStorageDriver: string;
}

// For backwards compatibility until frontend is fully refactored
export type DocumentRecordDto = StorageObjectDto;
