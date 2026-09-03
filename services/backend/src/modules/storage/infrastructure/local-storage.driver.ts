import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageDriver, UploadUrlResult } from '../domain/storage-driver.interface';

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'uploads');
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  }

  getDriverName(): string {
    return 'LOCAL_FILESYSTEM';
  }

  private resolveSafePath(key: string): string {
    // Prevent path traversal
    const safeKey = key.replace(/(\.\.[\/\\])+/g, '').replace(/^[\\\/]+/, '');
    return path.join(this.baseDir, safeKey);
  }

  async getUploadUrl(key: string, mimeType: string, isPublic?: boolean): Promise<UploadUrlResult> {
    return {
      uploadUrl: `${this.baseUrl}/api/v1/storage/upload/${encodeURIComponent(key)}`,
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
    };
  }

  async getDownloadUrl(key: string, isPublic?: boolean): Promise<string> {
    return `${this.baseUrl}/api/v1/storage/files/${encodeURIComponent(key)}`;
  }

  async putObject(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const fullPath = this.resolveSafePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.resolveSafePath(key);
    try {
      await fs.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async objectExists(key: string): Promise<boolean> {
    const fullPath = this.resolveSafePath(key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getFilePath(key: string): Promise<string> {
    const fullPath = this.resolveSafePath(key);
    await fs.access(fullPath);
    return fullPath;
  }
}
