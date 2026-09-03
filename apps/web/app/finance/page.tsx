'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type {
  AccountDto,
  AccountType,
  JournalEntryDto,
  CreateAccountInput,
  CreateJournalEntryInput,
  JournalLineItemInput,
} from '@mystore/contracts';
import {
  Landmark,
  Plus,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Scale,
  RefreshCw,
  TrendingUp,
  CreditCard,
  DollarSign,
  Building,
  Check,
  X,
  Trash2,
} from 'lucide-react';

export default function FinancePage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'COA' | 'JOURNALS' | 'TRIAL_BALANCE' | 'STATEMENTS'>('COA');
  const [statementType, setStatementType] = useState<'PNL' | 'BALANCE_SHEET'>('PNL');

  // Modal States
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);

  // New Account Form
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<AccountType>('ASSET');
  const [newAccDesc, setNewAccDesc] = useState('');

  // New Journal Entry Form
  const [journalDesc, setJournalDesc] = useState('');
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
  const [journalLines, setJournalLines] = useState<JournalLineItemInput[]>([
    { accountId: '', debit: 0, credit: 0, memo: '' },
    { accountId: '', debit: 0, credit: 0, memo: '' },
  ]);

  // Queries
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['financeSummary'],
    queryFn: () => api.getFinanceSummary(token!),
    enabled: Boolean(token),
  });

  const { data: accounts = [], refetch: refetchAccounts } = useQuery({
    queryKey: ['accountsList'],
    queryFn: () => api.listAccounts(token!),
    enabled: Boolean(token),
  });

  const { data: journals = [], refetch: refetchJournals } = useQuery({
    queryKey: ['journalsList'],
    queryFn: () => api.listJournalEntries(token!),
    enabled: Boolean(token),
  });

  const { data: trialBalance, refetch: refetchTrialBalance } = useQuery({
    queryKey: ['trialBalance'],
    queryFn: () => api.getTrialBalance(token!),
    enabled: Boolean(token) && activeTab === 'TRIAL_BALANCE',
  });

  const { data: incomeStatement } = useQuery({
    queryKey: ['incomeStatement'],
    queryFn: () => api.getIncomeStatement(token!),
    enabled: Boolean(token) && activeTab === 'STATEMENTS' && statementType === 'PNL',
  });

  const { data: balanceSheet } = useQuery({
    queryKey: ['balanceSheet'],
    queryFn: () => api.getBalanceSheet(token!),
    enabled: Boolean(token) && activeTab === 'STATEMENTS' && statementType === 'BALANCE_SHEET',
  });

  // Mutations
  const createAccountMutation = useMutation({
    mutationFn: (input: CreateAccountInput) => api.createAccount(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary'] });
      setIsAccountModalOpen(false);
      setNewAccCode('');
      setNewAccName('');
      setNewAccDesc('');
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to create account');
    },
  });

  const createJournalMutation = useMutation({
    mutationFn: (input: CreateJournalEntryInput) => api.createJournalEntry(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalsList'] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary'] });
      setIsJournalModalOpen(false);
      setJournalDesc('');
      setJournalLines([
        { accountId: '', debit: 0, credit: 0, memo: '' },
        { accountId: '', debit: 0, credit: 0, memo: '' },
      ]);
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to create journal entry');
    },
  });

  const postJournalMutation = useMutation({
    mutationFn: (id: string) => api.postJournalEntry(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary'] });
      queryClient.invalidateQueries({ queryKey: ['trialBalance'] });
      queryClient.invalidateQueries({ queryKey: ['incomeStatement'] });
      queryClient.invalidateQueries({ queryKey: ['balanceSheet'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to post journal entry');
    },
  });

  const voidJournalMutation = useMutation({
    mutationFn: (id: string) => api.voidJournalEntry(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to void journal entry');
    },
  });

  // Calculate live journal modal balancing
  const modalTotalDebit = journalLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const modalTotalCredit = journalLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const modalDifference = Math.abs(modalTotalDebit - modalTotalCredit);
  const isModalBalanced = modalDifference < 0.001 && modalTotalDebit > 0;

  const handleAddLine = () => {
    setJournalLines([...journalLines, { accountId: '', debit: 0, credit: 0, memo: '' }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (journalLines.length <= 2) {
      alert('Journal entry must have at least two line items');
      return;
    }
    setJournalLines(journalLines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof JournalLineItemInput, value: any) => {
    const next = [...journalLines];
    next[idx] = { ...next[idx], [field]: value };
    setJournalLines(next);
  };

  const handleCreateJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isModalBalanced) {
      alert('Cannot submit unbalanced journal entry: Debits must equal Credits');
      return;
    }
    createJournalMutation.mutate({
      description: journalDesc,
      postingDate: new Date(journalDate).toISOString(),
      lines: journalLines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        memo: l.memo || undefined,
      })),
    });
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccName.trim()) {
      alert('Code and Name are required');
      return;
    }
    createAccountMutation.mutate({
      code: newAccCode.trim(),
      name: newAccName.trim(),
      type: newAccType,
      description: newAccDesc.trim() || undefined,
    });
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Landmark className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Finance & General Ledger
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Double-entry chart of accounts, immutable general journal, trial balance, and balance sheet.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                refetchSummary();
                refetchAccounts();
                refetchJournals();
              }}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="btn btn-secondary flex items-center gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" /> New Account
            </button>

            <button
              onClick={() => setIsJournalModalOpen(true)}
              className="btn flex items-center gap-1.5 text-sm shadow-sm shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> Create Journal Entry
            </button>
          </div>
        </div>

        {/* Financial KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Assets */}
          <div className="card p-5 border-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Assets
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Building className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground font-mono">
                ${summary?.totalAssets.toFixed(2) ?? '0.00'}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Cash, Bank, AR, Inventory</p>
            </div>
          </div>

          {/* Total Liabilities */}
          <div className="card p-5 border-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Liabilities
              </span>
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground font-mono">
                ${summary?.totalLiabilities.toFixed(2) ?? '0.00'}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">AP & Taxes Payable</p>
            </div>
          </div>

          {/* Net Income */}
          <div className="card p-5 border-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Current Net Income
              </span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-bold font-mono ${(summary?.netIncome ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${summary?.netIncome.toFixed(2) ?? '0.00'}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Revenue minus Expenses (P&L)</p>
            </div>
          </div>

          {/* Ledger Integrity */}
          <div className="card p-5 border-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ledger Balance Integrity
              </span>
              <div className={`p-2 rounded-lg ${summary?.isLedgerBalanced ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-1.5 text-base font-bold text-foreground">
                {summary?.isLedgerBalanced ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Balanced (Double-Entry OK)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <span>Reconciliation Pending</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {summary?.postedJournalCount ?? 0} posted journal entries
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('COA')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'COA'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Chart of Accounts (COA)
          </button>
          <button
            onClick={() => setActiveTab('JOURNALS')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'JOURNALS'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            General Journal Ledger
          </button>
          <button
            onClick={() => setActiveTab('TRIAL_BALANCE')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'TRIAL_BALANCE'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Trial Balance
          </button>
          <button
            onClick={() => setActiveTab('STATEMENTS')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'STATEMENTS'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Financial Statements
          </button>
        </div>

        {/* TAB 1: CHART OF ACCOUNTS */}
        {activeTab === 'COA' && (
          <div className="card border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-card">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Accounts Registry</h3>
                <p className="text-xs text-muted-foreground">Standardized multi-entity chart of accounts</p>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {accounts.length} Total Accounts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-accent/40 text-muted-foreground">
                    <th className="p-3 font-semibold uppercase tracking-wider">Code</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Account Name</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Type</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Currency</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">System Tag</th>
                    <th className="p-3 font-semibold uppercase tracking-wider text-right">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {accounts.map((acc) => {
                    const typeBadge: Record<AccountType, string> = {
                      ASSET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      LIABILITY: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                      EQUITY: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                      REVENUE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                      EXPENSE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    };
                    return (
                      <tr key={acc.id} className="hover:bg-accent/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-foreground">{acc.code}</td>
                        <td className="p-3 font-medium text-foreground">
                          {acc.name}
                          {acc.description && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-xs">{acc.description}</p>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${typeBadge[acc.type]}`}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">{acc.currency}</td>
                        <td className="p-3">
                          {acc.isSystem ? (
                            <span className="text-[10px] text-primary font-semibold">Standard System</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Custom</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          ${acc.balance.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: GENERAL JOURNAL */}
        {activeTab === 'JOURNALS' && (
          <div className="card border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-card">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Double-Entry Journal Entries</h3>
                <p className="text-xs text-muted-foreground">Immutable historical financial transactions</p>
              </div>
              <button
                onClick={() => setIsJournalModalOpen(true)}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New Entry
              </button>
            </div>

            {journals.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No journal entries recorded yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create a manual entry or post commerce transactions.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {journals.map((j) => (
                  <div key={j.id} className="p-4 flex flex-col gap-3 hover:bg-accent/20 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-foreground text-sm">{j.entryNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            j.status === 'POSTED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : j.status === 'DRAFT'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-zinc-500/10 text-zinc-400'
                          }`}
                        >
                          {j.status}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(j.postingDate).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-primary px-1.5 py-0.5 rounded bg-primary/10">
                          {j.sourceType}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {j.status === 'DRAFT' && (
                          <button
                            onClick={() => postJournalMutation.mutate(j.id)}
                            className="btn text-xs py-1 px-3 flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" /> Post to Ledger
                          </button>
                        )}
                        {j.status === 'DRAFT' && (
                          <button
                            onClick={() => voidJournalMutation.mutate(j.id)}
                            className="btn btn-secondary text-xs py-1 px-3 text-destructive hover:bg-destructive/10"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-foreground font-medium">{j.description}</p>

                    {/* Sub-lines Table */}
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="bg-accent/40 text-muted-foreground">
                            <th className="p-2 font-semibold">Account</th>
                            <th className="p-2 font-semibold">Memo</th>
                            <th className="p-2 font-semibold text-right">Debit ($)</th>
                            <th className="p-2 font-semibold text-right">Credit ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {j.lines.map((l) => (
                            <tr key={l.id} className="hover:bg-accent/20">
                              <td className="p-2 font-mono">
                                <span className="font-bold text-foreground">{l.accountCode}</span>{' '}
                                <span className="text-muted-foreground">{l.accountName}</span>
                              </td>
                              <td className="p-2 text-muted-foreground">{l.memo || '—'}</td>
                              <td className="p-2 text-right font-mono text-foreground">
                                {l.debit > 0 ? `$${l.debit.toFixed(2)}` : '—'}
                              </td>
                              <td className="p-2 text-right font-mono text-foreground">
                                {l.credit > 0 ? `$${l.credit.toFixed(2)}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-accent/20 font-bold font-mono text-[11px]">
                            <td colSpan={2} className="p-2 text-right text-muted-foreground">
                              Total:
                            </td>
                            <td className="p-2 text-right text-foreground">${j.totalDebit.toFixed(2)}</td>
                            <td className="p-2 text-right text-foreground">${j.totalCredit.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TRIAL BALANCE */}
        {activeTab === 'TRIAL_BALANCE' && (
          <div className="card border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-card">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Trial Balance Verification</h3>
                <p className="text-xs text-muted-foreground">Verification of total debits equal total credits</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${trialBalance?.isBalanced ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  {trialBalance?.isBalanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {trialBalance?.isBalanced ? 'Ledger Balanced' : 'Unbalanced!'}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-accent/40 text-muted-foreground">
                    <th className="p-3 font-semibold uppercase tracking-wider">Account Code</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Account Name</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Type</th>
                    <th className="p-3 font-semibold uppercase tracking-wider text-right">Debit ($)</th>
                    <th className="p-3 font-semibold uppercase tracking-wider text-right">Credit ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(trialBalance?.items || []).map((item) => (
                    <tr key={item.accountId} className="hover:bg-accent/30 transition-colors">
                      <td className="p-3 font-mono font-bold text-foreground">{item.code}</td>
                      <td className="p-3 text-foreground">{item.name}</td>
                      <td className="p-3 text-muted-foreground">{item.type}</td>
                      <td className="p-3 text-right font-mono text-foreground">
                        {item.totalDebit > 0 ? `$${item.totalDebit.toFixed(2)}` : '—'}
                      </td>
                      <td className="p-3 text-right font-mono text-foreground">
                        {item.totalCredit > 0 ? `$${item.totalCredit.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-accent/30 font-bold font-mono text-xs">
                    <td colSpan={3} className="p-3 text-right text-foreground">
                      Grand Total:
                    </td>
                    <td className="p-3 text-right text-foreground">
                      ${trialBalance?.totalDebits.toFixed(2) ?? '0.00'}
                    </td>
                    <td className="p-3 text-right text-foreground">
                      ${trialBalance?.totalCredits.toFixed(2) ?? '0.00'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: FINANCIAL STATEMENTS */}
        {activeTab === 'STATEMENTS' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <button
                onClick={() => setStatementType('PNL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statementType === 'PNL'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                Income Statement (P&L)
              </button>
              <button
                onClick={() => setStatementType('BALANCE_SHEET')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statementType === 'BALANCE_SHEET'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                Balance Sheet
              </button>
            </div>

            {statementType === 'PNL' && incomeStatement && (
              <div className="card p-6 border-border shadow-sm space-y-6 max-w-3xl mx-auto">
                <div className="text-center border-b border-border pb-4">
                  <h3 className="text-lg font-bold text-foreground">Income Statement (Profit & Loss)</h3>
                  <p className="text-xs text-muted-foreground">Standard accrual basis</p>
                </div>

                {/* Revenues */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Operating Revenues</span>
                    <span>Amount</span>
                  </div>
                  {incomeStatement.revenues.items.map((i) => (
                    <div key={i.code} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span>
                        <span className="font-mono text-muted-foreground">{i.code}</span> {i.name}
                      </span>
                      <span className="font-mono">${i.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1">
                    <span>Total Revenues:</span>
                    <span className="font-mono">${incomeStatement.revenues.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* COGS */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Cost of Goods Sold (COGS)</span>
                    <span>Amount</span>
                  </div>
                  {incomeStatement.costOfGoodsSold.items.map((i) => (
                    <div key={i.code} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span>
                        <span className="font-mono text-muted-foreground">{i.code}</span> {i.name}
                      </span>
                      <span className="font-mono">${i.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1">
                    <span>Total COGS:</span>
                    <span className="font-mono">${incomeStatement.costOfGoodsSold.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Gross Profit */}
                <div className="flex justify-between text-sm font-bold p-3 rounded-lg bg-accent/40">
                  <span>Gross Profit:</span>
                  <span className="font-mono text-emerald-400">${incomeStatement.grossProfit.toFixed(2)}</span>
                </div>

                {/* Operating Expenses */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Operating Expenses</span>
                    <span>Amount</span>
                  </div>
                  {incomeStatement.operatingExpenses.items.map((i) => (
                    <div key={i.code} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span>
                        <span className="font-mono text-muted-foreground">{i.code}</span> {i.name}
                      </span>
                      <span className="font-mono">${i.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1">
                    <span>Total Operating Expenses:</span>
                    <span className="font-mono">${incomeStatement.operatingExpenses.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Net Income */}
                <div className="flex justify-between text-base font-bold p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <span>Net Income / (Loss):</span>
                  <span className={`font-mono ${incomeStatement.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${incomeStatement.netIncome.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {statementType === 'BALANCE_SHEET' && balanceSheet && (
              <div className="card p-6 border-border shadow-sm space-y-6 max-w-3xl mx-auto">
                <div className="text-center border-b border-border pb-4">
                  <h3 className="text-lg font-bold text-foreground">Balance Sheet</h3>
                  <p className="text-xs text-muted-foreground">Assets = Liabilities + Owner Equity</p>
                </div>

                {/* Assets */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-xs uppercase tracking-wider text-emerald-400">
                    <span>Assets</span>
                    <span>Amount</span>
                  </div>
                  {balanceSheet.assets.items.map((i) => (
                    <div key={i.code} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span>
                        <span className="font-mono text-muted-foreground">{i.code}</span> {i.name}
                      </span>
                      <span className="font-mono">${i.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1">
                    <span>Total Assets:</span>
                    <span className="font-mono font-bold">${balanceSheet.totalAssets.toFixed(2)}</span>
                  </div>
                </div>

                {/* Liabilities */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-xs uppercase tracking-wider text-rose-400">
                    <span>Liabilities</span>
                    <span>Amount</span>
                  </div>
                  {balanceSheet.liabilities.items.map((i) => (
                    <div key={i.code} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span>
                        <span className="font-mono text-muted-foreground">{i.code}</span> {i.name}
                      </span>
                      <span className="font-mono">${i.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1">
                    <span>Total Liabilities:</span>
                    <span className="font-mono font-bold">${balanceSheet.totalLiabilities.toFixed(2)}</span>
                  </div>
                </div>

                {/* Equity */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-xs uppercase tracking-wider text-purple-400">
                    <span>Equity & Retained Earnings</span>
                    <span>Amount</span>
                  </div>
                  {balanceSheet.equity.items.map((i) => (
                    <div key={i.code} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span>
                        <span className="font-mono text-muted-foreground">{i.code}</span> {i.name}
                      </span>
                      <span className="font-mono">${i.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1">
                    <span>Total Equity:</span>
                    <span className="font-mono font-bold">${balanceSheet.totalEquity.toFixed(2)}</span>
                  </div>
                </div>

                {/* Equation Verification Banner */}
                <div className="flex justify-between text-sm font-bold p-4 rounded-xl bg-accent/40 border border-border">
                  <span>Liabilities + Equity:</span>
                  <span className="font-mono">
                    ${(balanceSheet.totalLiabilities + balanceSheet.totalEquity).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL: NEW ACCOUNT */}
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Create New Account</h3>
                <button onClick={() => setIsAccountModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Account Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1050, 5030"
                    value={newAccCode}
                    onChange={(e) => setNewAccCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Account Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Petty Cash, Office Supplies"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Account Classification</label>
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="ASSET">ASSET (Cash, Bank, Receivables, Inventory)</option>
                    <option value="LIABILITY">LIABILITY (Payables, Taxes Owed)</option>
                    <option value="EQUITY">EQUITY (Capital, Retained Earnings)</option>
                    <option value="REVENUE">REVENUE (Sales, Services)</option>
                    <option value="EXPENSE">EXPENSE (COGS, Rent, Utilities)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="Brief description of this account's purpose"
                    value={newAccDesc}
                    onChange={(e) => setNewAccDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="btn btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createAccountMutation.isPending}
                    className="btn text-xs shadow-sm shadow-primary/20"
                  >
                    {createAccountMutation.isPending ? 'Saving...' : 'Save Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE BALANCED JOURNAL ENTRY */}
        {isJournalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="card w-full max-w-2xl p-6 border-border shadow-xl bg-card my-8">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Create Double-Entry Journal Transaction</h3>
                  <p className="text-xs text-muted-foreground">Debits must equal credits to preserve ledger integrity</p>
                </div>
                <button onClick={() => setIsJournalModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateJournal} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Posting Date</label>
                    <input
                      type="date"
                      required
                      value={journalDate}
                      onChange={(e) => setJournalDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Description / Memo</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Monthly rent, Owner cash injection"
                      value={journalDesc}
                      onChange={(e) => setJournalDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                </div>

                {/* Line items editor */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Entry Line Items</span>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Leg
                    </button>
                  </div>

                  <div className="space-y-2">
                    {journalLines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-accent/20">
                        {/* Account Selector */}
                        <div className="flex-1">
                          <select
                            required
                            value={line.accountId}
                            onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs"
                          >
                            <option value="">Select Account...</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.code} — {acc.name} ({acc.type})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Debit */}
                        <div className="w-28">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Debit ($)"
                            value={line.debit || ''}
                            onChange={(e) => handleLineChange(idx, 'debit', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs font-mono text-right"
                          />
                        </div>

                        {/* Credit */}
                        <div className="w-28">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Credit ($)"
                            value={line.credit || ''}
                            onChange={(e) => handleLineChange(idx, 'credit', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs font-mono text-right"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real-time Double-Entry Balancer */}
                <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-mono ${isModalBalanced ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                  <div className="flex items-center gap-2">
                    {isModalBalanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>
                      {isModalBalanced
                        ? 'Entry is balanced! Ready to save in DRAFT state.'
                        : `Out of balance by $${modalDifference.toFixed(2)} (Debits must equal Credits)`}
                    </span>
                  </div>
                  <div>
                    Debits: <strong>${modalTotalDebit.toFixed(2)}</strong> · Credits: <strong>${modalTotalCredit.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsJournalModalOpen(false)}
                    className="btn btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isModalBalanced || createJournalMutation.isPending}
                    className="btn text-xs shadow-sm shadow-primary/20 disabled:opacity-50"
                  >
                    {createJournalMutation.isPending ? 'Saving...' : 'Create Draft Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
