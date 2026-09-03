import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TelegramCommandRouter } from './domain/telegram-command.router';
import type {
  BindTelegramChatInput,
  TelegramChatBindingDto,
  TelegramCommandResultDto,
} from '@mystore/contracts';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Chat Bindings ──────────────────────────────────────────────

  async listBindings(orgId: string): Promise<TelegramChatBindingDto[]> {
    const bindings = await this.prisma.telegramChatBinding.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return bindings.map((b) => ({
      id: b.id,
      organizationId: b.organizationId,
      chatId: b.chatId,
      chatTitle: b.chatTitle,
      username: b.username,
      role: b.role,
      isActive: b.isActive,
      boundByUserId: b.boundByUserId,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));
  }

  async createBinding(
    orgId: string,
    input: BindTelegramChatInput,
    userId?: string,
  ): Promise<TelegramChatBindingDto> {
    const existing = await this.prisma.telegramChatBinding.findUnique({
      where: { organizationId_chatId: { organizationId: orgId, chatId: input.chatId } },
    });
    if (existing) {
      throw new ConflictException(`Chat ID '${input.chatId}' is already bound to this organization`);
    }

    const created = await this.prisma.telegramChatBinding.create({
      data: {
        organizationId: orgId,
        chatId: input.chatId,
        chatTitle: input.chatTitle,
        username: input.username,
        role: input.role || 'OPERATOR',
        boundByUserId: userId,
        isActive: true,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: userId,
      action: 'TELEGRAM_CHAT_BOUND',
      resourceType: 'TelegramChatBinding',
      resourceId: created.id,
      metadata: { chatId: created.chatId, role: created.role },
    });

    return {
      id: created.id,
      organizationId: created.organizationId,
      chatId: created.chatId,
      chatTitle: created.chatTitle,
      username: created.username,
      role: created.role,
      isActive: created.isActive,
      boundByUserId: created.boundByUserId,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async deleteBinding(orgId: string, id: string): Promise<{ success: boolean }> {
    const binding = await this.prisma.telegramChatBinding.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!binding) {
      throw new NotFoundException(`Telegram binding ${id} not found`);
    }

    await this.prisma.telegramChatBinding.delete({ where: { id } });

    await this.audit.record({
      organizationId: orgId,
      action: 'TELEGRAM_CHAT_UNBOUND',
      resourceType: 'TelegramChatBinding',
      resourceId: id,
      metadata: { chatId: binding.chatId },
    });

    return { success: true };
  }

  // ─── Webhook & Command Dispatch ─────────────────────────────────

  async processWebhookUpdate(payload: any): Promise<TelegramCommandResultDto> {
    const message = payload?.message;
    if (!message || !message.text) {
      return { command: '', chatId: '', response: 'No message text to process', success: false };
    }

    const chatId = String(message.chat?.id);
    const text = message.text.trim();

    // 1. Locate chat binding to identify tenant
    const binding = await this.prisma.telegramChatBinding.findFirst({
      where: { chatId, isActive: true },
      include: { organization: true },
    });

    if (!binding) {
      this.logger.warn(`Unregistered Telegram chat ${chatId} attempted command: ${text}`);
      return {
        command: text,
        chatId,
        response: 'Unauthorized chat. Please bind this Telegram chat ID in your Enterprise Console.',
        success: false,
      };
    }

    const orgId = binding.organizationId;
    const orgName = binding.organization.name;

    // 2. Fetch live metrics context for this tenant
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todaySales, lowStockCount, pendingWfCount] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { organizationId: orgId, createdAt: { gte: today }, status: 'COMPLETED' },
        _sum: { grandTotal: true },
        _count: { _all: true },
      }),
      this.prisma.inventoryItem.count({
        where: { organizationId: orgId, stockOnHand: { lte: 10 } },
      }),
      this.prisma.workflowInstance.count({
        where: { organizationId: orgId, status: 'PENDING' },
      }),
    ]);

    const response = TelegramCommandRouter.handleCommand(text, {
      organizationName: orgName,
      todaySalesTotal: Number(todaySales._sum?.grandTotal || 0),
      todaySalesCount: todaySales._count?._all || 0,
      lowStockItemsCount: lowStockCount,
      pendingApprovalsCount: pendingWfCount,
    });

    // 3. Attempt Telegram delivery if bot token is present
    await this.dispatchMessageToTelegram(orgId, chatId, response);

    return {
      command: text,
      chatId,
      response,
      success: true,
    };
  }

  async sendBroadcast(orgId: string, messageText: string): Promise<{ sentCount: number }> {
    const bindings = await this.prisma.telegramChatBinding.findMany({
      where: { organizationId: orgId, isActive: true },
    });

    let sent = 0;
    for (const b of bindings) {
      await this.dispatchMessageToTelegram(orgId, b.chatId, messageText);
      sent++;
    }

    return { sentCount: sent };
  }

  private async dispatchMessageToTelegram(orgId: string, chatId: string, text: string) {
    try {
      const config = await this.prisma.notificationConfig.findUnique({
        where: { organizationId: orgId },
      });

      const token = config?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        this.logger.debug(`[Mock Telegram Send] Chat ${chatId}: ${text.substring(0, 60)}...`);
        return;
      }

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
    } catch (err) {
      this.logger.error(`Failed to dispatch message to Telegram chat ${chatId}`, err);
    }
  }
}
