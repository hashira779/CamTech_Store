import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser, type JournalEntryStatus } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { FinanceService } from './finance.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  CreateJournalEntryDto,
  FinancialStatementQueryDto,
} from './dto/finance.dto';

@ApiTags('Finance & General Ledger')
@ApiBearerAuth()
@Controller({ path: 'finance', version: '1' })
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ─── Chart of Accounts ──────────────────────────────────────────

  @Get('accounts')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  @ApiOperation({ summary: 'List tenant chart of accounts with live balances' })
  async listAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.financeService.listAccounts(user.organizationId);
  }

  @Post('accounts')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  @ApiOperation({ summary: 'Create a new account in the Chart of Accounts' })
  async createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ) {
    return this.financeService.createAccount(user.organizationId, dto as any);
  }

  @Patch('accounts/:id')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  @ApiOperation({ summary: 'Update an account' })
  async updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.financeService.updateAccount(user.organizationId, id, dto as any);
  }

  // ─── Double-Entry Journal ───────────────────────────────────────

  @Get('journals')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  @ApiOperation({ summary: 'List double-entry journal entries' })
  async listJournalEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: JournalEntryStatus,
  ) {
    return this.financeService.listJournalEntries(user.organizationId, status);
  }

  @Get('journals/:id')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  @ApiOperation({ summary: 'Get a specific journal entry with line items' })
  async getJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.financeService.getJournalEntry(user.organizationId, id);
  }

  @Post('journals')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  @ApiOperation({ summary: 'Create a new balanced journal entry in DRAFT state' })
  async createJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.financeService.createJournalEntry(user.organizationId, dto as any, user.id);
  }

  @Post('journals/:id/post')
  @RequirePermissions(PERMISSIONS.JOURNAL_POST)
  @ApiOperation({ summary: 'Post a draft journal entry to the General Ledger' })
  async postJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.financeService.postJournalEntry(user.organizationId, id, user.id);
  }

  @Post('journals/:id/void')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  @ApiOperation({ summary: 'Void a journal entry' })
  async voidJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.financeService.voidJournalEntry(user.organizationId, id, user.id);
  }

  // ─── Financial Statements & Summary ─────────────────────────────

  @Get('statements/trial-balance')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  @ApiOperation({ summary: 'Generate live Trial Balance verifying debit/credit equality' })
  async getTrialBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinancialStatementQueryDto,
  ) {
    return this.financeService.getTrialBalance(user.organizationId, query as any);
  }

  @Get('statements/income-statement')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  @ApiOperation({ summary: 'Generate Income Statement (Profit & Loss / P&L)' })
  async getIncomeStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinancialStatementQueryDto,
  ) {
    return this.financeService.getIncomeStatement(user.organizationId, query as any);
  }

  @Get('statements/balance-sheet')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  @ApiOperation({ summary: 'Generate Balance Sheet (Assets = Liabilities + Equity)' })
  async getBalanceSheet(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinancialStatementQueryDto,
  ) {
    return this.financeService.getBalanceSheet(user.organizationId, query as any);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  @ApiOperation({ summary: 'Executive financial health summary' })
  async getFinanceSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.financeService.getFinanceSummary(user.organizationId);
  }
}
