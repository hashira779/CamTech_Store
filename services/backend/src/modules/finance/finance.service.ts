import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JournalEntryEntity } from './domain/journal-entry.entity';
import { FinancialStatementEngine } from './domain/financial-statement.engine';
import type {
  AccountDto,
  JournalEntryDto,
  TrialBalanceDto,
  IncomeStatementDto,
  BalanceSheetDto,
  FinanceSummaryDto,
  CreateAccountInput,
  UpdateAccountInput,
  CreateJournalEntryInput,
  FinancialStatementQuery,
  JournalEntryStatus,
  AccountType,
} from '@mystore/contracts';

const STANDARD_COA_SEED: {
  code: string;
  name: string;
  type: AccountType;
  description: string;
}[] = [
  { code: '1010', name: 'Cash on Hand', type: 'ASSET', description: 'Primary register physical currency & till cash' },
  { code: '1020', name: 'Operating Bank Account', type: 'ASSET', description: 'Primary business clearing & digital banking' },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET', description: 'Outstanding customer invoice balances' },
  { code: '1300', name: 'Merchandise Inventory Asset', type: 'ASSET', description: 'Total cost valuation of physical stock on hand' },
  { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', description: 'Unpaid procurement bills and supplier obligations' },
  { code: '2050', name: 'Sales Tax Payable', type: 'LIABILITY', description: 'Collected sales tax & VAT owed to tax authority' },
  { code: '3010', name: 'Retained Earnings', type: 'EQUITY', description: 'Cumulative net profit/loss retained in the business' },
  { code: '3020', name: 'Owner / Share Capital', type: 'EQUITY', description: 'Contributed owner equity & capital reserves' },
  { code: '4010', name: 'Sales Revenue', type: 'REVENUE', description: 'Gross revenue recognized from completed customer sales' },
  { code: '5010', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE', description: 'Direct acquisition/manufacturing cost of items sold' },
  { code: '5020', name: 'Store & Operating Expenses', type: 'EXPENSE', description: 'Rent, utilities, packaging, and operating expenses' },
];

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Automatically provisions standard GAAP Chart of Accounts for the tenant if empty.
   */
  async ensureStandardChartOfAccounts(orgId: string): Promise<void> {
    const existingCount = await this.prisma.account.count({
      where: { organizationId: orgId },
    });

    if (existingCount === 0) {
      this.logger.log(`Provisioning standard Chart of Accounts for tenant ${orgId}`);
      await this.prisma.$transaction(
        STANDARD_COA_SEED.map((seed) =>
          this.prisma.account.create({
            data: {
              organizationId: orgId,
              code: seed.code,
              name: seed.name,
              type: seed.type,
              description: seed.description,
              isSystem: true,
              isActive: true,
            },
          }),
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Chart of Accounts Management
  // ---------------------------------------------------------------------------

  async listAccounts(orgId: string): Promise<AccountDto[]> {
    await this.ensureStandardChartOfAccounts(orgId);

    const accounts = await this.prisma.account.findMany({
      where: { organizationId: orgId },
      include: {
        journalLines: {
          where: { journalEntry: { status: 'POSTED' } },
        },
      },
      orderBy: { code: 'asc' },
    });

    return accounts.map((acc) => {
      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of acc.journalLines) {
        totalDebit += Number(line.debit);
        totalCredit += Number(line.credit);
      }

      // Normal balance evaluation
      let balance = 0;
      if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
        balance = totalDebit - totalCredit;
      } else {
        balance = totalCredit - totalDebit;
      }

      return {
        id: acc.id,
        organizationId: acc.organizationId,
        code: acc.code,
        name: acc.name,
        type: acc.type as AccountType,
        currency: acc.currency,
        description: acc.description,
        balance: Number(balance.toFixed(2)),
        isSystem: acc.isSystem,
        isActive: acc.isActive,
        createdAt: acc.createdAt.toISOString(),
        updatedAt: acc.updatedAt.toISOString(),
      };
    });
  }

  async createAccount(orgId: string, input: CreateAccountInput): Promise<AccountDto> {
    const existing = await this.prisma.account.findUnique({
      where: { organizationId_code: { organizationId: orgId, code: input.code } },
    });
    if (existing) {
      throw new ConflictException(`Account with code ${input.code} already exists`);
    }

    const created = await this.prisma.account.create({
      data: {
        organizationId: orgId,
        code: input.code,
        name: input.name,
        type: input.type,
        currency: input.currency || 'USD',
        description: input.description,
        isSystem: false,
        isActive: true,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'FINANCE_ACCOUNT_CREATED',
      resourceType: 'Account',
      resourceId: created.id,
      metadata: { code: created.code, name: created.name, type: created.type },
    });

    return {
      id: created.id,
      organizationId: created.organizationId,
      code: created.code,
      name: created.name,
      type: created.type as AccountType,
      currency: created.currency,
      description: created.description,
      balance: 0,
      isSystem: created.isSystem,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateAccount(orgId: string, id: string, input: UpdateAccountInput): Promise<AccountDto> {
    const account = await this.prisma.account.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: {
        name: input.name ?? account.name,
        description: input.description !== undefined ? input.description : account.description,
        isActive: input.isActive !== undefined ? input.isActive : account.isActive,
      },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      code: updated.code,
      name: updated.name,
      type: updated.type as AccountType,
      currency: updated.currency,
      description: updated.description,
      balance: 0,
      isSystem: updated.isSystem,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Double-Entry Journal Management
  // ---------------------------------------------------------------------------

  async listJournalEntries(
    orgId: string,
    status?: JournalEntryStatus,
  ): Promise<JournalEntryDto[]> {
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status } : {}),
      },
      include: {
        lines: {
          include: { account: true },
        },
      },
      orderBy: { postingDate: 'desc' },
      take: 100,
    });

    return entries.map((e) => this.mapJournalEntryDto(e));
  }

  async getJournalEntry(orgId: string, id: string): Promise<JournalEntryDto> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, organizationId: orgId },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });
    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    return this.mapJournalEntryDto(entry);
  }

  async createJournalEntry(
    orgId: string,
    input: CreateJournalEntryInput,
    userId?: string,
  ): Promise<JournalEntryDto> {
    await this.ensureStandardChartOfAccounts(orgId);

    // 1. Generate sequential entry number
    const count = await this.prisma.journalEntry.count({
      where: { organizationId: orgId },
    });
    const year = new Date().getFullYear();
    const entryNumber = `JE-${year}-${(count + 1).toString().padStart(6, '0')}`;

    // 2. Validate via Domain Entity (enforces sum(debit) == sum(credit))
    let domainEntity: JournalEntryEntity;
    try {
      domainEntity = JournalEntryEntity.create({
        organizationId: orgId,
        entryNumber,
        postingDate: input.postingDate ? new Date(input.postingDate) : new Date(),
        sourceType: input.sourceType || 'MANUAL',
        sourceId: input.sourceId,
        description: input.description,
        lines: input.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo,
        })),
      });
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }

    // 3. Persist atomically
    const created = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          organizationId: orgId,
          entryNumber: domainEntity.entryNumber,
          postingDate: domainEntity.postingDate,
          sourceType: domainEntity.sourceType,
          sourceId: domainEntity.sourceId,
          description: domainEntity.description,
          status: 'DRAFT',
          createdById: userId,
        },
      });

      for (const line of domainEntity.lines) {
        await tx.journalLineItem.create({
          data: {
            journalEntryId: entry.id,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
          },
        });
      }

      return tx.journalEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: { lines: { include: { account: true } } },
      });
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: userId,
      action: 'FINANCE_JOURNAL_ENTRY_CREATED',
      resourceType: 'JournalEntry',
      resourceId: created.id,
      metadata: {
        entryNumber: created.entryNumber,
        totalDebit: domainEntity.totalDebit,
        description: created.description,
      },
    });

    return this.mapJournalEntryDto(created);
  }

  async postJournalEntry(orgId: string, id: string, userId?: string): Promise<JournalEntryDto> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, organizationId: orgId },
      include: { lines: true },
    });
    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    if (entry.status === 'POSTED') {
      throw new BadRequestException('Journal entry is already posted');
    }
    if (entry.status === 'VOID') {
      throw new BadRequestException('Cannot post a voided journal entry');
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'POSTED' },
      include: { lines: { include: { account: true } } },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: userId,
      action: 'FINANCE_JOURNAL_ENTRY_POSTED',
      resourceType: 'JournalEntry',
      resourceId: updated.id,
      metadata: { entryNumber: updated.entryNumber },
    });

    return this.mapJournalEntryDto(updated);
  }

  async voidJournalEntry(orgId: string, id: string, userId?: string): Promise<JournalEntryDto> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    if (entry.status === 'VOID') {
      throw new BadRequestException('Journal entry is already voided');
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'VOID' },
      include: { lines: { include: { account: true } } },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: userId,
      action: 'FINANCE_JOURNAL_ENTRY_VOIDED',
      resourceType: 'JournalEntry',
      resourceId: updated.id,
      metadata: { entryNumber: updated.entryNumber },
    });

    return this.mapJournalEntryDto(updated);
  }

  // ---------------------------------------------------------------------------
  // Financial Statements (Trial Balance, P&L, Balance Sheet)
  // ---------------------------------------------------------------------------

  private async fetchAccountsAndPostedLines(orgId: string, dateFilter?: { gte?: Date; lte?: Date }) {
    await this.ensureStandardChartOfAccounts(orgId);

    const accounts = await this.prisma.account.findMany({
      where: { organizationId: orgId },
    });

    const lines = await this.prisma.journalLineItem.findMany({
      where: {
        journalEntry: {
          organizationId: orgId,
          status: 'POSTED',
          ...(dateFilter ? { postingDate: dateFilter } : {}),
        },
      },
    });

    return {
      accounts: accounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type as AccountType,
        currency: a.currency,
      })),
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    };
  }

  async getTrialBalance(orgId: string, query?: FinancialStatementQuery): Promise<TrialBalanceDto> {
    const dateFilter = query?.asOfDate
      ? { lte: new Date(query.asOfDate) }
      : undefined;

    const { accounts, lines } = await this.fetchAccountsAndPostedLines(orgId, dateFilter);
    return FinancialStatementEngine.generateTrialBalance(accounts, lines);
  }

  async getIncomeStatement(orgId: string, query?: FinancialStatementQuery): Promise<IncomeStatementDto> {
    const now = new Date();
    const startDate = query?.startDate || new Date(now.getFullYear(), 0, 1).toISOString();
    const endDate = query?.endDate || now.toISOString();

    const dateFilter = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };

    const { accounts, lines } = await this.fetchAccountsAndPostedLines(orgId, dateFilter);
    return FinancialStatementEngine.generateIncomeStatement(accounts, lines, startDate, endDate);
  }

  async getBalanceSheet(orgId: string, query?: FinancialStatementQuery): Promise<BalanceSheetDto> {
    const asOfDate = query?.asOfDate || new Date().toISOString();
    const dateFilter = { lte: new Date(asOfDate) };

    const { accounts, lines } = await this.fetchAccountsAndPostedLines(orgId, dateFilter);
    return FinancialStatementEngine.generateBalanceSheet(accounts, lines, asOfDate);
  }

  async getFinanceSummary(orgId: string): Promise<FinanceSummaryDto> {
    const bs = await this.getBalanceSheet(orgId);
    const pnl = await this.getIncomeStatement(orgId);

    const accountCount = await this.prisma.account.count({ where: { organizationId: orgId } });
    const postedJournalCount = await this.prisma.journalEntry.count({
      where: { organizationId: orgId, status: 'POSTED' },
    });

    return {
      totalAssets: bs.totalAssets,
      totalLiabilities: bs.totalLiabilities,
      totalEquity: bs.totalEquity,
      netIncome: pnl.netIncome,
      isLedgerBalanced: bs.isBalanced,
      accountCount,
      postedJournalCount,
    };
  }

  // ---------------------------------------------------------------------------
  // Helper Mapper
  // ---------------------------------------------------------------------------

  private mapJournalEntryDto(e: any): JournalEntryDto {
    let totalDebit = 0;
    let totalCredit = 0;

    const lines = (e.lines || []).map((l: any) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      totalDebit += debit;
      totalCredit += credit;

      return {
        id: l.id,
        journalEntryId: l.journalEntryId,
        accountId: l.accountId,
        accountCode: l.account?.code,
        accountName: l.account?.name,
        accountType: l.account?.type,
        debit,
        credit,
        memo: l.memo,
      };
    });

    return {
      id: e.id,
      organizationId: e.organizationId,
      entryNumber: e.entryNumber,
      postingDate: e.postingDate.toISOString(),
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      description: e.description,
      status: e.status,
      lines,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }
}
