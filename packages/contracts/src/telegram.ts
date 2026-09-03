import { z } from 'zod';

export const TELEGRAM_COMMANDS = [
  '/start',
  '/help',
  '/sales',
  '/stock',
  '/orders',
  '/approve',
] as const;
export type TelegramCommand = (typeof TELEGRAM_COMMANDS)[number];

export const bindTelegramChatSchema = z.object({
  chatId: z.string().min(1),
  chatTitle: z.string().optional(),
  username: z.string().optional(),
  role: z.string().optional(),
});
export type BindTelegramChatInput = z.infer<typeof bindTelegramChatSchema>;

export const sendTelegramMessageSchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
  parseMode: z.enum(['Markdown', 'HTML']).optional(),
});
export type SendTelegramMessageInput = z.infer<typeof sendTelegramMessageSchema>;

export interface TelegramChatBindingDto {
  id: string;
  organizationId: string;
  chatId: string;
  chatTitle?: string | null;
  username?: string | null;
  role: string;
  isActive: boolean;
  boundByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramCommandResultDto {
  command: string;
  chatId: string;
  response: string;
  success: boolean;
}
