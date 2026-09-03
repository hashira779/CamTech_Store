import { HrService } from './hr.service';
import { ConflictException } from '@nestjs/common';

describe('HrService', () => {
  let service: HrService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      department: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      employee: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      leaveRequest: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payrollRun: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      payrollItem: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new HrService(mockPrisma, mockAudit);
  });

  describe('createDepartment', () => {
    it('throws ConflictException on duplicate department name', async () => {
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'd1', name: 'Logistics' });

      await expect(
        service.createDepartment('org_1', { name: 'Logistics' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates new department successfully', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(null);
      mockPrisma.department.create.mockResolvedValue({
        id: 'd_new',
        organizationId: 'org_1',
        name: 'Finance & Accounts',
        code: 'FIN',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createDepartment('org_1', { name: 'Finance & Accounts', code: 'FIN' });
      expect(res.name).toBe('Finance & Accounts');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'HR_DEPARTMENT_CREATED' }),
      );
    });
  });

  describe('createPayrollRun', () => {
    it('calculates batch payroll for active employees', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 'emp_1', baseSalary: 2500 },
        { id: 'emp_2', baseSalary: 3500 },
      ]);

      const fakeRun = {
        id: 'pr_1',
        organizationId: 'org_1',
        name: 'Sep 2026 Payroll',
        periodStart: new Date('2026-09-01'),
        periodEnd: new Date('2026-09-30'),
        status: 'CALCULATED',
        totalGross: 6000,
        totalNet: 6000,
        journalEntryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          { id: 'pi_1', payrollRunId: 'pr_1', employeeId: 'emp_1', baseSalary: 2500, allowances: 0, deductions: 0, netPay: 2500, employee: { firstName: 'Alice', lastName: 'A' } },
          { id: 'pi_2', payrollRunId: 'pr_1', employeeId: 'emp_2', baseSalary: 3500, allowances: 0, deductions: 0, netPay: 3500, employee: { firstName: 'Bob', lastName: 'B' } },
        ],
      };

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          payrollRun: {
            create: jest.fn().mockResolvedValue({ id: 'pr_1' }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(fakeRun),
          },
          payrollItem: { create: jest.fn() },
        };
        return cb(tx);
      });

      const res = await service.createPayrollRun('org_1', {
        name: 'Sep 2026 Payroll',
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-30T23:59:59Z',
      });

      expect(res.id).toBe('pr_1');
      expect(res.totalGross).toBe(6000);
      expect(res.items).toHaveLength(2);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'HR_PAYROLL_CALCULATED' }),
      );
    });
  });
});
