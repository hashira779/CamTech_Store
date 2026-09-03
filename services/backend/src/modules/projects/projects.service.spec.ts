import { ProjectsService } from './projects.service';
import { ConflictException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      projectTask: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      timesheetEntry: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new ProjectsService(mockPrisma, mockAudit);
  });

  describe('createProject', () => {
    it('throws ConflictException on duplicate project code', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'prj_1', code: 'PRJ-01' });

      await expect(
        service.createProject('org_1', { code: 'PRJ-01', name: 'Project 1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates project with budget and records audit log', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      mockPrisma.project.create.mockResolvedValue({
        id: 'prj_new',
        organizationId: 'org_1',
        code: 'PRJ-02',
        name: 'Store Renovation',
        description: null,
        budget: 50000,
        status: 'ACTIVE',
        startDate: null,
        endDate: null,
        tasks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createProject('org_1', {
        code: 'PRJ-02',
        name: 'Store Renovation',
        budget: 50000,
        status: 'ACTIVE',
      });

      expect(res.code).toBe('PRJ-02');
      expect(res.budget).toBe(50000);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PROJECT_CREATED' }),
      );
    });
  });

  describe('logTimesheet', () => {
    it('logs hours and updates task actualHours', async () => {
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: 'task_1',
        actualHours: 10,
      });

      const fakeEntry = {
        id: 'ts_1',
        taskId: 'task_1',
        workerId: 'worker_1',
        hours: 4.5,
        date: new Date(),
        notes: 'Testing setup',
        createdAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          timesheetEntry: { create: jest.fn().mockResolvedValue(fakeEntry) },
          projectTask: { update: jest.fn() },
        };
        return cb(tx);
      });

      const res = await service.logTimesheet(
        'org_1',
        'task_1',
        { hours: 4.5, notes: 'Testing setup' } as any,
        'worker_1',
      );

      expect(res.hours).toBe(4.5);
      expect(res.workerId).toBe('worker_1');
    });
  });
});
