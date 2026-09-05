import { z } from 'zod';

export const TELEGRAM_COMMANDS = [
  '/start',
  '/help',
  '/sales',
  '/stock',
  '/orders',
  '/approve',
  '/status',
] as const;
export type TelegramCommand = (typeof TELEGRAM_COMMANDS)[number];

export const TELEGRAM_BOT_PURPOSES = [
  'SALES',
  'DELIVERY',
  'INVENTORY',
  'FINANCE',
  'SUPPORT',
  'GENERAL',
] as const;
export type TelegramBotPurpose = (typeof TELEGRAM_BOT_PURPOSES)[number];

export const TELEGRAM_BOT_STATUSES = [
  'CONNECTED',
  'DISCONNECTED',
  'ERROR',
] as const;
export type TelegramBotStatus = (typeof TELEGRAM_BOT_STATUSES)[number];

export interface TelegramBotDto {
  id: string;
  organizationId: string;
  name: string;
  botUsername?: string | null;
  tokenPreview: string;
  description?: string | null;
  purpose: TelegramBotPurpose;
  defaultChatId?: string | null;
  isActive: boolean;
  isPrimary: boolean;
  status: TelegramBotStatus;
  lastTestedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTelegramBotInput {
  name: string;
  botToken: string;
  botUsername?: string;
  description?: string;
  purpose?: TelegramBotPurpose;
  defaultChatId?: string;
  isActive?: boolean;
  isPrimary?: boolean;
}

export interface UpdateTelegramBotInput {
  name?: string;
  botToken?: string;
  botUsername?: string;
  description?: string;
  purpose?: TelegramBotPurpose;
  defaultChatId?: string;
  isActive?: boolean;
  isPrimary?: boolean;
}

export interface TelegramBotTestResult {
  success: boolean;
  status: string;
  botUsername?: string;
  botName?: string;
  canJoinGroups?: boolean;
  canReadAllGroupMessages?: boolean;
  lastTestedAt?: string;
}

export const bindTelegramChatSchema = z.object({
  chatId: z.string().min(1),
  chatTitle: z.string().optional(),
  username: z.string().optional(),
  botId: z.string().optional(),
  bindingType: z.enum(['USER', 'GROUP']).optional(),
  role: z.string().optional(),
});
export type BindTelegramChatInput = z.infer<typeof bindTelegramChatSchema>;

export interface UpdateTelegramBindingInput {
  chatTitle?: string;
  username?: string;
  botId?: string;
  bindingType?: 'USER' | 'GROUP';
  role?: string;
  isActive?: boolean;
}

export const sendTelegramMessageSchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
  botId: z.string().optional(),
  parseMode: z.enum(['Markdown', 'HTML']).optional(),
});
export type SendTelegramMessageInput = z.infer<typeof sendTelegramMessageSchema>;

export interface TelegramChatBindingDto {
  id: string;
  organizationId: string;
  botId?: string | null;
  chatId: string;
  chatTitle?: string | null;
  username?: string | null;
  bindingType?: 'USER' | 'GROUP';
  role: string;
  isActive: boolean;
  boundByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TelegramCommandResultDto {
  command: string;
  chatId: string;
  response: string;
  success: boolean;
}
