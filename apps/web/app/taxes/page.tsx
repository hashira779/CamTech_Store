'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { TableSkeletonRows } from '@/components/page-skeleton';
import type {
  TaxRateDto,
  CreateTaxRateInput,
  UpdateTaxRateInput,
} from '@mystore/contracts';
import {
  Percent,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Calculator,
  ShieldCheck,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';

export default function TaxesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRateDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ratePct, setRatePct] = useState(10.0);
  const [isInclusive, setIsInclusive] = useState(false);
  const [isCompound, setIsCompound] = useState(false);

  // Simulator State
  const [simPrice, setSimPrice] = useState(100);
  const [simQty, setSimQty] = useState(1);
  const [simDiscount, setSimDiscount] = useState(0);
  const [simRate, setSimRate] = useState(10);
  const [simInclusive, setSimInclusive] = useState(false);

  // Queries
  const { data: taxRates = [], isLoading } = useQuery({
    queryKey: ['taxRates'],
    queryFn: () => api.listTaxRates(token!),
    enabled: Boolean(token),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (input: CreateTaxRateInput) => api.createTaxRate(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxRates'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create tax rate');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaxRateInput }) =>
      api.updateTaxRate(token!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxRates'] });
      setEditingRate(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to update tax rate');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateTaxRate(token!, id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxRates'] });
    },
  });

  const resetForm = () => {
    setCode('');
    setName('');
    setRatePct(10.0);
    setIsInclusive(false);
    setIsCompound(false);
    setFormError(null);
  };

  const handleOpenEdit = (rate: TaxRateDto) => {
    setEditingRate(rate);
    setCode(rate.code);
    setName(rate.name);
    setRatePct(rate.ratePct);
    setIsInclusive(rate.isInclusive);
    setIsCompound(rate.isCompound);
    setIsCreateOpen(true);
  };

  // KPI calculations
  const totalRates = taxRates.length;
  const activeRates = taxRates.filter((r) => r.isActive).length;
  const defaultVat = taxRates.find((r) => r.code === 'VAT-10')?.ratePct ?? 10.0;
  const inclusiveCount = taxRates.filter((r) => r.isInclusive).length;

  // Simulator math
  const simBase = Math.max(0, simPrice * simQty - simDiscount);
  let simNet = simBase;
  let simTax = 0;
  let simGross = simBase;

  if (simRate > 0) {
    if (simInclusive) {
      simNet = simBase / (1 + simRate / 100);
      simTax = simBase - simNet;
      simGross = simBase;
    } else {
      simTax = simBase * (simRate / 100);
      simGross = simBase + simTax;
    }
  }

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Percent className="w-6 h-6 text-primary" />
              Tax Rates & Fiscal Rules
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Standard VAT, sales tax, inclusive/exclusive pricing modes & compound fiscal calculations
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingRate(null);
              resetForm();
              setIsCreateOpen(true);
            }}
            className="btn flex items-center gap-2 text-sm shadow-md"
          >
            <Plus className="w-4 h-4" />
            New Tax Rate
          </button>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Configured Rates</p>
                <p className="text-xl font-bold text-foreground font-mono">{totalRates}</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Rates</p>
                <p className="text-xl font-bold text-emerald-400 font-mono">{activeRates}</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Standard VAT</p>
                <p className="text-xl font-bold text-blue-400 font-mono">{defaultVat.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Inclusive Rates</p>
                <p className="text-xl font-bold text-purple-400 font-mono">{inclusiveCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: Tax Rates Table + Live Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tax Rates Directory Table */}
          <div className="lg:col-span-2 card border-border bg-card overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-sm text-foreground">Tax Rates Directory</h3>
              <span className="text-xs text-muted-foreground">{taxRates.length} configured</span>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Percentage</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <TableSkeletonRows rows={5} cols={6} />
                  ) : taxRates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No tax rates found.
                      </td>
                    </tr>
                  ) : (
                    taxRates.map((rate) => (
                      <tr key={rate.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                          {rate.code}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">{rate.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-primary">
                          {rate.ratePct.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rate.isInclusive
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {rate.isInclusive ? 'INCLUSIVE (VAT)' : 'EXCLUSIVE (SALES)'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: rate.id,
                                isActive: !rate.isActive,
                              })
                            }
                            className="flex items-center gap-1.5 font-semibold text-[11px]"
                          >
                            {rate.isActive ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <ToggleRight className="w-4 h-4" /> Active
                              </span>
                            ) : (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <ToggleLeft className="w-4 h-4" /> Inactive
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rate)}
                            className="px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground font-medium text-xs"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Live Fiscal Simulator */}
          <div className="card border-border bg-card p-5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Calculator className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Fiscal Tax Simulator</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Simulate line items to test inclusive VAT extraction vs exclusive tax calculation.
              </p>

              <div className="space-y-3 mt-4 text-xs">
                <div>
                  <label className="text-muted-foreground font-medium block mb-1">Unit Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={simPrice}
                    onChange={(e) => setSimPrice(parseFloat(e.target.value) || 0)}
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={simQty}
                      onChange={(e) => setSimQty(parseInt(e.target.value) || 1)}
                      className="input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Discount ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={simDiscount}
                      onChange={(e) => setSimDiscount(parseFloat(e.target.value) || 0)}
                      className="input w-full font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={simRate}
                    onChange={(e) => setSimRate(parseFloat(e.target.value) || 0)}
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
                  <span className="font-semibold text-foreground">Inclusive VAT Mode</span>
                  <input
                    type="checkbox"
                    checked={simInclusive}
                    onChange={(e) => setSimInclusive(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-border cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Simulation Results Breakdown */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable Subtotal (Net)</span>
                <span className="font-mono font-bold text-foreground">${simNet.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Computed Tax ({simRate}%)</span>
                <span className="font-mono font-bold text-primary">${simTax.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm">
                <span className="font-bold text-foreground">Grand Total (Gross)</span>
                <span className="font-mono font-extrabold text-foreground">${simGross.toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                <Info className="w-3 h-3" />
                {simInclusive
                  ? 'Price is tax-inclusive. Tax extracted via Gross - (Gross / (1 + Rate)).'
                  : 'Price is tax-exclusive. Tax added on top via Net * Rate.'}
              </div>
            </div>
          </div>
        </div>

        {/* Create / Edit Tax Rate Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-md w-full p-6 border-border shadow-2xl bg-card">
              <div className="flex justify-between items-center pb-3 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">
                    {editingRate ? 'Edit Tax Rate' : 'New Tax Rate'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
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
                {!editingRate && (
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Tax Code (e.g. VAT-10, GST-8, EXEMPT)
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="VAT-10"
                      className="input w-full font-mono text-xs uppercase"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Tax Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Standard Value Added Tax"
                    className="input w-full text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Percentage Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={ratePct}
                    onChange={(e) => setRatePct(parseFloat(e.target.value) || 0)}
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInclusive}
                      onChange={(e) => setIsInclusive(e.target.checked)}
                      className="w-4 h-4 rounded text-primary border-border"
                    />
                    <span className="font-semibold text-foreground">
                      Inclusive Tax (Tax included in retail sell price)
                    </span>
                  </label>
                  <p className="text-[11px] text-muted-foreground pl-6">
                    When enabled, the sticker price already contains the tax. Recommended for consumer retail / B2C.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCompound}
                      onChange={(e) => setIsCompound(e.target.checked)}
                      className="w-4 h-4 rounded text-primary border-border"
                    />
                    <span className="font-semibold text-foreground">
                      Compound Tax (Cascades after primary tax)
                    </span>
                  </label>
                  <p className="text-[11px] text-muted-foreground pl-6">
                    Used for specific excise taxes (e.g. alcohol/tobacco surcharges).
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createMutation.isPending || updateMutation.isPending || (!editingRate && !code) || !name}
                  onClick={() => {
                    if (editingRate) {
                      updateMutation.mutate({
                        id: editingRate.id,
                        input: { name, ratePct, isInclusive, isCompound },
                      });
                    } else {
                      createMutation.mutate({
                        code,
                        name,
                        ratePct,
                        isInclusive,
                        isCompound,
                      });
                    }
                  }}
                  className="btn px-4 py-1.5 text-xs font-bold"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingRate
                    ? 'Update Rate'
                    : 'Create Tax Rate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
