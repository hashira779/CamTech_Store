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

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  currency?: string;
  timezone?: string;
  taxRatePct?: number;
  businessType?: BusinessType;
  ownerEmail?: string;
  ownerName?: string;
  ownerPassword?: string;
}

/** INDIVIDUAL → KHQR tag 29; MERCHANT → tag 30 with the merchant ID + acquiring bank from the Bakong app. */
export type BakongAccountType = 'INDIVIDUAL' | 'MERCHANT';

export interface BakongConfigDto {
  accountId: string;
  accountType?: BakongAccountType;
  merchantName: string;
  merchantId?: string | null;
  acquiringBank?: string | null;
  merchantCity?: string;
  currency?: string;
  enabled: boolean;
  isConfigured: boolean;
  /** When NBC last confirmed the account exists. NBC returns no owner name. */
  accountVerifiedAt?: string | null;
  /** @deprecated NBC check_bakong_account returns no owner name; always null. */
  accountName?: string | null;
  /** Secrets are write-only; only these masks (e.g. "bk_live_••••••••1a2b") are ever returned. */
  hasToken?: boolean;
  tokenMasked?: string | null;
  hasWebhookSecret?: boolean;
  webhookSecretMasked?: string | null;
}

export interface UpdateBakongConfigInput {
  /** Exactly as shown in the Bakong app, e.g. "coffee_lab@aclb". */
  accountId: string;
  accountType?: BakongAccountType;
  /** Required; max 25 English characters (KHQR tag 59). */
  merchantName: string;
  /** Required for MERCHANT accounts. */
  merchantId?: string;
  /** Required for MERCHANT accounts, e.g. "ACLEDA Bank". */
  acquiringBank?: string;
  /** Max 15 characters (KHQR tag 60). */
  merchantCity?: string;
  currency?: string;
  enabled?: boolean;
  /** Omit, or send the mask back, to keep the stored secret; send a new value to replace it. */
  token?: string;
  webhookSecret?: string;
}

export interface VerifyBakongAccountInput {
  accountId: string;
  token?: string;
}

export interface VerifyBakongAccountResultDto {
  valid: boolean;
  accountId: string;
  accountName?: string | null;
  currency?: string | null;
  errorCode?: number | null;
  reason?: 'TOKEN' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNREACHABLE' | 'FAILED' | null;
  message: string;
}

export interface OrganizationChannelsDto {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  storefrontUrl: string;
  telegramMiniAppUrl: string;
  apiBaseUrl: string;
  publicCatalogEndpoint: string;
  checkoutEndpoint: string;
  telegramBotAuthEndpoint: string;
  paywayConfigured: boolean;
  paywayMerchantId?: string | null;
  bakongConfigured?: boolean;
  bakongAccountId?: string | null;
  bakongEnabled?: boolean;
}

