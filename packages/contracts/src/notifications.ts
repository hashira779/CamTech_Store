import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants & Enums
// ---------------------------------------------------------------------------

export const NOTIFICATION_CHANNELS = ['IN_APP', 'TELEGRAM', 'EMAIL', 'SMS'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPES = [
  'LOW_STOCK_ALERT',
  'ORDER_CREATED',
  'TRANSFER_DISPATCHED',
  'PO_APPROVED',
  'PAYMENT_RECEIVED',
  'GENERAL',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'FAILED', 'READ'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const sendNotificationSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS).default('IN_APP'),
  type: z.enum(NOTIFICATION_TYPES).default('GENERAL'),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  recipientUserId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type SendNotificationInput = z.input<typeof sendNotificationSchema>;

export const updateNotificationConfigSchema = z.object({
  telegramEnabled: z.boolean().optional(),
  telegramBotToken: z.string().max(255).optional(),
  telegramChatId: z.string().max(100).optional(),
  emailEnabled: z.boolean().optional(),
  emailRecipient: z.string().email().optional().or(z.literal('')),
  inAppEnabled: z.boolean().optional(),
});

export type UpdateNotificationConfigInput = z.input<typeof updateNotificationConfigSchema>;

export const listNotificationsQuerySchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  isRead: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListNotificationsQuery = z.input<typeof listNotificationsQuerySchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface NotificationRecordDto {
  id: string;
  organizationId: string;
  userId?: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  isRead: boolean;
  metadata?: Record<string, any> | null;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationConfigDto {
  id: string;
  organizationId: string;
  telegramEnabled: boolean;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  emailEnabled: boolean;
  emailRecipient?: string | null;
  inAppEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationStatsDto {
  totalDispatched: number;
  unreadInApp: number;
  activeChannels: string[];
}
