import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      serviceTicket: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ticketComment: {
        create: jest.fn(),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new TicketsService(mockPrisma, mockAudit);
  });

  describe('createTicket', () => {
    it('creates a new ticket with sequenced ticket number and audits action', async () => {
      mockPrisma.serviceTicket.count.mockResolvedValue(4);
      mockPrisma.serviceTicket.create.mockResolvedValue({
        id: 'tick_1',
        organizationId: 'org_1',
        ticketNumber: 'TICK-2026-00005',
        subject: 'Barcode scanner malfunctioning',
        description: 'Laser beam not scanning items',
        priority: 'HIGH',
        status: 'OPEN',
        category: 'HARDWARE',
        assignedToId: null,
        reporterId: 'user_1',
        customerId: null,
        resolution: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        comments: [],
      });

      const res = await service.createTicket(
        'org_1',
        {
          subject: 'Barcode scanner malfunctioning',
          description: 'Laser beam not scanning items',
          priority: 'HIGH',
        },
        'user_1',
      );

      expect(res.ticketNumber).toBe('TICK-2026-00005');
      expect(res.priority).toBe('HIGH');
      expect(res.status).toBe('OPEN');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TICKET_CREATED' }),
      );
    });
  });

  describe('updateStatus', () => {
    it('updates status and sets resolvedAt when status is RESOLVED', async () => {
      mockPrisma.serviceTicket.findFirst.mockResolvedValue({
        id: 'tick_1',
        status: 'OPEN',
        resolution: null,
      });

      mockPrisma.serviceTicket.update.mockResolvedValue({
        id: 'tick_1',
        organizationId: 'org_1',
        ticketNumber: 'TICK-2026-00005',
        subject: 'Scanner issue',
        description: 'Fixed',
        priority: 'HIGH',
        status: 'RESOLVED',
        category: 'HARDWARE',
        assignedToId: null,
        reporterId: null,
        customerId: null,
        resolution: 'Cable reconnected',
        resolvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        comments: [],
      });

      const res = await service.updateStatus(
        'org_1',
        'tick_1',
        'RESOLVED',
        'Cable reconnected',
        'tech_1',
      );

      expect(res.status).toBe('RESOLVED');
      expect(res.resolution).toBe('Cable reconnected');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TICKET_STATUS_RESOLVED' }),
      );
    });
  });
});
