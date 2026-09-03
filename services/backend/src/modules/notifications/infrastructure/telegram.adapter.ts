import { Injectable, Logger } from '@nestjs/common';
import { ChannelAdapter, ChannelSendResult, SendChannelPayload } from '../domain/channel-adapter.interface';
import type { NotificationChannel } from '@mystore/contracts';

@Injectable()
export class TelegramAdapter implements ChannelAdapter {
  private readonly logger = new Logger(TelegramAdapter.name);

  getChannel(): NotificationChannel {
    return 'TELEGRAM';
  }

  async send(payload: SendChannelPayload, channelConfig?: any): Promise<ChannelSendResult> {
    const botToken = channelConfig?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = payload.recipient || channelConfig?.telegramChatId || process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      this.logger.warn(
        `[Telegram Mock] Missing bot token or chat ID. Simulating delivery for: "${payload.title}"`,
      );
      return { success: true };
    }

    try {
      const text = `*${payload.title}*\n\n${payload.message}`;
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`Telegram API error: ${errText}`);
        return { success: false, error: errText };
      }

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Failed to send Telegram message: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
