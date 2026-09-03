'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type {
  LoyaltyProgramConfigDto,
  LoyaltyTransactionDto,
  StoreCreditTransactionDto,
  UpdateLoyaltyConfigInput,
  AdjustLoyaltyPointsInput,
  AdjustStoreCreditInput,
} from '@mystore/contracts';
import {
  Award,
  Coins,
  CreditCard,
  Users,
  Settings2,
  TrendingUp,
  Plus,
  X,
  History,
  CheckCircle2,
  AlertCircle,
  Crown,
  Sparkles,
} from 'lucide-react';

export default function LoyaltyPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<'POINTS' | 'CREDIT' | 'CONFIG'>('POINTS');
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'POINTS' | 'CREDIT'>('POINTS');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(50);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Config Form State
  const [earnRate, setEarnRate] = useState(1.0);
  const [redeemRate, setRedeemRate] = useState(0.01);
  const [minPointsRedeem, setMinPointsRedeem] = useState(50);
  const [isConfigActive, setIsConfigActive] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Queries
  const { data: config } = useQuery({
    queryKey: ['loyaltyConfig'],
    queryFn: async () => {
      const res = await api.getLoyaltyConfig(token!);
      if (!configLoaded) {
        setEarnRate(res.earnRate);
        setRedeemRate(res.redeemRate);
        setMinPointsRedeem(res.minPointsRedeem);
        setIsConfigActive(res.isActive);
        setConfigLoaded(true);
      }
      return res;
    },
    enabled: Boolean(token),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.listCustomers(token!, { limit: 100 }),
    enabled: Boolean(token),
  });

  const { data: pointsTransactions = [], isLoading: isPointsLoading } = useQuery({
    queryKey: ['loyaltyPointsTransactions'],
    queryFn: () => api.listLoyaltyTransactions(token!),
    enabled: Boolean(token) && activeTab === 'POINTS',
  });

  const { data: creditTransactions = [], isLoading: isCreditLoading } = useQuery({
    queryKey: ['storeCreditTransactions'],
    queryFn: () => api.listStoreCreditTransactions(token!),
    enabled: Boolean(token) && activeTab === 'CREDIT',
  });

  const customers = customersData?.items || [];

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: (input: UpdateLoyaltyConfigInput) => api.updateLoyaltyConfig(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyaltyConfig'] });
      alert('Loyalty program configuration updated successfully');
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to update config');
    },
  });

  const adjustPointsMutation = useMutation({
    mutationFn: (input: AdjustLoyaltyPointsInput) => api.adjustLoyaltyPoints(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyaltyPointsTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsAdjustOpen(false);
      resetAdjustForm();
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to adjust points');
    },
  });

  const adjustCreditMutation = useMutation({
    mutationFn: (input: AdjustStoreCreditInput) => api.adjustStoreCredit(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storeCreditTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsAdjustOpen(false);
      resetAdjustForm();
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to adjust store credit');
    },
  });

  const resetAdjustForm = () => {
    setSelectedCustomerId('');
    setAdjustAmount(50);
    setAdjustNotes('');
    setFormError(null);
  };

  // KPIs
  const totalPointsCirculating = customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);
  const totalStoreCreditBalance = customers.reduce((sum, c) => sum + Number(c.storeCredit || 0), 0);
  const platinumMembers = customers.filter((c) => c.loyaltyTier === 'PLATINUM').length;

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Award className="w-6 h-6 text-primary" />
              Customer Loyalty & Store Credit Platform
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Reward member tiers (Bronze ➔ Platinum), points earn/burn rules & store credit ledger
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetAdjustForm();
              setIsAdjustOpen(true);
            }}
            className="btn flex items-center gap-2 text-sm shadow-md"
          >
            <Plus className="w-4 h-4" />
            Adjust Balance
          </button>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Enrolled Members</p>
                <p className="text-xl font-bold text-foreground font-mono">{customers.length}</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Points in Circulation</p>
                <p className="text-xl font-bold text-amber-400 font-mono">
                  {totalPointsCirculating.toLocaleString()} pts
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Outstanding Store Credit</p>
                <p className="text-xl font-bold text-emerald-400 font-mono">
                  ${totalStoreCreditBalance.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Platinum VIPs</p>
                <p className="text-xl font-bold text-purple-400 font-mono">{platinumMembers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-border pb-2 text-xs">
          <button
            onClick={() => setActiveTab('POINTS')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'POINTS'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Points Ledger
          </button>
          <button
            onClick={() => setActiveTab('CREDIT')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'CREDIT'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Store Credit Ledger
          </button>
          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'CONFIG'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Program Rules & Tiers
          </button>
        </div>

        {/* Tab 1: Points Ledger */}
        {activeTab === 'POINTS' && (
          <div className="card border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer ID</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Points Delta</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isPointsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        Loading loyalty points ledger...
                      </td>
                    </tr>
                  ) : pointsTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No points transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    pointsTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground font-semibold">
                          {tx.customerId}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.type === 'EARN'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : tx.type === 'REDEEM'
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 font-mono font-bold ${
                            tx.points >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.points >= 0 ? `+${tx.points}` : tx.points} pts
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground">{tx.balanceAfter} pts</td>
                        <td className="py-3 px-4 text-muted-foreground">{tx.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Store Credit Ledger */}
        {activeTab === 'CREDIT' && (
          <div className="card border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount Delta</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isCreditLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        Loading store credit transactions...
                      </td>
                    </tr>
                  ) : creditTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No store credit transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    creditTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground font-semibold">
                          {tx.customerId}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.type === 'CREDIT'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 font-mono font-bold ${
                            tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.amount >= 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground">${tx.balanceAfter.toFixed(2)}</td>
                        <td className="py-3 px-4 text-muted-foreground">{tx.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Program Rules & Tier Configuration */}
        {activeTab === 'CONFIG' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rules Editor */}
            <div className="card p-5 border-border bg-card space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Settings2 className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Program Parameters</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground font-semibold block mb-1">
                    Earn Rate (Points per $1 spent)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={earnRate}
                    onChange={(e) => setEarnRate(parseFloat(e.target.value) || 1.0)}
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground font-semibold block mb-1">
                    Redemption Rate ($ discount per point, e.g. 0.01 = $1 per 100 pts)
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={redeemRate}
                    onChange={(e) => setRedeemRate(parseFloat(e.target.value) || 0.01)}
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground font-semibold block mb-1">
                    Minimum Points Required to Redeem
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={minPointsRedeem}
                    onChange={(e) => setMinPointsRedeem(parseInt(e.target.value) || 50)}
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <span className="font-semibold text-foreground">Loyalty Program Active</span>
                  <input
                    type="checkbox"
                    checked={isConfigActive}
                    onChange={(e) => setIsConfigActive(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-border cursor-pointer"
                  />
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    disabled={updateConfigMutation.isPending}
                    onClick={() =>
                      updateConfigMutation.mutate({
                        earnRate,
                        redeemRate,
                        minPointsRedeem,
                        isActive: isConfigActive,
                      })
                    }
                    className="btn w-full py-2 text-xs"
                  >
                    {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </div>
            </div>

            {/* Tier Multipliers Breakdown */}
            <div className="card p-5 border-border bg-card space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Crown className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-foreground">VIP Tier Progression</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg border border-border bg-muted/10 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-amber-600 block">BRONZE (Default)</span>
                    <span className="text-[11px] text-muted-foreground">Annual spend $0 - $499</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">1.0x Points</span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/10 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-300 block">SILVER VIP</span>
                    <span className="text-[11px] text-muted-foreground">Annual spend $500 - $1,499</span>
                  </div>
                  <span className="font-mono font-bold text-primary">1.25x Points</span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/10 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-amber-400 block">GOLD VIP</span>
                    <span className="text-[11px] text-muted-foreground">Annual spend $1,500 - $4,999</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400">1.5x Points</span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-purple-500/10 border-purple-500/20 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-purple-400 block flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> PLATINUM ELITE
                    </span>
                    <span className="text-[11px] text-muted-foreground">Annual spend $5,000+</span>
                  </div>
                  <span className="font-mono font-bold text-purple-400">2.0x Points</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Adjustment Modal */}
        {isAdjustOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-md w-full p-6 border-border shadow-2xl bg-card">
              <div className="flex justify-between items-center pb-3 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Manual Account Adjustment</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="p-1 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                  {formError}
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Select Customer
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.loyaltyTier || 'BRONZE'} • {c.loyaltyPoints || 0} pts • $
                        {Number(c.storeCredit || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('POINTS')}
                    className={`py-2 rounded-lg font-semibold border ${
                      adjustType === 'POINTS'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    Loyalty Points
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('CREDIT')}
                    className={`py-2 rounded-lg font-semibold border ${
                      adjustType === 'CREDIT'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    Store Credit ($)
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Adjustment Amount (Use positive to add, negative to deduct)
                  </label>
                  <input
                    type="number"
                    step={adjustType === 'CREDIT' ? '0.01' : '1'}
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Audit Reason / Notes
                  </label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="e.g. VIP goodwill bonus or gift card issuance"
                    className="input w-full text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-5">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    !selectedCustomerId ||
                    adjustPointsMutation.isPending ||
                    adjustCreditMutation.isPending
                  }
                  onClick={() => {
                    if (adjustType === 'POINTS') {
                      adjustPointsMutation.mutate({
                        customerId: selectedCustomerId,
                        points: Math.round(adjustAmount),
                        notes: adjustNotes || undefined,
                      });
                    } else {
                      adjustCreditMutation.mutate({
                        customerId: selectedCustomerId,
                        amount: adjustAmount,
                        notes: adjustNotes || undefined,
                      });
                    }
                  }}
                  className="btn px-4 py-1.5 text-xs font-bold"
                >
                  {adjustPointsMutation.isPending || adjustCreditMutation.isPending
                    ? 'Saving...'
                    : 'Apply Adjustment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
