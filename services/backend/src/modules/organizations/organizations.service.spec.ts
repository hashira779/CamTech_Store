import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new OrganizationsService(prisma as PrismaService, audit as AuditService);
  });

  describe('getCurrent', () => {
    it('returns organization profile and parsed settings', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Acme Retail Group',
        slug: 'acme-retail',
        currency: 'USD',
        timezone: 'Asia/Bangkok',
        taxRatePct: new Decimal(10),
        businessType: 'RETAIL',
        settings: JSON.stringify({
          currency: 'USD',
          timezone: 'Asia/Bangkok',
          taxRatePct: 10,
          businessType: 'RETAIL',
          enabledModules: ['products', 'sales'],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.getCurrent('org-1');
      expect(res.id).toBe('org-1');
      expect(res.name).toBe('Acme Retail Group');
      expect(res.currency).toBe('USD');
      expect(res.settings.enabledModules).toEqual(['products', 'sales']);
    });

    it('throws NotFoundException if organization not found', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.getCurrent('org-not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSettings', () => {
    it('updates organization settings and records audit log', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Acme Retail Group',
        slug: 'acme-retail',
        currency: 'USD',
        timezone: 'UTC',
        taxRatePct: new Decimal(10),
        businessType: 'RETAIL',
        settings: null,
      });

      prisma.organization.update.mockResolvedValue({
        id: 'org-1',
        name: 'Acme Retail Group',
        slug: 'acme-retail',
        currency: 'KHR',
        timezone: 'Asia/Phnom_Penh',
        taxRatePct: new Decimal(7),
        businessType: 'CAFE',
        settings: JSON.stringify({
          currency: 'KHR',
          timezone: 'Asia/Phnom_Penh',
          taxRatePct: 7,
          businessType: 'CAFE',
          enabledModules: ['products', 'sales', 'inventory'],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.updateSettings(
        'org-1',
        {
          currency: 'KHR',
          timezone: 'Asia/Phnom_Penh',
          taxRatePct: 7,
          businessType: 'CAFE',
        },
        'user-admin',
      );

      expect(res.currency).toBe('KHR');
      expect(res.businessType).toBe('CAFE');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ORGANIZATION_SETTINGS_UPDATED', resourceId: 'org-1' }),
      );
    });
  });
});
