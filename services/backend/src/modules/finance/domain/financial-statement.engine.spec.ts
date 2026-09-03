import { FinancialStatementEngine } from './financial-statement.engine';

describe('FinancialStatementEngine', () => {
  const mockAccounts = [
    { id: '1010', code: '1010', name: 'Cash on Hand', type: 'ASSET' as const, currency: 'USD' },
    { id: '1020', code: '1020', name: 'Bank Operating', type: 'ASSET' as const, currency: 'USD' },
    { id: '1300', code: '1300', name: 'Inventory Asset', type: 'ASSET' as const, currency: 'USD' },
    { id: '2010', code: '2010', name: 'Accounts Payable', type: 'LIABILITY' as const, currency: 'USD' },
    { id: '2050', code: '2050', name: 'Sales Tax Payable', type: 'LIABILITY' as const, currency: 'USD' },
    { id: '3010', code: '3010', name: 'Owner Equity', type: 'EQUITY' as const, currency: 'USD' },
    { id: '4010', code: '4010', name: 'Sales Revenue', type: 'REVENUE' as const, currency: 'USD' },
    { id: '5010', code: '5010', name: 'Cost of Goods Sold', type: 'EXPENSE' as const, currency: 'USD' },
    { id: '5020', code: '5020', name: 'Store Rent Expense', type: 'EXPENSE' as const, currency: 'USD' },
  ];

  it('generates a balanced Trial Balance verifying debits equal credits', () => {
    const mockLines = [
      // Owner invests $10,000 cash
      { accountId: '1010', debit: 10000, credit: 0 },
      { accountId: '3010', debit: 0, credit: 10000 },
      // Buy $3,000 inventory on credit
      { accountId: '1300', debit: 3000, credit: 0 },
      { accountId: '2010', debit: 0, credit: 3000 },
      // Sale of $2,000 cash (tax $200), cost was $800
      { accountId: '1010', debit: 2200, credit: 0 },
      { accountId: '4010', debit: 0, credit: 2000 },
      { accountId: '2050', debit: 0, credit: 200 },
      { accountId: '5010', debit: 800, credit: 0 },
      { accountId: '1300', debit: 0, credit: 800 },
    ];

    const tb = FinancialStatementEngine.generateTrialBalance(mockAccounts, mockLines);

    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebits).toBe(16000);
    expect(tb.totalCredits).toBe(16000);

    // Cash net balance: 10000 + 2200 = 12200
    const cash = tb.items.find((i) => i.code === '1010');
    expect(cash?.netBalance).toBe(12200);

    // Inventory net balance: 3000 - 800 = 2200
    const inv = tb.items.find((i) => i.code === '1300');
    expect(inv?.netBalance).toBe(2200);
  });

  it('computes Income Statement with Gross Profit and Net Income', () => {
    const mockLines = [
      // Revenue $5,000
      { accountId: '4010', debit: 0, credit: 5000 },
      // COGS $2,000
      { accountId: '5010', debit: 2000, credit: 0 },
      // Rent $1,000
      { accountId: '5020', debit: 1000, credit: 0 },
      // Cash offset
      { accountId: '1010', debit: 2000, credit: 0 },
    ];

    const pnl = FinancialStatementEngine.generateIncomeStatement(
      mockAccounts,
      mockLines,
      '2026-09-01',
      '2026-09-30',
    );

    expect(pnl.revenues.total).toBe(5000);
    expect(pnl.costOfGoodsSold.total).toBe(2000);
    expect(pnl.grossProfit).toBe(3000); // 5000 - 2000
    expect(pnl.operatingExpenses.total).toBe(1000);
    expect(pnl.netIncome).toBe(2000); // 3000 - 1000
  });

  it('verifies the Balance Sheet equation (Assets === Liabilities + Equity)', () => {
    const mockLines = [
      // Owner Equity contribution: $10,000
      { accountId: '1010', debit: 10000, credit: 0 },
      { accountId: '3010', debit: 0, credit: 10000 },
      // Sale: $1,000 cash revenue, $400 COGS
      { accountId: '1010', debit: 1000, credit: 0 },
      { accountId: '4010', debit: 0, credit: 1000 },
      { accountId: '5010', debit: 400, credit: 0 },
      { accountId: '1300', debit: 0, credit: 400 },
      // Initial inventory purchased with cash $2,000
      { accountId: '1300', debit: 2000, credit: 0 },
      { accountId: '1010', debit: 0, credit: 2000 },
    ];

    const bs = FinancialStatementEngine.generateBalanceSheet(
      mockAccounts,
      mockLines,
      '2026-09-30',
    );

    expect(bs.isBalanced).toBe(true);
    // Net Income = 1000 revenue - 400 cogs = 600
    expect(bs.currentPeriodNetIncome).toBe(600);
    // Assets: Cash = 10000 + 1000 - 2000 = 9000. Inventory = 2000 - 400 = 1600. Total Assets = 10600
    expect(bs.totalAssets).toBe(10600);
    // Liabilities = 0
    expect(bs.totalLiabilities).toBe(0);
    // Equity = Base 10000 + 600 Net Income = 10600
    expect(bs.totalEquity).toBe(10600);
    expect(bs.totalAssets).toBe(bs.totalLiabilities + bs.totalEquity);
  });
});
