import { StorageService } from './storage.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageDriver } from './domain/storage-driver.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StorageService (Spec §62)', () => {
  let service: StorageService;
  let prisma: any;
  let audit: any;
  let driver: jest.Mocked<StorageDriver>;

  beforeEach(() => {
    prisma = {
      documentRecord: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    driver = {
      getUploadUrl: jest.fn(),
      getDownloadUrl: jest.fn(),
      putObject: jest.fn(),
      deleteObject: jest.fn(),
      objectExists: jest.fn(),
      getDriverName: jest.fn().mockReturnValue('LOCAL_FILESYSTEM'),
    };
    service = new StorageService(prisma as PrismaService, audit as AuditService, driver);
  });

  describe('createUploadIntent', () => {
    it('creates PENDING document record and returns upload URL', async () => {
      driver.getUploadUrl.mockResolvedValue({
        uploadUrl: 'http://localhost:4000/api/v1/storage/upload/key123',
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
      });

      prisma.documentRecord.create.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        key: 'org-1/product/123.png',
        filename: 'test.png',
        mimeType: 'image/png',
        byteSize: 5000,
        isPublic: false,
        status: 'PENDING',
      });

      const res = await service.createUploadIntent('org-1', 'user-1', {
        filename: 'test.png',
        mimeType: 'image/png',
        byteSize: 5000,
        entityType: 'PRODUCT',
        entityId: 'prod-123',
      });

      expect(res.documentId).toBe('doc-1');
      expect(res.uploadUrl).toContain('/api/v1/storage/upload/');
      expect(prisma.documentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            filename: 'test.png',
          }),
        }),
      );
    });
  });

  describe('confirmUpload', () => {
    it('activates document if object exists in storage', async () => {
      prisma.documentRecord.findFirst.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        key: 'org-1/test.png',
        filename: 'test.png',
        mimeType: 'image/png',
        byteSize: 5000,
        isPublic: false,
        status: 'PENDING',
        createdAt: new Date(),
      });

      driver.objectExists.mockResolvedValue(true);
      driver.getDownloadUrl.mockResolvedValue('http://localhost:4000/api/v1/storage/files/key123');

      prisma.documentRecord.update.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        key: 'org-1/test.png',
        filename: 'test.png',
        mimeType: 'image/png',
        byteSize: 5000,
        isPublic: false,
        status: 'ACTIVE',
        createdAt: new Date(),
      });

      const res = await service.confirmUpload('org-1', 'user-1', { documentId: 'doc-1' });
      expect(res.status).toBe('ACTIVE');
      expect(prisma.documentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ACTIVE' } }),
      );
    });

    it('rejects confirmation if object was not uploaded', async () => {
      prisma.documentRecord.findFirst.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        key: 'org-1/test.png',
        status: 'PENDING',
      });

      driver.objectExists.mockResolvedValue(false);

      await expect(
        service.confirmUpload('org-1', 'user-1', { documentId: 'doc-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteDocument', () => {
    it('calls driver to delete object and marks record DELETED', async () => {
      prisma.documentRecord.findFirst.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        key: 'org-1/test.png',
        filename: 'test.png',
      });

      const res = await service.deleteDocument('org-1', 'user-1', 'doc-1');
      expect(res.success).toBe(true);
      expect(driver.deleteObject).toHaveBeenCalledWith('org-1/test.png');
      expect(prisma.documentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'DELETED' } }),
      );
    });
  });
});
