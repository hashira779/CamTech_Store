import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BUSINESS_TYPES = [
  'RETAIL',
  'WHOLESALE',
  'SUPERMARKET',
  'CAFE',
  'RESTAURANT',
  'FUEL_STATION',
  'PHARMACY',
  'ELECTRONICS',
  'FASHION',
  'AUTOMOTIVE',
  'WAREHOUSE',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const organizationSettingsSchema = z.object({
  currency: z.string().trim().min(3).max(5).default('USD'),
  timezone: z.string().trim().min(1).max(50).default('UTC'),
  taxRatePct: z.number().min(0).max(100).default(10),
  businessType: z.enum(BUSINESS_TYPES).default('RETAIL'),
  enabledModules: z.array(z.string()).default([
    'products',
    'customers',
    'sales',
    'inventory',
    'locations',
  ]),
  receiptHeader: z.string().trim().max(200).optional().nullable(),
  receiptFooter: z.string().trim().max(200).optional().nullable(),
});

export type OrganizationSettingsDto = z.infer<typeof organizationSettingsSchema>;

export const updateOrganizationSettingsSchema = organizationSettingsSchema.partial();
export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  taxRatePct: number;
  businessType: BusinessType;
  settings: OrganizationSettingsDto;
  createdAt: string;
  updatedAt: string;
}
