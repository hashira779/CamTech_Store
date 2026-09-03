import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CHANNEL_ADAPTERS,
  ChannelAdapter,
} from './domain/channel-adapter.interface';
import type {
  SendNotificationInput,
  UpdateNotificationConfigInput,
  ListNotificationsQuery,
  NotificationRecordDto,
  NotificationConfigDto,
  NotificationStatsDto,
} from '@mystore/contracts';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(CHANNEL_ADAPTERS) private readonly adapters: ChannelAdapter[],
  ) {}

  // ---------------------------------------------------------------------------
  // Tenant Notification Config
  // ---------------------------------------------------------------------------

  async getOrCreateConfig(orgId: string): Promise<NotificationConfigDto> {
    let config = await this.prisma.notificationConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!config) {
      config = await this.prisma.notificationConfig.create({
        data: {
          organizationId: orgId,
          telegramEnabled: false,
          emailEnabled: false,
          inAppEnabled: true,
        },
      });
    }

    return {
      id: config.id,
      organizationId: config.organizationId,
      telegramEnabled: config.telegramEnabled,
      telegramBotToken: config.telegramBotToken,
      telegramChatId: config.telegramChatId,
      emailEnabled: config.emailEnabled,
      emailRecipient: config.emailRecipient,
      inAppEnabled: config.inAppEnabled,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  async updateConfig(
    orgId: string,
    actorId: string,
    input: UpdateNotificationConfigInput,
  ): Promise<NotificationConfigDto> {
    await this.getOrCreateConfig(orgId);

    const updated = await this.prisma.notificationConfig.update({
      where: { organizationId: orgId },
      data: {
        telegramEnabled: input.telegramEnabled !== undefined ? input.telegramEnabled : undefined,
        telegramBotToken: input.telegramBotToken !== undefined ? input.telegramBotToken : undefined,
        telegramChatId: input.telegramChatId !== undefined ? input.telegramChatId : undefined,
        emailEnabled: input.emailEnabled !== undefined ? input.emailEnabled : undefined,
        emailRecipient: input.emailRecipient !== undefined ? input.emailRecipient : undefined,
        inAppEnabled: input.inAppEnabled !== undefined ? input.inAppEnabled : undefined,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'NOTIFICATION_CONFIG_UPDATED',
      resourceType: 'NotificationConfig',
      resourceId: updated.id,
      metadata: {
        telegramEnabled: updated.telegramEnabled,
        emailEnabled: updated.emailEnabled,
        inAppEnabled: updated.inAppEnabled,
      },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      telegramEnabled: updated.telegramEnabled,
      telegramBotToken: updated.telegramBotToken,
      telegramChatId: updated.telegramChatId,
      emailEnabled: updated.emailEnabled,
      emailRecipient: updated.emailRecipient,
      inAppEnabled: updated.inAppEnabled,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Notification Dispatch
  // ---------------------------------------------------------------------------

  async dispatch(orgId: string, input: SendNotificationInput): Promise<NotificationRecordDto> {
    const channel = input.channel || 'IN_APP';
    const type = input.type || 'GENERAL';

    // 1. Create notification record
    const record = await this.prisma.notificationRecord.create({
      data: {
        organizationId: orgId,
        userId: input.recipientUserId,
        channel,
        type,
        title: input.title,
        message: input.message,
        status: 'PENDING',
        metadata: input.metadata || {},
      },
    });

    // 2. Dispatch via channel adapter
    const adapter = this.adapters.find((a) => a.getChannel() === channel);
    let status: 'SENT' | 'FAILED' = 'SENT';
    let sentAt: Date | null = new Date();

    if (adapter) {
      const config = await this.prisma.notificationConfig.findUnique({
        where: { organizationId: orgId },
      });

      const sendResult = await adapter.send(
        {
          title: input.title,
          message: input.message,
          metadata: input.metadata,
        },
        config,
      );

      if (!sendResult.success) {
        status = 'FAILED';
        sentAt = null;
        this.logger.error(`Notification dispatch failed on ${channel}: ${sendResult.error}`);
      }
    }

    const updated = await this.prisma.notificationRecord.update({
      where: { id: record.id },
      data: { status, sentAt },
    });

    return this.mapToDto(updated);
  }

  async listNotifications(
    orgId: string,
    query?: ListNotificationsQuery,
  ): Promise<NotificationRecordDto[]> {
    const records = await this.prisma.notificationRecord.findMany({
      where: {
        organizationId: orgId,
        ...(query?.channel ? { channel: query.channel } : {}),
        ...(query?.type ? { type: query.type } : {}),
        ...(query?.isRead !== undefined ? { isRead: query.isRead } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query?.limit || 50,
    });

    return records.map((r) => this.mapToDto(r));
  }

  async markAsRead(orgId: string, id: string): Promise<NotificationRecordDto> {
    const record = await this.prisma.notificationRecord.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!record) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    const updated = await this.prisma.notificationRecord.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return this.mapToDto(updated);
  }

  async markAllAsRead(orgId: string): Promise<{ updatedCount: number }> {
    const res = await this.prisma.notificationRecord.updateMany({
      where: { organizationId: orgId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { updatedCount: res.count };
  }

  async getStats(orgId: string): Promise<NotificationStatsDto> {
    const totalDispatched = await this.prisma.notificationRecord.count({
      where: { organizationId: orgId },
    });

    const unreadInApp = await this.prisma.notificationRecord.count({
      where: { organizationId: orgId, channel: 'IN_APP', isRead: false },
    });

    const config = await this.getOrCreateConfig(orgId);
    const activeChannels: string[] = [];
    if (config.inAppEnabled) activeChannels.push('IN_APP');
    if (config.telegramEnabled) activeChannels.push('TELEGRAM');
    if (config.emailEnabled) activeChannels.push('EMAIL');

    return {
      totalDispatched,
      unreadInApp,
      activeChannels,
    };
  }

  async sendTestNotification(orgId: string, actorId: string): Promise<NotificationRecordDto> {
    return this.dispatch(orgId, {
      channel: 'TELEGRAM',
      type: 'GENERAL',
      title: 'Universal Enterprise Platform — Test Alert',
      message: `System operational test dispatched at ${new Date().toISOString()} by user ${actorId}.`,
      metadata: { test: true },
    });
  }

  private mapToDto(r: any): NotificationRecordDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      userId: r.userId,
      channel: r.channel as any,
      type: r.type as any,
      title: r.title,
      message: r.message,
      status: r.status as any,
      isRead: r.isRead,
      metadata: r.metadata,
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
