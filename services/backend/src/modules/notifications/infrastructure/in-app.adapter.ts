import { Injectable } from '@nestjs/common';
import { ChannelAdapter, ChannelSendResult, SendChannelPayload } from '../domain/channel-adapter.interface';
import type { NotificationChannel } from '@mystore/contracts';

@Injectable()
export class InAppAdapter implements ChannelAdapter {
  getChannel(): NotificationChannel {
    return 'IN_APP';
  }

  async send(payload: SendChannelPayload): Promise<ChannelSendResult> {
    // In-App notifications are automatically persisted to notification_records
    return { success: true };
  }
}
