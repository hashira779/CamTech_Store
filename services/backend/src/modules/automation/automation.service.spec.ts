import { AutomationService } from './automation.service';

describe('AutomationService', () => {
  let service: AutomationService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockTelegram: any;

  beforeEach(() => {
    mockPrisma = {
      automationFlow: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      flowExecution: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      serviceTicket: {
        create: jest.fn(),
      },
      notificationRecord: {
        create: jest.fn(),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    mockTelegram = {
      sendBroadcast: jest.fn().mockResolvedValue({ sentCount: 2 }),
    };

    service = new AutomationService(mockPrisma, mockAudit, mockTelegram);
  });

  describe('createFlow', () => {
    it('creates flow definition and writes audit log', async () => {
      mockPrisma.automationFlow.create.mockResolvedValue({
        id: 'flow_1',
        organizationId: 'org_1',
        name: 'Order Low Stock Alert',
        description: 'Auto flow',
        isActive: true,
        triggerType: 'EVENT',
        nodes: [],
        edges: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createFlow('org_1', {
        name: 'Order Low Stock Alert',
        description: 'Auto flow',
        triggerType: 'EVENT',
        nodes: [],
        edges: [],
      });

      expect(res.id).toBe('flow_1');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FLOW_CREATED' }),
      );
    });
  });

  describe('executeFlow', () => {
    it('executes flow, evaluates trace, creates execution record, and dispatches telegram action', async () => {
      mockPrisma.automationFlow.findFirst.mockResolvedValue({
        id: 'flow_1',
        organizationId: 'org_1',
        name: 'VIP Customer Notifier',
        isActive: true,
        triggerType: 'MANUAL',
        nodes: [
          {
            id: 'n1',
            name: 'Manual Start',
            type: 'TRIGGER',
            subtype: 'manual_trigger',
            parameters: {},
            position: { x: 0, y: 0 },
          },
          {
            id: 'n2',
            name: 'Broadcast to Telegram',
            type: 'ACTION',
            subtype: 'send_telegram',
            parameters: { text: 'VIP Customer {{trigger.customer}} entered' },
            position: { x: 200, y: 0 },
          },
        ],
        edges: [{ id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2' }],
      });

      mockPrisma.flowExecution.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'exec_1',
          organizationId: args.data.organizationId,
          flowId: args.data.flowId,
          triggerType: args.data.triggerType,
          status: args.data.status,
          triggerPayload: args.data.triggerPayload,
          executionTrace: args.data.executionTrace,
          startedAt: args.data.startedAt,
          finishedAt: args.data.finishedAt,
        }),
      );

      const execution = await service.executeFlow('org_1', 'flow_1', { customer: 'John Doe' });

      expect(execution.status).toBe('SUCCESS');
      expect(execution.executionTrace).toHaveLength(2);
      expect(mockTelegram.sendBroadcast).toHaveBeenCalledWith('org_1', 'VIP Customer John Doe entered');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FLOW_EXECUTED' }),
      );
    });
  });
});
