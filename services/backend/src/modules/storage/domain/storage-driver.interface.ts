export interface UploadUrlResult {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
}

export interface StorageDriver {
  getUploadUrl(key: string, mimeType: string, isPublic?: boolean): Promise<UploadUrlResult>;
  getDownloadUrl(key: string, isPublic?: boolean): Promise<string>;
  putObject(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  getDriverName(): string;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
