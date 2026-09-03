import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  OrganizationDto,
  OrganizationSettingsDto,
  UpdateOrganizationSettingsInput,
} from '@mystore/contracts';

const DEFAULT_SETTINGS: OrganizationSettingsDto = {
  currency: 'USD',
  timezone: 'UTC',
  taxRatePct: 10,
  businessType: 'RETAIL',
  enabledModules: ['products', 'customers', 'sales', 'inventory', 'locations'],
  receiptHeader: 'Thank you for your business!',
  receiptFooter: 'Please keep your receipt for any exchanges.',
};

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getCurrent(orgId: string): Promise<OrganizationDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organization ${orgId} not found`);
    }

    return this.mapToDto(org);
  }

  async updateSettings(
    orgId: string,
    input: UpdateOrganizationSettingsInput,
    actorId: string,
  ): Promise<OrganizationDto> {
    const existing = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Organization ${orgId} not found`);
    }

    let parsedSettings: OrganizationSettingsDto = DEFAULT_SETTINGS;
    if (existing.settings) {
      try {
        parsedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(existing.settings) };
      } catch {}
    }

    const updatedSettings: OrganizationSettingsDto = {
      ...parsedSettings,
      currency: input.currency ?? existing.currency ?? parsedSettings.currency,
      timezone: input.timezone ?? existing.timezone ?? parsedSettings.timezone,
      taxRatePct: input.taxRatePct !== undefined ? input.taxRatePct : Number(existing.taxRatePct),
      businessType: input.businessType ?? (existing.businessType as any) ?? parsedSettings.businessType,
      enabledModules: input.enabledModules ?? parsedSettings.enabledModules,
      receiptHeader: input.receiptHeader !== undefined ? input.receiptHeader : parsedSettings.receiptHeader,
      receiptFooter: input.receiptFooter !== undefined ? input.receiptFooter : parsedSettings.receiptFooter,
    };

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        currency: updatedSettings.currency,
        timezone: updatedSettings.timezone,
        taxRatePct: new Decimal(updatedSettings.taxRatePct),
        businessType: updatedSettings.businessType,
        settings: JSON.stringify(updatedSettings),
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      resourceType: 'Organization',
      resourceId: orgId,
      metadata: { changes: input },
    });

    return this.mapToDto(updated);
  }

  private mapToDto(org: any): OrganizationDto {
    let settings: OrganizationSettingsDto = DEFAULT_SETTINGS;
    if (org.settings) {
      try {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(org.settings) };
      } catch {}
    }

    settings.currency = org.currency ?? settings.currency;
    settings.timezone = org.timezone ?? settings.timezone;
    settings.taxRatePct = Number(org.taxRatePct ?? settings.taxRatePct);
    settings.businessType = (org.businessType as any) ?? settings.businessType;

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      currency: org.currency,
      timezone: org.timezone,
      taxRatePct: Number(org.taxRatePct),
      businessType: org.businessType as any,
      settings,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }
}
