import { DeveloperService } from './developer.service';
import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGenerator } from './domain/api-key-generator';

describe('DeveloperService', () => {
  let service: DeveloperService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      developerApp: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      apiKey: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      webhookSubscription: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      webhookDelivery: {
        create: jest.fn(),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new DeveloperService(mockPrisma, mockAudit);
  });

  describe('createApiKey', () => {
    it('creates an API key, hashes the key for persistence, and returns secretKey', async () => {
      mockPrisma.apiKey.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'key_1',
          organizationId: args.data.organizationId,
          appId: null,
          name: args.data.name,
          keyPrefix: args.data.keyPrefix,
          keyHash: args.data.keyHash,
          scopes: args.data.scopes,
          rateLimit: args.data.rateLimit,
          expiresAt: null,
          createdAt: new Date(),
        }),
      );

      const res = await service.createApiKey('org_1', {
        name: 'ERP Sync Key',
        scopes: ['products:read', 'sales:read'],
      });

      expect(res.name).toBe('ERP Sync Key');
      expect(res.secretKey).toMatch(/^sk_live_/);
      expect(res.keyPrefix).toBe(res.secretKey.substring(0, 14));
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'API_KEY_CREATED' }),
      );
    });
  });

  describe('verifyApiKey', () => {
    it('verifies valid active API key using sha256 hash', async () => {
      const generated = ApiKeyGenerator.generate('test');
      const rawKey = generated.rawKey;
      const hash = generated.hash;

      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key_1',
        organizationId: 'org_1',
        keyHash: hash,
        scopes: ['products:read'],
        expiresAt: null,
        revokedAt: null,
      });

      mockPrisma.apiKey.update.mockResolvedValue({});

      const verified = await service.verifyApiKey(rawKey);
      expect(verified.organizationId).toBe('org_1');
      expect(verified.scopes).toContain('products:read');
    });

    it('throws UnauthorizedException when key is revoked', async () => {
      const generated = ApiKeyGenerator.generate('test');
      const rawKey = generated.rawKey;
      const hash = generated.hash;

      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key_revoked',
        organizationId: 'org_1',
        keyHash: hash,
        scopes: ['products:read'],
        revokedAt: new Date(),
      });

      await expect(service.verifyApiKey(rawKey)).rejects.toThrow(UnauthorizedException);
    });
  });
});
