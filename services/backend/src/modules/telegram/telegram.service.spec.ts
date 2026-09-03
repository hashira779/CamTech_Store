import { TelegramService } from './telegram.service';
import { ConflictException } from '@nestjs/common';

describe('TelegramService', () => {
  let service: TelegramService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      telegramChatBinding: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      sale: {
        aggregate: jest.fn(),
      },
      inventoryItem: {
        count: jest.fn(),
      },
      workflowInstance: {
        count: jest.fn(),
      },
      notificationConfig: {
        findUnique: jest.fn(),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new TelegramService(mockPrisma, mockAudit);
  });

  describe('createBinding', () => {
    it('throws ConflictException if chatId is already registered for tenant', async () => {
      mockPrisma.telegramChatBinding.findUnique.mockResolvedValue({ id: 'b_1' });

      await expect(
        service.createBinding('org_1', { chatId: '12345678' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates chat binding and records audit log', async () => {
      mockPrisma.telegramChatBinding.findUnique.mockResolvedValue(null);
      mockPrisma.telegramChatBinding.create.mockResolvedValue({
        id: 'b_new',
        organizationId: 'org_1',
        chatId: '12345678',
        chatTitle: 'Operations Desk',
        username: 'op_user',
        role: 'OPERATOR',
        boundByUserId: 'user_1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createBinding(
        'org_1',
        { chatId: '12345678', chatTitle: 'Operations Desk' },
        'user_1',
      );

      expect(res.chatId).toBe('12345678');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TELEGRAM_CHAT_BOUND' }),
      );
    });
  });

  describe('processWebhookUpdate', () => {
    it('executes /sales command for registered tenant chat', async () => {
      mockPrisma.telegramChatBinding.findFirst.mockResolvedValue({
        id: 'b_1',
        organizationId: 'org_1',
        chatId: '987654',
        organization: { name: 'Main Store' },
      });

      mockPrisma.sale.aggregate.mockResolvedValue({
        _sum: { grandTotal: 850 },
        _count: { _all: 12 },
      });
      mockPrisma.inventoryItem.count.mockResolvedValue(4);
      mockPrisma.workflowInstance.count.mockResolvedValue(1);
      mockPrisma.notificationConfig.findUnique.mockResolvedValue(null);

      const result = await service.processWebhookUpdate({
        message: {
          chat: { id: 987654 },
          text: '/sales',
        },
      });

      expect(result.success).toBe(true);
      expect(result.response).toContain('Sales Performance Summary');
      expect(result.response).toContain('$850.00');
    });

    it('rejects unregistered chats with helpful notification', async () => {
      mockPrisma.telegramChatBinding.findFirst.mockResolvedValue(null);

      const result = await service.processWebhookUpdate({
        message: {
          chat: { id: 111111 },
          text: '/sales',
        },
      });

      expect(result.success).toBe(false);
      expect(result.response).toContain('Unauthorized chat');
    });
  });
});
