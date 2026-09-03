import type { NotificationChannel } from '@mystore/contracts';

export interface SendChannelPayload {
  recipient?: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface ChannelSendResult {
  success: boolean;
  error?: string;
}

export interface ChannelAdapter {
  getChannel(): NotificationChannel;
  send(payload: SendChannelPayload, channelConfig?: any): Promise<ChannelSendResult>;
}

export const CHANNEL_ADAPTERS = Symbol('CHANNEL_ADAPTERS');
