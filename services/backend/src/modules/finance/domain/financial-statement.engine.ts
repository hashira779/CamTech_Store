import type {
  AccountType,
  TrialBalanceDto,
  TrialBalanceItemDto,
  IncomeStatementDto,
  BalanceSheetDto,
  StatementSectionDto,
} from '@mystore/contracts';

export interface AccountRecord {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  currency: string;
}

export interface LineRecord {
  accountId: string;
  debit: number;
  credit: number;
}

export class FinancialStatementEngine {
  /**
   * Generates a balanced Trial Balance verifying total debits equal total credits.
   */
  static generateTrialBalance(
    accounts: AccountRecord[],
    lines: LineRecord[],
  ): TrialBalanceDto {
    const map = new Map<string, { totalDebit: number; totalCredit: number }>();

    for (const line of lines) {
      const current = map.get(line.accountId) || { totalDebit: 0, totalCredit: 0 };
      current.totalDebit += line.debit;
      current.totalCredit += line.credit;
      map.set(line.accountId, current);
    }

    let grandTotalDebits = 0;
    let grandTotalCredits = 0;
    const items: TrialBalanceItemDto[] = [];

    for (const acc of accounts) {
      const lineData = map.get(acc.id) || { totalDebit: 0, totalCredit: 0 };
      grandTotalDebits += lineData.totalDebit;
      grandTotalCredits += lineData.totalCredit;

      // Normal balance:
      // ASSET, EXPENSE: Debit - Credit
      // LIABILITY, EQUITY, REVENUE: Credit - Debit
      let netBalance = 0;
      if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
        netBalance = lineData.totalDebit - lineData.totalCredit;
      } else {
        netBalance = lineData.totalCredit - lineData.totalDebit;
      }

      items.push({
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        totalDebit: Number(lineData.totalDebit.toFixed(2)),
        totalCredit: Number(lineData.totalCredit.toFixed(2)),
        netBalance: Number(netBalance.toFixed(2)),
      });
    }

    const isBalanced = Math.abs(grandTotalDebits - grandTotalCredits) < 0.0001;

    return {
      items: items.sort((a, b) => a.code.localeCompare(b.code)),
      totalDebits: Number(grandTotalDebits.toFixed(2)),
      totalCredits: Number(grandTotalCredits.toFixed(2)),
      isBalanced,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates an Income Statement (Profit & Loss / P&L).
   */
  static generateIncomeStatement(
    accounts: AccountRecord[],
    lines: LineRecord[],
    startDate: string,
    endDate: string,
  ): IncomeStatementDto {
    const trialBalance = this.generateTrialBalance(accounts, lines);

    const revenueItems: { code: string; name: string; amount: number }[] = [];
    const cogsItems: { code: string; name: string; amount: number }[] = [];
    const opexItems: { code: string; name: string; amount: number }[] = [];

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalOpex = 0;

    for (const item of trialBalance.items) {
      if (item.type === 'REVENUE') {
        revenueItems.push({ code: item.code, name: item.name, amount: item.netBalance });
        totalRevenue += item.netBalance;
      } else if (item.type === 'EXPENSE') {
        if (item.code.startsWith('501') || item.name.toLowerCase().includes('cost of goods')) {
          cogsItems.push({ code: item.code, name: item.name, amount: item.netBalance });
          totalCogs += item.netBalance;
        } else {
          opexItems.push({ code: item.code, name: item.name, amount: item.netBalance });
          totalOpex += item.netBalance;
        }
      }
    }

    const grossProfit = totalRevenue - totalCogs;
    const netIncome = grossProfit - totalOpex;

    return {
      startDate,
      endDate,
      revenues: {
        category: 'Operating Revenues',
        items: revenueItems,
        total: Number(totalRevenue.toFixed(2)),
      },
      costOfGoodsSold: {
        category: 'Cost of Goods Sold (COGS)',
        items: cogsItems,
        total: Number(totalCogs.toFixed(2)),
      },
      grossProfit: Number(grossProfit.toFixed(2)),
      operatingExpenses: {
        category: 'Operating Expenses (OPEX)',
        items: opexItems,
        total: Number(totalOpex.toFixed(2)),
      },
      netIncome: Number(netIncome.toFixed(2)),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a Balance Sheet and verifies the accounting equation:
   * Total Assets === Total Liabilities + Total Equity (including Net Income)
   */
  static generateBalanceSheet(
    accounts: AccountRecord[],
    lines: LineRecord[],
    asOfDate: string,
  ): BalanceSheetDto {
    const trialBalance = this.generateTrialBalance(accounts, lines);

    const assetItems: { code: string; name: string; amount: number }[] = [];
    const liabilityItems: { code: string; name: string; amount: number }[] = [];
    const equityItems: { code: string; name: string; amount: number }[] = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalBaseEquity = 0;

    // Calculate current period net income from revenues and expenses
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const item of trialBalance.items) {
      if (item.type === 'ASSET') {
        assetItems.push({ code: item.code, name: item.name, amount: item.netBalance });
        totalAssets += item.netBalance;
      } else if (item.type === 'LIABILITY') {
        liabilityItems.push({ code: item.code, name: item.name, amount: item.netBalance });
        totalLiabilities += item.netBalance;
      } else if (item.type === 'EQUITY') {
        equityItems.push({ code: item.code, name: item.name, amount: item.netBalance });
        totalBaseEquity += item.netBalance;
      } else if (item.type === 'REVENUE') {
        totalRevenue += item.netBalance;
      } else if (item.type === 'EXPENSE') {
        totalExpenses += item.netBalance;
      }
    }

    const currentPeriodNetIncome = totalRevenue - totalExpenses;
    const totalEquity = totalBaseEquity + currentPeriodNetIncome;

    const diff = Math.abs(totalAssets - (totalLiabilities + totalEquity));
    const isBalanced = diff < 0.01;

    return {
      asOfDate,
      assets: {
        category: 'Assets',
        items: assetItems,
        total: Number(totalAssets.toFixed(2)),
      },
      liabilities: {
        category: 'Liabilities',
        items: liabilityItems,
        total: Number(totalLiabilities.toFixed(2)),
      },
      equity: {
        category: 'Equity',
        items: [
          ...equityItems,
          {
            code: '3099',
            name: 'Current Period Retained Profit/Loss',
            amount: Number(currentPeriodNetIncome.toFixed(2)),
          },
        ],
        total: Number(totalEquity.toFixed(2)),
      },
      currentPeriodNetIncome: Number(currentPeriodNetIncome.toFixed(2)),
      totalAssets: Number(totalAssets.toFixed(2)),
      totalLiabilities: Number(totalLiabilities.toFixed(2)),
      totalEquity: Number(totalEquity.toFixed(2)),
      isBalanced,
      generatedAt: new Date().toISOString(),
    };
  }
}
