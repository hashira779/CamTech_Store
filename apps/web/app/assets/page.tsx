'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type { FixedAssetDto, CreateFixedAssetInput, DepreciationMethod } from '@mystore/contracts';
import {
  Coins,
  Plus,
  RefreshCw,
  X,
  TrendingDown,
  Building,
  CheckCircle2,
} from 'lucide-react';

export default function AssetsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetCode, setAssetCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('EQUIPMENT');
  const [purchaseCost, setPurchaseCost] = useState('1200');
  const [usefulLifeMonths, setUsefulLifeMonths] = useState('36');
  const [method, setMethod] = useState<DepreciationMethod>('STRAIGHT_LINE');

  const { data: assets = [], refetch, isLoading } = useQuery({
    queryKey: ['fixedAssetsList'],
    queryFn: () => api.listAssets(token!),
    enabled: Boolean(token),
  });

  const createAssetMutation = useMutation({
    mutationFn: (input: CreateFixedAssetInput) => api.createAsset(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssetsList'] });
      setIsModalOpen(false);
      setAssetCode('');
      setName('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to create asset'),
  });

  const depreciateMutation = useMutation({
    mutationFn: (id: string) => api.runDepreciation(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixedAssetsList'] }),
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to depreciate asset'),
  });

  const totalCost = assets.reduce((acc, a) => acc + (a.purchaseCost ?? 0), 0);
  const totalBookValue = assets.reduce((acc, a) => acc + (a.currentBookValue ?? (a as any).bookValue ?? 0), 0);
  const totalAccumulated = assets.reduce((acc, a) => acc + (a.accumulatedDeprec ?? (a as any).accumulatedDepreciation ?? 0), 0);

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Coins className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Fixed Assets & Capitalization
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Capital equipment register, straight-line and declining-balance depreciation schedules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn flex items-center gap-1.5 text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" /> Capitalize Asset
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5 border-border shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total Initial Capitalization</span>
            <div className="text-2xl font-bold font-mono text-foreground mt-2">${totalCost.toFixed(2)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{assets.length} Registered Assets</p>
          </div>
          <div className="card p-5 border-border shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Current Net Book Value</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">${totalBookValue.toFixed(2)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Carried on Balance Sheet</p>
          </div>
          <div className="card p-5 border-border shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Accumulated Depreciation</span>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-2">-${totalAccumulated.toFixed(2)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Total Amortized Expense</p>
          </div>
        </div>

        {/* Assets Table */}
        <div className="card border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-accent/40 text-muted-foreground border-b border-border">
                  <th className="p-3 font-semibold uppercase tracking-wider">Asset Code</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Asset Name</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Category</th>
                  <th className="p-3 font-semibold uppercase tracking-wider text-right">Initial Cost</th>
                  <th className="p-3 font-semibold uppercase tracking-wider text-right">Accumulated</th>
                  <th className="p-3 font-semibold uppercase tracking-wider text-right">Net Book Value</th>
                  <th className="p-3 font-semibold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.map((a) => (
                  <tr key={a.id} className="hover:bg-accent/20 transition-colors">
                    <td className="p-3 font-mono font-bold text-foreground">{a.assetCode}</td>
                    <td className="p-3 font-medium text-foreground">
                      {a.name}
                      <div className="text-[10px] text-muted-foreground">{a.usefulLifeMonths} mo · {a.depreciationMethod}</div>
                    </td>
                    <td className="p-3 font-mono text-primary">{a.category}</td>
                    <td className="p-3 text-right font-mono font-bold text-foreground">${(a.purchaseCost ?? 0).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-rose-400">-${((a.accumulatedDeprec ?? (a as any).accumulatedDepreciation ?? 0)).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400">${((a.currentBookValue ?? (a as any).bookValue ?? 0)).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => depreciateMutation.mutate(a.id)}
                        disabled={depreciateMutation.isPending || ((a.currentBookValue ?? (a as any).bookValue ?? 0) <= (a.salvageValue ?? 0))}
                        className="btn py-1 px-2.5 text-[11px] shadow-sm disabled:opacity-50"
                      >
                        Depreciate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL: CAPITALIZE ASSET */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Capitalize Fixed Asset</h3>
                <button onClick={() => setIsModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createAssetMutation.mutate({
                  assetCode,
                  name,
                  category,
                  purchaseDate: new Date().toISOString(),
                  purchaseCost: parseFloat(purchaseCost) || 0,
                  usefulLifeMonths: parseInt(usefulLifeMonths) || 60,
                  depreciationMethod: method,
                });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Asset Code</label>
                  <input required value={assetCode} onChange={(e) => setAssetCode(e.target.value)} placeholder="e.g. FA-0012" className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Asset Name</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Server Rack Dell PowerEdge" className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background">
                    <option value="EQUIPMENT">EQUIPMENT (POS, Scanners, Cash Drawers)</option>
                    <option value="VEHICLE">VEHICLE (Delivery Vans, Motorcycles)</option>
                    <option value="BUILDING">BUILDING (Store Leasehold Improvements)</option>
                    <option value="IT">IT (Laptops, Servers, Routers)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block uppercase font-bold text-muted-foreground mb-1">Purchase Cost ($)</label>
                    <input type="number" step="0.01" min="1" required value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                  </div>
                  <div>
                    <label className="block uppercase font-bold text-muted-foreground mb-1">Useful Life (Months)</label>
                    <input type="number" min="1" required value={usefulLifeMonths} onChange={(e) => setUsefulLifeMonths(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createAssetMutation.isPending} className="btn">{createAssetMutation.isPending ? 'Capitalizing...' : 'Capitalize Asset'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
