import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { STORAGE_DRIVER, StorageDriver } from './domain/storage-driver.interface';
import { LocalStorageDriver } from './infrastructure/local-storage.driver';
import type {
  CreateUploadIntentInput,
  ConfirmUploadInput,
  ListDocumentsQuery,
  UploadIntentDto,
  DocumentRecordDto,
  StorageStatsDto,
} from '@mystore/contracts';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
  ) {}

  async createUploadIntent(
    orgId: string,
    actorId: string,
    input: CreateUploadIntentInput,
  ): Promise<UploadIntentDto> {
    const fileExt = input.filename.includes('.')
      ? `.${input.filename.split('.').pop()}`
      : '';
    const randomHex = crypto.randomBytes(8).toString('hex');
    const entityPrefix = input.entityType ? `${input.entityType.toLowerCase()}/` : '';
    const key = `${orgId}/${entityPrefix}${Date.now()}_${randomHex}${fileExt}`;

    const uploadIntent = await this.driver.getUploadUrl(key, input.mimeType, input.isPublic);

    const doc = await this.prisma.documentRecord.create({
      data: {
        organizationId: orgId,
        bucket: 'default',
        key,
        filename: input.filename,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        isPublic: input.isPublic ?? false,
        status: 'PENDING',
        entityType: input.entityType,
        entityId: input.entityId,
        uploadedById: actorId,
      },
    });

    return {
      documentId: doc.id,
      key,
      uploadUrl: uploadIntent.uploadUrl,
      method: uploadIntent.method,
      headers: uploadIntent.headers,
    };
  }

  async confirmUpload(
    orgId: string,
    actorId: string,
    input: ConfirmUploadInput,
  ): Promise<DocumentRecordDto> {
    const doc = await this.prisma.documentRecord.findFirst({
      where: { id: input.documentId, organizationId: orgId },
    });

    if (!doc) {
      throw new NotFoundException(`Document ${input.documentId} not found`);
    }

    const exists = await this.driver.objectExists(doc.key);
    if (!exists) {
      throw new BadRequestException('Object not found in storage. Please complete the file upload first.');
    }

    const updated = await this.prisma.documentRecord.update({
      where: { id: doc.id },
      data: { status: 'ACTIVE' },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'DocumentRecord',
      resourceId: updated.id,
      metadata: {
        filename: updated.filename,
        byteSize: updated.byteSize,
        entityType: updated.entityType,
        entityId: updated.entityId,
      },
    });

    const downloadUrl = await this.driver.getDownloadUrl(updated.key, updated.isPublic);
    return this.mapToDto(updated, downloadUrl);
  }

  async saveDirectFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.driver.putObject(key, buffer, mimeType);
  }

  async getFilePathForServing(key: string): Promise<string> {
    if (this.driver instanceof LocalStorageDriver) {
      return this.driver.getFilePath(key);
    }
    throw new BadRequestException('Local serving not supported on remote storage driver');
  }

  async listDocuments(
    orgId: string,
    query?: ListDocumentsQuery,
  ): Promise<DocumentRecordDto[]> {
    const docs = await this.prisma.documentRecord.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE',
        ...(query?.entityType ? { entityType: query.entityType } : {}),
        ...(query?.entityId ? { entityId: query.entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return Promise.all(
      docs.map(async (doc) => {
        const url = await this.driver.getDownloadUrl(doc.key, doc.isPublic);
        return this.mapToDto(doc, url);
      }),
    );
  }

  async deleteDocument(orgId: string, actorId: string, id: string): Promise<{ success: boolean }> {
    const doc = await this.prisma.documentRecord.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    await this.driver.deleteObject(doc.key);

    await this.prisma.documentRecord.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'DOCUMENT_DELETED',
      resourceType: 'DocumentRecord',
      resourceId: id,
      metadata: { filename: doc.filename, key: doc.key },
    });

    return { success: true };
  }

  async getStats(orgId: string): Promise<StorageStatsDto> {
    const docs = await this.prisma.documentRecord.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
      select: { byteSize: true },
    });

    const totalFiles = docs.length;
    const totalBytes = docs.reduce((sum, d) => sum + d.byteSize, 0);

    return {
      totalFiles,
      totalBytes,
      activeStorageDriver: this.driver.getDriverName(),
    };
  }

  private mapToDto(doc: any, url: string): DocumentRecordDto {
    return {
      id: doc.id,
      organizationId: doc.organizationId,
      bucket: doc.bucket,
      key: doc.key,
      filename: doc.filename,
      mimeType: doc.mimeType,
      byteSize: doc.byteSize,
      isPublic: doc.isPublic,
      status: doc.status as any,
      entityType: doc.entityType as any,
      entityId: doc.entityId,
      url,
      uploadedById: doc.uploadedById,
      createdAt: doc.createdAt.toISOString(),
    };
  }
}
