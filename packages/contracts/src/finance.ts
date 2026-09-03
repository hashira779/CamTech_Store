import { z } from 'zod';

export const ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const JOURNAL_ENTRY_STATUSES = ['DRAFT', 'POSTED', 'VOID'] as const;
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number];

export const JOURNAL_SOURCE_TYPES = [
  'MANUAL',
  'SALE',
  'PROCUREMENT',
  'INVENTORY_ADJUSTMENT',
  'PAYMENT',
  'REFUND',
] as const;
export type JournalSourceType = (typeof JOURNAL_SOURCE_TYPES)[number];

export const ACCOUNTING_PERIOD_STATUSES = ['OPEN', 'CLOSED'] as const;
export type AccountingPeriodStatus = (typeof ACCOUNTING_PERIOD_STATUSES)[number];

// ─── Account Schemas ─────────────────────────────────────────────

export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.string().optional(),
  description: z.string().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

// ─── Journal Entry Schemas ───────────────────────────────────────

export const journalLineItemSchema = z.object({
  accountId: z.string().min(1),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  memo: z.string().optional(),
});
export type JournalLineItemInput = z.infer<typeof journalLineItemSchema>;

export const createJournalEntrySchema = z.object({
  postingDate: z.string().optional(),
  sourceType: z.enum(JOURNAL_SOURCE_TYPES).optional(),
  sourceId: z.string().optional(),
  description: z.string().min(1).max(500),
  lines: z.array(journalLineItemSchema).min(2),
});
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

export const financialStatementQuerySchema = z.object({
  asOfDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type FinancialStatementQuery = z.infer<typeof financialStatementQuerySchema>;

// ─── DTOs ────────────────────────────────────────────────────────

export interface AccountDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: AccountType;
  currency: string;
  description?: string | null;
  balance: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLineItemDto {
  id: string;
  journalEntryId: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  accountType?: AccountType;
  debit: number;
  credit: number;
  memo?: string | null;
}

export interface JournalEntryDto {
  id: string;
  organizationId: string;
  entryNumber: string;
  postingDate: string;
  sourceType: JournalSourceType;
  sourceId?: string | null;
  description: string;
  status: JournalEntryStatus;
  lines: JournalLineItemDto[];
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingPeriodDto {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
}

export interface TrialBalanceItemDto {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export interface TrialBalanceDto {
  items: TrialBalanceItemDto[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  generatedAt: string;
}

export interface StatementSectionDto {
  category: string;
  items: { code: string; name: string; amount: number }[];
  total: number;
}

export interface IncomeStatementDto {
  startDate: string;
  endDate: string;
  revenues: StatementSectionDto;
  costOfGoodsSold: StatementSectionDto;
  grossProfit: number;
  operatingExpenses: StatementSectionDto;
  netIncome: number;
  generatedAt: string;
}

export interface BalanceSheetDto {
  asOfDate: string;
  assets: StatementSectionDto;
  liabilities: StatementSectionDto;
  equity: StatementSectionDto;
  currentPeriodNetIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean; // totalAssets === totalLiabilities + totalEquity
  generatedAt: string;
}

export interface FinanceSummaryDto {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netIncome: number;
  isLedgerBalanced: boolean;
  accountCount: number;
  postedJournalCount: number;
}
