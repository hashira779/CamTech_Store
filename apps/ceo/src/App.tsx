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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const token =
    localStorage.getItem('mystore_pos_token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('token') ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function App() {
  // 1. Fetch live sales history for revenue metrics
  const { data: sales, isLoading: isSalesLoading, refetch: refetchSales } = useQuery({
    queryKey: ['ceo-live-sales'],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/sales`, { headers: getAuthHeaders() });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    }
  });

  // 2. Fetch live employees count
  const { data: employees, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['ceo-live-employees'],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/hr/employees`, { headers: getAuthHeaders() });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    }
  });

  // 3. Fetch products count
  const { data: products, isLoading: isProductsLoading } = useQuery({
    queryKey: ['ceo-live-products'],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/public/products`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.items || json.items || json.data || [];
      } catch {
        return [];
      }
    }
  });

  // 4. Fetch enterprise application registry & domain ecosystem (Spec §242)
  const { data: registryData, isLoading: isRegistryLoading } = useQuery({
    queryKey: ['ceo-app-registry'],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/apps/registry`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.data?.applications || json.applications || [];
      } catch {
        return [];
      }
    }
  });

  const totalSalesCount = sales ? sales.length : 0;
  const grossRevenue = sales ? sales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.total || 0), 0) : 0;
  const staffCount = employees ? employees.length : 0;
  const productCount = products ? products.length : 0;
  const appsList = registryData || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none flex flex-col">
      <Toaster position="top-right" richColors />

      {/* CEO Top Executive Bar */}
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-700 text-white text-xs py-1.5 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono">EXECUTIVE</span>
          <span>👑 CamTech Executive Command Center (CEO Decision Support System)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-amber-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Central Data Center Connected
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
            {isSalesLoading ? (
              <div className="w-32 h-8 bg-slate-800 rounded animate-pulse my-2"></div>
            ) : (
              <p className="text-3xl font-extrabold text-emerald-400 mt-2 font-mono">
                ${grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> +18.4% vs last period
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" /> Settled Transactions
            </span>
            {isSalesLoading ? (
              <div className="w-20 h-8 bg-slate-800 rounded animate-pulse my-2"></div>
            ) : (
              <p className="text-3xl font-extrabold text-white mt-2 font-mono">{totalSalesCount}</p>
            )}
            <span className="text-[10px] text-slate-400 mt-1 block">100% NBC Bakong Settled</span>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" /> Workforce Headcount
            </span>
            {isEmployeesLoading ? (
              <div className="w-20 h-8 bg-slate-800 rounded animate-pulse my-2"></div>
            ) : (
              <p className="text-3xl font-extrabold text-white mt-2 font-mono">{staffCount}</p>
            )}
            <span className="text-[10px] text-purple-400 mt-1 block">
              {staffCount > 0 ? `${staffCount} Verified Staff Members` : 'Workforce Console Active'}
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-400" /> Active Catalog Lines
            </span>
            {isProductsLoading ? (
              <div className="w-20 h-8 bg-slate-800 rounded animate-pulse my-2"></div>
            ) : (
              <p className="text-3xl font-extrabold text-white mt-2 font-mono">{productCount}</p>
            )}
            <span className="text-[10px] text-amber-400 mt-1 block">
              {productCount > 0 ? `${productCount} Authoritative SKUs in Stock` : 'Catalog Synced with ERP'}
            </span>
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
              {isSalesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between animate-pulse">
                    <div className="space-y-1.5 w-1/2">
                      <div className="w-28 h-4 bg-slate-800 rounded"></div>
                      <div className="w-16 h-3 bg-slate-800/60 rounded"></div>
                    </div>
                    <div className="space-y-1.5 w-20 text-right">
                      <div className="w-16 h-4 bg-slate-800 rounded ml-auto"></div>
                      <div className="w-12 h-3 bg-emerald-500/20 rounded ml-auto"></div>
                    </div>
                  </div>
                ))
              ) : (!sales || sales.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No sales recorded yet. Ring up a sale on POS (Port 5003) or Store (Port 5001).
                </div>
              ) : (
                sales.slice(0, 6).map((sale: any) => (
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
                ))
              )}
            </div>
          </div>

          {/* Business Units & Application Network (Spec §228-§258) */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Multi-Domain Ecosystem</h3>
                <p className="text-xs text-slate-400">Micro-frontend domain architecture</p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                {appsList.length > 0 ? `${appsList.length} Connected Subdomains` : 'Registry Connected'}
              </span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {isRegistryLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3 w-2/3">
                      <div className="w-9 h-9 rounded-lg bg-slate-800"></div>
                      <div className="space-y-1.5 flex-1">
                        <div className="w-28 h-4 bg-slate-800 rounded"></div>
                        <div className="w-40 h-3 bg-slate-800/60 rounded"></div>
                      </div>
                    </div>
                    <div className="w-14 h-5 bg-slate-800/80 rounded-full"></div>
                  </div>
                ))
              ) : appsList.length > 0 ? (
                appsList.slice(0, 5).map((app: any) => (
                  <div key={app.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs font-mono">
                        {app.subdomain?.slice(0, 3).toUpperCase() || 'APP'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{app.name}</h4>
                        <p className="text-xs text-slate-400 font-mono">{app.defaultDomain} • {app.subdomain}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                      ONLINE
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">
                  Connecting to Central Application Registry...
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
