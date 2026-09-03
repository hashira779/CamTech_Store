import { FinanceService } from './finance.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('FinanceService', () => {
  let service: FinanceService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      account: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      journalEntry: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      journalLineItem: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new FinanceService(mockPrisma, mockAudit);
  });

  describe('ensureStandardChartOfAccounts', () => {
    it('seeds standard GAAP accounts when tenant has 0 accounts', async () => {
      mockPrisma.account.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(async (fns: any) => Promise.all(fns));

      await service.ensureStandardChartOfAccounts('org_1');

      expect(mockPrisma.account.count).toHaveBeenCalledWith({ where: { organizationId: 'org_1' } });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('skips seeding when accounts already exist', async () => {
      mockPrisma.account.count.mockResolvedValue(11);

      await service.ensureStandardChartOfAccounts('org_1');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('createAccount', () => {
    it('throws ConflictException on duplicate account code', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({ id: 'acc_1', code: '1010' });

      await expect(
        service.createAccount('org_1', {
          code: '1010',
          name: 'Cash',
          type: 'ASSET',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates new account and audits action', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue({
        id: 'acc_new',
        organizationId: 'org_1',
        code: '1050',
        name: 'Petty Cash',
        type: 'ASSET',
        currency: 'USD',
        description: 'Store petty cash',
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createAccount('org_1', {
        code: '1050',
        name: 'Petty Cash',
        type: 'ASSET',
      });

      expect(res.code).toBe('1050');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FINANCE_ACCOUNT_CREATED' }),
      );
    });
  });

  describe('createJournalEntry', () => {
    it('rejects unbalanced journal entries at application level', async () => {
      mockPrisma.account.count.mockResolvedValue(11);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await expect(
        service.createJournalEntry('org_1', {
          description: 'Bad entry',
          lines: [
            { accountId: 'acc_1', debit: 100, credit: 0 },
            { accountId: 'acc_2', debit: 0, credit: 80 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists balanced journal entry in DRAFT state', async () => {
      mockPrisma.account.count.mockResolvedValue(11);
      mockPrisma.journalEntry.count.mockResolvedValue(5);

      const fakeCreated = {
        id: 'je_1',
        organizationId: 'org_1',
        entryNumber: 'JE-2026-000006',
        postingDate: new Date(),
        sourceType: 'MANUAL',
        sourceId: null,
        description: 'Valid rent payment',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [
          { id: 'l1', journalEntryId: 'je_1', accountId: 'acc_expense', debit: 500, credit: 0 },
          { id: 'l2', journalEntryId: 'je_1', accountId: 'acc_cash', debit: 0, credit: 500 },
        ],
      };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          journalEntry: {
            create: jest.fn().mockResolvedValue({ id: 'je_1' }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(fakeCreated),
          },
          journalLineItem: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const entry = await service.createJournalEntry('org_1', {
        description: 'Valid rent payment',
        lines: [
          { accountId: 'acc_expense', debit: 500, credit: 0 },
          { accountId: 'acc_cash', debit: 0, credit: 500 },
        ],
      });

      expect(entry.entryNumber).toBe('JE-2026-000006');
      expect(entry.totalDebit).toBe(500);
      expect(entry.totalCredit).toBe(500);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FINANCE_JOURNAL_ENTRY_CREATED' }),
      );
    });
  });

  describe('postJournalEntry', () => {
    it('transitions entry to POSTED', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        id: 'je_1',
        status: 'DRAFT',
        entryNumber: 'JE-2026-000001',
        lines: [],
      });

      mockPrisma.journalEntry.update.mockResolvedValue({
        id: 'je_1',
        status: 'POSTED',
        entryNumber: 'JE-2026-000001',
        postingDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [],
      });

      const posted = await service.postJournalEntry('org_1', 'je_1');

      expect(posted.status).toBe('POSTED');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FINANCE_JOURNAL_ENTRY_POSTED' }),
      );
    });

    it('rejects posting an already posted entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        id: 'je_1',
        status: 'POSTED',
      });

      await expect(service.postJournalEntry('org_1', 'je_1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
