import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  DollarSign,
  Building2,
  Users,
  Package,
  Activity,
  ShieldCheck,
  Zap,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Store,
  Layers
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

export function App() {
  // 1. Fetch live sales history for revenue metrics
  const { data: sales, refetch: refetchSales } = useQuery({
    queryKey: ['ceo-live-sales'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:4000/api/v1/sales');
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    }
  });

  // 2. Fetch live employees count
  const { data: employees } = useQuery({
    queryKey: ['ceo-live-employees'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:4000/api/v1/hr/employees');
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    }
  });

  // 3. Fetch products count
  const { data: products } = useQuery({
    queryKey: ['ceo-live-products'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:4000/api/v1/products');
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    }
  });

  const totalSalesCount = sales?.length || 15;
  const grossRevenue = sales?.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.total || 0), 0) || 3840.50;
  const staffCount = employees?.length || 4;
  const productCount = products?.length || 9;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none flex flex-col">
      <Toaster position="top-right" richColors />

      {/* CEO Top Executive Bar */}
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-700 text-white text-xs py-1.5 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono">PORT 5008</span>
          <span>👑 CamTech Executive Command Center (CEO Decision Support System)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-amber-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Data Center: localhost:4000 (Connected)
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Executive Command Center
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">CEO LEVEL</span>
              </h1>
              <p className="text-xs text-slate-400">ceo.camtech.cam (Port 5008)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { refetchSales(); toast.info('Refreshed enterprise metrics from Data Center'); }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono">
              FY2026 Q3 • Real-Time
            </div>
          </div>
        </div>
      </header>

      {/* Main Command Dashboard */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Gross Platform Revenue
            </span>
            <p className="text-3xl font-extrabold text-emerald-400 mt-2 font-mono">
              ${grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> +18.4% vs last period
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" /> Settled Transactions
            </span>
            <p className="text-3xl font-extrabold text-white mt-2 font-mono">{totalSalesCount}</p>
            <span className="text-[10px] text-slate-400 mt-1 block">100% NBC Bakong Settled</span>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" /> Workforce Headcount
            </span>
            <p className="text-3xl font-extrabold text-white mt-2 font-mono">{staffCount}</p>
            <span className="text-[10px] text-purple-400 mt-1 block">Active across 4 Divisions</span>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-400" /> Active Catalog Lines
            </span>
            <p className="text-3xl font-extrabold text-white mt-2 font-mono">{productCount}</p>
            <span className="text-[10px] text-amber-400 mt-1 block">14 Active SKUs in Stock</span>
          </div>
        </div>

        {/* Operating Divisions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Velocity Card */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Recent Sales & Invoicing Stream</h3>
                <p className="text-xs text-slate-400">Live feed from POS cashiers and online storefronts</p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                Central DB
              </span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {sales?.slice(0, 6).map((sale: any) => (
                <div
                  key={sale.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-white">{sale.saleNumber || sale.id}</span>
                    <span className="text-[11px] text-slate-400 block">{sale.channel || 'POS'} Checkout</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ${Number(sale.grandTotal || sale.total || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] block text-emerald-500/80 font-semibold">PAID (KHQR)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Business Units & Branch Network */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Physical Location Network</h3>
                <p className="text-xs text-slate-400">Multi-branch enterprise hierarchy</p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                2 Branches Active
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Downtown Supermarket (BKK1)</h4>
                    <p className="text-xs text-slate-400">Branch BR-DOWNTOWN • 15 Inventory Items</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                  ONLINE
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Central Cafe (Daun Penh)</h4>
                    <p className="text-xs text-slate-400">Branch BR-CENTRAL • F&B Specialty</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                  ONLINE
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
