import { LocationsService } from './locations.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      location: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new LocationsService(prisma as PrismaService, audit as AuditService);
  });

  describe('create', () => {
    it('creates location and logs audit', async () => {
      prisma.location.findFirst.mockResolvedValue(null);
      prisma.location.create.mockResolvedValue({
        id: 'loc-1',
        organizationId: 'org-1',
        name: 'Main Branch',
        type: 'BRANCH',
        code: 'BR-MAIN',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parent: null,
      });

      const result = await service.create(
        'org-1',
        { name: 'Main Branch', type: 'BRANCH', code: 'BR-MAIN' },
        'user-1',
      );

      expect(result.id).toBe('loc-1');
      expect(result.name).toBe('Main Branch');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOCATION_CREATED', resourceId: 'loc-1' }),
      );
    });

    it('rejects duplicate code within organization', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc-existing' });

      await expect(
        service.create(
          'org-1',
          { name: 'Store', type: 'BRANCH', code: 'DUPLICATE' },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getTree', () => {
    it('correctly assembles nested hierarchy', async () => {
      const date = new Date();
      prisma.location.findMany.mockResolvedValue([
        { id: 'co-1', organizationId: 'org-1', parentId: null, type: 'COMPANY', name: 'Company', code: 'CO-1', createdAt: date },
        { id: 'br-1', organizationId: 'org-1', parentId: 'co-1', type: 'BRANCH', name: 'Branch 1', code: 'BR-1', createdAt: date },
        { id: 'pos-1', organizationId: 'org-1', parentId: 'br-1', type: 'POS', name: 'Terminal 1', code: 'POS-1', createdAt: date },
      ]);

      const tree = await service.getTree('org-1');

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('co-1');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe('br-1');
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].id).toBe('pos-1');
    });
  });

  describe('update', () => {
    it('blocks circular hierarchy update', async () => {
      // Existing branch has parent company
      prisma.location.findFirst
        .mockResolvedValueOnce({ id: 'co-1', organizationId: 'org-1', parentId: null }) // existing
        .mockResolvedValueOnce({ id: 'br-1', organizationId: 'org-1' }); // new parent check

      // All locations in org
      prisma.location.findMany.mockResolvedValue([
        { id: 'co-1', parentId: null },
        { id: 'br-1', parentId: 'co-1' },
      ]);

      // Attempt to set branch as parent of company (cycle!)
      await expect(
        service.update('org-1', 'co-1', { parentId: 'br-1' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('blocks deletion when location has children', async () => {
      prisma.location.findFirst.mockResolvedValue({
        id: 'loc-1',
        organizationId: 'org-1',
        _count: { children: 2, users: 0, sales: 0, inventoryItems: 0 },
      });

      await expect(service.delete('org-1', 'loc-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('blocks deletion when location has sales', async () => {
      prisma.location.findFirst.mockResolvedValue({
        id: 'loc-1',
        organizationId: 'org-1',
        _count: { children: 0, users: 0, sales: 5, inventoryItems: 0 },
      });

      await expect(service.delete('org-1', 'loc-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
