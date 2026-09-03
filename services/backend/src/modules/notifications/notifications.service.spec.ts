import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ChannelAdapter } from './domain/channel-adapter.interface';

describe('NotificationsService (Spec §61)', () => {
  let service: NotificationsService;
  let prisma: any;
  let audit: any;
  let telegramAdapter: jest.Mocked<ChannelAdapter>;
  let inAppAdapter: jest.Mocked<ChannelAdapter>;

  beforeEach(() => {
    prisma = {
      notificationRecord: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      notificationConfig: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    telegramAdapter = {
      getChannel: jest.fn().mockReturnValue('TELEGRAM'),
      send: jest.fn().mockResolvedValue({ success: true }),
    };
    inAppAdapter = {
      getChannel: jest.fn().mockReturnValue('IN_APP'),
      send: jest.fn().mockResolvedValue({ success: true }),
    };

    service = new NotificationsService(
      prisma as PrismaService,
      audit as AuditService,
      [telegramAdapter, inAppAdapter],
    );
  });

  describe('dispatch', () => {
    it('dispatches to telegram adapter and marks SENT', async () => {
      prisma.notificationRecord.create.mockResolvedValue({
        id: 'notif-1',
        organizationId: 'org-1',
        channel: 'TELEGRAM',
        type: 'ORDER_CREATED',
        title: 'New Sale Completed',
        message: 'Order #S-0001 for $45.00',
        status: 'PENDING',
        metadata: {},
        isRead: false,
        createdAt: new Date(),
      });

      prisma.notificationConfig.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        telegramEnabled: true,
        telegramBotToken: 'token123',
        telegramChatId: 'chat123',
      });

      prisma.notificationRecord.update.mockResolvedValue({
        id: 'notif-1',
        organizationId: 'org-1',
        channel: 'TELEGRAM',
        type: 'ORDER_CREATED',
        title: 'New Sale Completed',
        message: 'Order #S-0001 for $45.00',
        status: 'SENT',
        metadata: {},
        isRead: false,
        sentAt: new Date(),
        createdAt: new Date(),
      });

      const res = await service.dispatch('org-1', {
        channel: 'TELEGRAM',
        type: 'ORDER_CREATED',
        title: 'New Sale Completed',
        message: 'Order #S-0001 for $45.00',
      });

      expect(res.status).toBe('SENT');
      expect(telegramAdapter.send).toHaveBeenCalled();
      expect(prisma.notificationRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
      );
    });
  });

  describe('markAsRead', () => {
    it('updates isRead to true and sets readAt', async () => {
      prisma.notificationRecord.findFirst.mockResolvedValue({
        id: 'notif-1',
        organizationId: 'org-1',
        isRead: false,
      });

      prisma.notificationRecord.update.mockResolvedValue({
        id: 'notif-1',
        organizationId: 'org-1',
        channel: 'IN_APP',
        type: 'GENERAL',
        title: 'Test',
        message: 'Hello',
        status: 'SENT',
        isRead: true,
        readAt: new Date(),
        createdAt: new Date(),
      });

      const res = await service.markAsRead('org-1', 'notif-1');
      expect(res.isRead).toBe(true);
      expect(prisma.notificationRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isRead: true }) }),
      );
    });
  });
});
