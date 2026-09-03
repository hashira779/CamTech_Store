import { JournalEntryEntity } from './journal-entry.entity';

describe('JournalEntryEntity', () => {
  it('creates a balanced journal entry successfully', () => {
    const entry = JournalEntryEntity.create({
      organizationId: 'org_test_1',
      entryNumber: 'JE-2026-000001',
      postingDate: new Date('2026-09-01'),
      sourceType: 'MANUAL',
      description: 'Initial capital investment',
      lines: [
        { accountId: 'acc_cash', debit: 5000, credit: 0, memo: 'Owner cash deposit' },
        { accountId: 'acc_equity', debit: 0, credit: 5000, memo: 'Capital contribution' },
      ],
    });

    expect(entry.entryNumber).toBe('JE-2026-000001');
    expect(entry.status).toBe('DRAFT');
    expect(entry.totalDebit).toBe(5000);
    expect(entry.totalCredit).toBe(5000);
  });

  it('strictly throws error when debits and credits do not balance', () => {
    expect(() => {
      JournalEntryEntity.create({
        organizationId: 'org_test_1',
        entryNumber: 'JE-2026-000002',
        postingDate: new Date(),
        sourceType: 'MANUAL',
        description: 'Unbalanced purchase',
        lines: [
          { accountId: 'acc_expense', debit: 120, credit: 0 },
          { accountId: 'acc_cash', debit: 0, credit: 100 },
        ],
      });
    }).toThrow(/Journal entry is unbalanced/i);
  });

  it('rejects entries with fewer than 2 lines', () => {
    expect(() => {
      JournalEntryEntity.create({
        organizationId: 'org_test_1',
        entryNumber: 'JE-2026-000003',
        postingDate: new Date(),
        sourceType: 'MANUAL',
        description: 'Single leg entry',
        lines: [{ accountId: 'acc_cash', debit: 100, credit: 0 }],
      });
    }).toThrow(/must contain at least two line items/i);
  });

  it('rejects lines having both debit and credit amounts', () => {
    expect(() => {
      JournalEntryEntity.create({
        organizationId: 'org_test_1',
        entryNumber: 'JE-2026-000004',
        postingDate: new Date(),
        sourceType: 'MANUAL',
        description: 'Confused line',
        lines: [
          { accountId: 'acc_cash', debit: 100, credit: 50 },
          { accountId: 'acc_equity', debit: 0, credit: 50 },
        ],
      });
    }).toThrow(/cannot contain both debit and credit/i);
  });

  it('manages state transition from DRAFT to POSTED to VOID', () => {
    const entry = JournalEntryEntity.create({
      organizationId: 'org_test_1',
      entryNumber: 'JE-2026-000005',
      postingDate: new Date(),
      sourceType: 'MANUAL',
      description: 'Test posting flow',
      lines: [
        { accountId: 'acc_bank', debit: 250, credit: 0 },
        { accountId: 'acc_sales', debit: 0, credit: 250 },
      ],
    });

    expect(entry.status).toBe('DRAFT');
    entry.post();
    expect(entry.status).toBe('POSTED');

    // Cannot re-post
    expect(() => entry.post()).toThrow(/already posted/i);

    entry.void();
    expect(entry.status).toBe('VOID');

    // Cannot post a voided entry
    expect(() => entry.post()).toThrow(/Cannot post a voided/i);
  });
});
