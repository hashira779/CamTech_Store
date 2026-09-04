'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { PageSkeleton } from '@/components/page-skeleton';
import type { ReportExportType } from '@mystore/contracts';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Building2,
  Boxes,
  ShoppingBag,
  CreditCard,
  AlertTriangle,
  Percent,
  RefreshCw,
  Coins,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

type DatePreset = 'TODAY' | '7D' | '30D' | 'THIS_MONTH' | 'ALL';

export default function ReportsPage() {
  const { token } = useAuth();

  const [datePreset, setDatePreset] = useState<DatePreset>('30D');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PRODUCTS' | 'INVENTORY' | 'BRANCHES'>('OVERVIEW');
  const [isExporting, setIsExporting] = useState(false);

  // Compute date range based on preset
  const getDateRange = () => {
    const now = new Date();
    if (datePreset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (datePreset === '7D') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (datePreset === '30D') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (datePreset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    return {};
  };

  const dateRange = getDateRange();

  // Queries
  const { data: locationsData } = useQuery({
    queryKey: ['locationsList'],
    queryFn: () => api.listLocations(token!),
    enabled: Boolean(token),
  });
  const locations = locationsData?.items || [];

  const {
    data: report,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['executiveReport', datePreset, selectedLocationId],
    queryFn: () =>
      api.getExecutiveReport(token!, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        locationId: selectedLocationId || undefined,
      }),
    enabled: Boolean(token),
  });

  // Export CSV handler
  const handleExportCsv = async (type: ReportExportType) => {
    if (!token) return;
    try {
      setIsExporting(true);
      const res = await api.exportReportCsv(token, {
        type,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        locationId: selectedLocationId || undefined,
      });

      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Failed to export CSV: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  if (!token) return null;

  const sales = report?.sales;
  const inventory = report?.inventory;
  const topProducts = report?.topProducts || [];
  const payments = report?.payments || [];
  const branches = report?.branches || [];
  const timeSeries = report?.timeSeries || [];

  const maxSeriesRev = Math.max(...timeSeries.map((t) => t.revenue), 1);

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Reporting & Analytics Studio
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Real-time multi-dimensional operational intelligence, sales margins, and asset valuation.
            </p>
          </div>

          {/* Export Action & Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => refetch()}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <div className="relative inline-block text-left">
              <button
                disabled={isExporting}
                onClick={() => handleExportCsv('SALES')}
                className="btn btn-secondary flex items-center gap-2 text-sm shadow-sm"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting...' : 'Export Sales CSV'}
              </button>
            </div>
            <button
              disabled={isExporting}
              onClick={() => handleExportCsv('INVENTORY')}
              className="btn flex items-center gap-2 text-sm shadow-sm shadow-primary/20"
            >
              <Download className="w-4 h-4" />
              Export Inventory CSV
            </button>
          </div>
        </div>

        {/* Global Filters & Presets Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          {/* Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mr-2">
              <Calendar className="w-3.5 h-3.5" /> Range:
            </span>
            {(['TODAY', '7D', '30D', 'THIS_MONTH', 'ALL'] as DatePreset[]).map((preset) => {
              const labels: Record<DatePreset, string> = {
                TODAY: 'Today',
                '7D': 'Last 7 Days',
                '30D': 'Last 30 Days',
                THIS_MONTH: 'This Month',
                ALL: 'All Time',
              };
              const active = datePreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          {/* Location / Branch Filter */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">All Locations / Global HQ</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Grid & Main Content */}
        {isLoading ? (
          <PageSkeleton variant="dashboard" showKpis={true} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Net Sales */}
          <div className="card p-5 border-border shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Net Sales Revenue
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground font-mono">
                ${sales?.netRevenue.toFixed(2) ?? '0.00'}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Gross: ${sales?.grossRevenue.toFixed(2) ?? '0.00'} · Tax: ${sales?.taxTotal.toFixed(2) ?? '0.00'}
              </p>
            </div>
          </div>

          {/* Gross Margin */}
          <div className="card p-5 border-border shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Gross Profit & Margin
              </span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground font-mono flex items-baseline gap-2">
                <span>${sales?.grossMargin.toFixed(2) ?? '0.00'}</span>
                <span className="text-sm font-semibold text-primary">
                  ({sales?.grossMarginPct.toFixed(1) ?? '0.0'}%)
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                COGS: ${sales?.cogs.toFixed(2) ?? '0.00'}
              </p>
            </div>
          </div>

          {/* Orders & AOV */}
          <div className="card p-5 border-border shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Orders & Basket Value
              </span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground font-mono flex items-baseline gap-2">
                <span>{sales?.orderCount ?? 0}</span>
                <span className="text-xs text-muted-foreground font-normal">orders</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                Avg Order Value: ${sales?.averageOrderValue.toFixed(2) ?? '0.00'}
              </p>
            </div>
          </div>

          {/* Inventory Valuation */}
          <div className="card p-5 border-border shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Inventory Asset Value
              </span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground font-mono">
                ${inventory?.totalAssetCostValue.toFixed(2) ?? '0.00'}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px]">
                <span className="text-muted-foreground font-mono">
                  Retail: ${inventory?.totalPotentialRetailValue.toFixed(2) ?? '0.00'}
                </span>
                {inventory && inventory.lowStockItemCount > 0 && (
                  <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3 inline" /> {inventory.lowStockItemCount} low
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'OVERVIEW'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Sales Overview & Payments
          </button>
          <button
            onClick={() => setActiveTab('PRODUCTS')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'PRODUCTS'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Product & Margin Rankings
          </button>
          <button
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'INVENTORY'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Inventory Asset Health
          </button>
          <button
            onClick={() => setActiveTab('BRANCHES')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'BRANCHES'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Branch Performance
          </button>
        </div>

        {/* TAB 1: OVERVIEW & PAYMENTS */}
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Velocity Timeline Bar Chart */}
            <div className="lg:col-span-2 card p-6 border-border shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Sales Velocity Trend</h3>
                  <p className="text-xs text-muted-foreground">Daily revenue performance across selected interval</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Revenue ($)
                </div>
              </div>

              {timeSeries.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl">
                  <ShoppingBag className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">No completed sales recorded in this period</p>
                  <p className="text-xs text-muted-foreground mt-1">Try selecting a broader date range above.</p>
                </div>
              ) : (
                <div className="h-64 flex items-end gap-2 pt-6 border-b border-border pb-2 overflow-x-auto">
                  {timeSeries.map((point) => {
                    const heightPct = Math.max(Math.round((point.revenue / maxSeriesRev) * 100), 8);
                    return (
                      <div key={point.date} className="flex-1 min-w-[36px] flex flex-col items-center gap-1 group">
                        <div className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                          ${point.revenue.toFixed(0)}
                        </div>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full bg-primary/80 hover:bg-primary rounded-t transition-all cursor-pointer relative"
                          title={`${point.date}: $${point.revenue.toFixed(2)} (${point.orders} orders)`}
                        />
                        <span className="text-[10px] text-muted-foreground font-mono truncate w-full text-center">
                          {point.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 mt-2">
                <span>Orders Captured: <strong className="text-foreground">{sales?.orderCount ?? 0}</strong></span>
                <span>Average Daily Revenue: <strong className="text-foreground font-mono">${(timeSeries.length > 0 ? (sales?.netRevenue || 0) / timeSeries.length : 0).toFixed(2)}</strong></span>
              </div>
            </div>

            {/* Payment Tender Distribution Card */}
            <div className="card p-6 border-border shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Payment Methods</h3>
                  <p className="text-xs text-muted-foreground">Tender volume & settlement breakdown</p>
                </div>
                <CreditCard className="w-4 h-4 text-muted-foreground" />
              </div>

              {payments.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl">
                  <Coins className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">No payments recorded</p>
                </div>
              ) : (
                <div className="space-y-4 my-auto">
                  {payments.map((p) => {
                    const badgeStyles: Record<string, string> = {
                      CASH: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      BAKONG_KHQR: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                      KHQR: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                      CARD: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                      STORE_CREDIT: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                    };
                    return (
                      <div key={p.method} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                badgeStyles[p.method] || 'bg-accent text-foreground'
                              }`}
                            >
                              {p.method}
                            </span>
                            <span className="text-muted-foreground">{p.count} txns</span>
                          </div>
                          <span className="font-mono font-bold text-foreground">
                            ${p.totalAmount.toFixed(2)} ({p.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-accent h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${p.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TOP PRODUCTS & MARGIN RANKINGS */}
        {activeTab === 'PRODUCTS' && (
          <div className="card border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-foreground">Top Performing Products</h3>
                <p className="text-xs text-muted-foreground">Ranked by gross revenue and contribution margins</p>
              </div>
              <button
                onClick={() => handleExportCsv('PRODUCTS')}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export Products
              </button>
            </div>

            {topProducts.length === 0 ? (
              <div className="p-12 text-center">
                <Boxes className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No product sales in selected interval</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-accent/40 text-muted-foreground">
                      <th className="p-3 font-semibold uppercase tracking-wider">#</th>
                      <th className="p-3 font-semibold uppercase tracking-wider">SKU & Item Name</th>
                      <th className="p-3 font-semibold uppercase tracking-wider">Category</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-right">Units Sold</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-right">Revenue</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-right">COGS</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-right">Gross Margin</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topProducts.map((prod, idx) => (
                      <tr key={prod.variantId} className="hover:bg-accent/30 transition-colors">
                        <td className="p-3 text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{prod.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{prod.sku}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{prod.categoryName || 'General'}</td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">{prod.unitsSold}</td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          ${prod.revenue.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          ${prod.cogs.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">
                          ${prod.margin.toFixed(2)}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              prod.marginPct >= 40
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : prod.marginPct >= 20
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {prod.marginPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INVENTORY ASSET HEALTH */}
        {activeTab === 'INVENTORY' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5 border-border shadow-sm">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Active SKUs
                </span>
                <div className="text-2xl font-bold text-foreground font-mono mt-2">
                  {inventory?.totalSkuCount ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Catalog items tracked across warehouses</p>
              </div>

              <div className="card p-5 border-border shadow-sm">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Units on Hand
                </span>
                <div className="text-2xl font-bold text-foreground font-mono mt-2">
                  {inventory?.totalUnitsOnHand ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Physical units in storage & branches</p>
              </div>

              <div className="card p-5 border-border shadow-sm">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Potential Retail Value
                </span>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-2">
                  ${inventory?.totalPotentialRetailValue.toFixed(2) ?? '0.00'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Cost: ${inventory?.totalAssetCostValue.toFixed(2) ?? '0.00'}
                </p>
              </div>
            </div>

            {/* Inventory Alerts Card */}
            <div className="card p-6 border-border shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Stockout & Replenishment Watchlist</h4>
                  <p className="text-xs text-muted-foreground">
                    {inventory?.lowStockItemCount ?? 0} items below reorder point · {inventory?.outOfStockCount ?? 0} items completely out of stock.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleExportCsv('INVENTORY')}
                className="btn btn-secondary text-xs flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" /> Export Stock Audit
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: BRANCH PERFORMANCE */}
        {activeTab === 'BRANCHES' && (
          <div className="card border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Revenue by Branch Location</h3>
              <p className="text-xs text-muted-foreground">Comparative sales volume and transaction efficiency</p>
            </div>

            {branches.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No branch transactions recorded in selected interval</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {branches.map((b) => (
                  <div key={b.locationId} className="p-4 flex items-center justify-between hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{b.locationName}</h4>
                        <p className="text-xs text-muted-foreground">{b.orderCount} completed transactions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold font-mono text-foreground">${b.revenue.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground font-mono">AOV: ${b.aov.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </EnterpriseShell>
  );
}
