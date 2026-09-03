import { z } from 'zod';

export const API_SCOPES = [
  'products:read',
  'products:write',
  'inventory:read',
  'inventory:write',
  'sales:read',
  'sales:write',
  'customers:read',
  'customers:write',
  'reports:read',
  'finance:read',
  'webhooks:manage',
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const WEBHOOK_EVENTS = [
  'order.created',
  'order.paid',
  'inventory.low_stock',
  'inventory.adjusted',
  'transfer.dispatched',
  'transfer.received',
  'workflow.approval_required',
  'customer.registered',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const createDeveloperAppSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  homepageUrl: z.string().url().optional(),
});
export type CreateDeveloperAppInput = z.infer<typeof createDeveloperAppSchema>;

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  appId: z.string().optional(),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const createWebhookSubscriptionSchema = z.object({
  url: z.string().url(),
  description: z.string().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});
export type CreateWebhookSubscriptionInput = z.infer<typeof createWebhookSubscriptionSchema>;

export interface DeveloperAppDto {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  homepageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyDto {
  id: string;
  organizationId: string;
  appId?: string | null;
  name: string;
  keyPrefix: string;
  scopes: ApiScope[];
  rateLimit: number;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface CreateApiKeyResultDto extends ApiKeyDto {
  /** Raw secret token returned ONCE upon creation. */
  secretKey: string;
}

export interface WebhookDeliveryDto {
  id: string;
  subscriptionId: string;
  event: string;
  payload: Record<string, unknown>;
  statusCode?: number | null;
  responseBody?: string | null;
  success: boolean;
  attempts: number;
  createdAt: string;
}

export interface WebhookSubscriptionDto {
  id: string;
  organizationId: string;
  url: string;
  description?: string | null;
  events: WebhookEvent[];
  isActive: boolean;
  deliveries?: WebhookDeliveryDto[];
  createdAt: string;
  updatedAt: string;
}
