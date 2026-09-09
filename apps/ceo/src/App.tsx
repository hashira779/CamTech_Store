import { useMemo } from 'react';
import {
  DollarSign,
  Users,
  Package,
  Activity,
  ShieldCheck,
  Radio,
  Boxes,
  Truck,
  CircleDot,
  ArrowUpRight
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

import { useDashboardData } from './hooks/useDashboardData';
import { money, compactMoney, num } from './lib/format';
import { StatTile, ExecutionCard, TrendBars } from '@mystore/ui';
import { TopHeader } from './components/TopHeader';
import { SalesStream } from './components/SalesStream';
import { AlertsPanel, type AlertItem } from './components/AlertsPanel';
import { EcosystemPanel } from './components/EcosystemPanel';

export function App() {
  const d = useDashboardData();

  const alerts: AlertItem[] = useMemo(
    () => [
      {
        tone: 'ok',
        title: 'Bakong settlement healthy',
        body: `${d.totalSalesCount} transactions cleared via NBC Bakong with 100% success.`,
        time: 'live'
      },
      {
        tone: 'info',
        title: 'Catalog synced with ERP',
        body: `${d.productCount} authoritative SKUs are live across POS and storefront.`,
        time: '2m'
      },
      {
        tone: 'warn',
        title: 'Reorder point approaching',
        body: 'Fast-moving lines are within 8% of their safety stock threshold.',
        time: '18m'
      },
      {
        tone: 'ok',
        title: 'Workforce console verified',
        body: `${d.staffCount} staff records reconciled with the HR data center.`,
        time: '1h'
      }
    ],
    [d.totalSalesCount, d.productCount, d.staffCount]
  );

  return (
    <div className="min-h-screen text-slate-100 font-sans selection:bg-brand-500/30">
      <Toaster position="top-right" richColors theme="dark" />

      <TopHeader
        onRefresh={() => {
          d.refetch();
          toast.success('Enterprise metrics refreshed from Data Center');
        }}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-7 space-y-6">
        {/* Page intro */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="ds-eyebrow">Enterprise overview</p>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">Real-time performance across every domain</h2>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            All systems operational
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            icon={DollarSign}
            tint="#34d399"
            label="Gross platform revenue"
            value={money(d.grossRevenue)}
            loading={d.loading.sales}
            delta="18.4%"
            deltaUp
            spark={d.trend.data}
          />
          <StatTile
            icon={Activity}
            tint="#38bdf8"
            label="Settled transactions"
            value={num(d.totalSalesCount)}
            loading={d.loading.sales}
            delta="9.1%"
            deltaUp
            note="100% NBC Bakong settled"
          />
          <StatTile
            icon={Users}
            tint="#a78bfa"
            label="Workforce headcount"
            value={num(d.staffCount)}
            loading={d.loading.staff}
            note={d.staffCount > 0 ? `${d.staffCount} verified staff` : 'Console active'}
          />
          <StatTile
            icon={Package}
            tint="#fbbf24"
            label="Active catalog lines"
            value={num(d.productCount)}
            loading={d.loading.products}
            note={d.productCount > 0 ? `${d.productCount} authoritative SKUs` : 'Synced with ERP'}
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left column */}
          <div className="xl:col-span-8 space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-brand-400" />
                  Operational execution
                </h3>
                <span className="ds-eyebrow">Health index · live</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ExecutionCard
                  icon={CircleDot}
                  color="#34d399"
                  title="Order settlement"
                  subtitle="POS & storefront checkout"
                  {...d.execution.settlement}
                />
                <ExecutionCard
                  icon={Boxes}
                  color="#38bdf8"
                  title="Catalog readiness"
                  subtitle="SKU availability vs demand"
                  {...d.execution.catalog}
                />
                <ExecutionCard
                  icon={Truck}
                  color="#a78bfa"
                  title="Fulfilment SLA"
                  subtitle="Delivery & dispatch"
                  {...d.execution.fulfilment}
                />
              </div>
            </section>

            <section className="ds-card p-4 sm:p-5">
              <div className="flex items-start justify-between mb-5 gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">Revenue trend</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Last 7 days · gross settled value</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="ds-figure text-lg text-white">{compactMoney(d.grossRevenue)}</p>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1 justify-end">
                    <ArrowUpRight className="w-3 h-3" /> trending up
                  </p>
                </div>
              </div>
              {d.loading.sales ? (
                <div className="h-32 rounded-xl bg-ink-800 animate-pulse" />
              ) : (
                <TrendBars data={d.trend.data} labels={d.trend.labels} />
              )}
            </section>

            <SalesStream sales={d.sales} loading={d.loading.sales} />
          </div>

          {/* Right column */}
          <div className="xl:col-span-4 space-y-6">
            <AlertsPanel alerts={alerts} />
            <EcosystemPanel apps={d.apps} loading={d.loading.registry} />
          </div>
        </div>
      </main>

      <footer className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex items-center justify-between text-[11px] text-slate-600 border-t border-line mt-4 gap-2">
        <span className="truncate">CamTech Executive Control Tower · ceo.camtech.cam</span>
        <span className="font-mono shrink-0">v0.2 · unified design system</span>
      </footer>
    </div>
  );
}

export default App;
