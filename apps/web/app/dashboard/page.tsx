'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  AlertTriangle,
  Users,
  Plus,
  ArrowRight,
  Boxes,
  Receipt,
  DollarSign,
} from 'lucide-react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d');

  // Server-backed dashboard metrics (current vs comparison period, alerts, freshness)
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['business-dashboard', chartRange === '7d' ? 7 : 30],
    queryFn: () => api.getBusinessDashboard(token!, chartRange === '7d' ? 7 : 30),
    enabled: Boolean(token),
  });

  const periodLabel = dashboard?.period.label ?? 'Last 30 days';
  const currency = dashboard?.currency ?? 'USD';
  const freshness = dashboard?.generatedAt
    ? new Date(dashboard.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Recent transactions feed (separate from the aggregated metrics)
  const { data: salesData } = useQuery({
    queryKey: ['dashboard-sales'],
    queryFn: () => api.listSales(token!, { limit: 50 }),
    enabled: Boolean(token),
  });

  if (!token) return <Navigate to="/login" replace />;

  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });
  const totalRevenue = dashboard?.metrics.revenue.value ?? 0;
  const chartData = (dashboard?.timeSeries ?? []).map((point) => ({
    ...point,
    date: new Date(`${point.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
  const channelBreakdown = (dashboard?.branches ?? []).map((branch) => ({
    name: branch.locationName,
    amount: branch.revenue,
    count: branch.orderCount,
  }));

  return (
    <EnterpriseShell>
      <div className="space-y-8">
        {/* Page Header */}
        <PageHeader
          title="Executive Command Center"
          description={`Operational intelligence for ${user?.name}${freshness ? ` · updated ${freshness}` : ''}.`}
          badge={
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 text-xs">
              {periodLabel}
            </Badge>
          }
        >
          <Button
            onClick={() => navigate('/inventory')}
            variant="outline"
            size="sm"
            className="hidden sm:flex gap-2"
          >
            <Boxes className="h-4 w-4 text-muted-foreground" />
            Stock Ledger
          </Button>
          <Button
            onClick={() => navigate('/sales/new')}
            size="sm"
            className="gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Open POS Terminal
          </Button>
        </PageHeader>

        {/* Primary Enterprise KPI Metrics Grid (Adaptive 4-col) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="Total Revenue"
            value={money.format(dashboard?.metrics.revenue.value ?? 0)}
            change={dashboard?.metrics.revenue.changePct ?? undefined}
            changeLabel={dashboard?.metrics.revenue.changePct != null ? "vs comparison period" : "current period"}
            icon={DollarSign}
            iconColor="text-emerald-500"
            isLoading={dashboardLoading}
          />
          <KpiCard
            title="Completed Orders"
            value={dashboard?.metrics.orders.value ?? 0}
            change={dashboard?.metrics.orders.changePct ?? undefined}
            changeLabel={dashboard?.metrics.orders.changePct != null ? "vs comparison period" : "current period"}
            icon={ShoppingBag}
            iconColor="text-blue-500"
            isLoading={dashboardLoading}
          />
          <KpiCard
            title="Average Order Value"
            value={money.format(dashboard?.metrics.averageOrderValue.value ?? 0)}
            change={dashboard?.metrics.averageOrderValue.changePct ?? undefined}
            changeLabel={dashboard?.metrics.averageOrderValue.changePct != null ? "vs comparison period" : "current period"}
            icon={Receipt}
            iconColor="text-indigo-500"
            isLoading={dashboardLoading}
          />
          <KpiCard
            title="Active Accounts"
            value={dashboard?.metrics.customers.value ?? 0}
            change={dashboard?.metrics.customers.changePct ?? undefined}
            changeLabel={dashboard?.metrics.customers.changePct != null ? "vs comparison period" : "registered"}
            icon={Users}
            iconColor="text-purple-500"
            isLoading={dashboardLoading}
          />
        </div>

        {/* Analytics Section: Revenue Trend & Channel Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Revenue Chart (8 cols) */}
          <Card className="lg:col-span-8 shadow-sm rounded-2xl border-border/80 bg-card/80 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">Sales Revenue Performance</CardTitle>
                <CardDescription className="text-xs">Daily revenue trajectory across all sales channels</CardDescription>
              </div>
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
                <Button
                  variant={chartRange === '7d' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartRange('7d')}
                  className="h-7 text-xs px-2.5 rounded-lg shadow-2xs font-semibold"
                >
                  Last 7 Days
                </Button>
                <Button
                  variant={chartRange === '30d' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartRange('30d')}
                  className="h-7 text-xs px-2.5 rounded-lg shadow-2xs font-semibold"
                >
                  Last 30 Days
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => money.format(Number(val))}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-1">
                              <p className="font-semibold text-muted-foreground">{label}</p>
                              <p className="text-base font-bold text-foreground tabular-nums">
                                {money.format(Number(payload[0].value))}
                              </p>
                              <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono font-semibold">
                                Gross Revenue
                              </span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Sales Channel Mix (4 cols) */}
          <Card className="lg:col-span-4 shadow-sm rounded-2xl border-border/80 bg-card/80 backdrop-blur-md flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Channel & Branch Mix</CardTitle>
                  <CardDescription className="text-xs">Revenue split across locations</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/5 text-primary border-primary/20">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {channelBreakdown.map((channel, idx) => {
                const pct = totalRevenue > 0 ? Math.round((channel.amount / totalRevenue) * 100) : 0;
                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500'];
                const color = colors[idx % colors.length];

                return (
                  <div key={idx} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                        <span className="font-semibold text-foreground truncate">{channel.name}</span>
                      </div>
                      <span className="font-mono font-bold text-foreground text-xs shrink-0 tabular-nums">
                        {money.format(channel.amount)} <span className="font-normal text-muted-foreground">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="p-3 rounded-xl border border-border/80 bg-muted/30 mt-4 text-xs text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Transactions synced
                </span>
                <Badge variant="secondary" className="font-mono text-[11px] font-bold">
                  {dashboard?.metrics.orders.value ?? 0} total
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2-Column Operational Grid: Recent Sales & Action Center */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Orders Ledger (7 cols) */}
          <Card className="lg:col-span-7 shadow-sm rounded-2xl border-border/80 bg-card/80 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">Recent Orders & Activity</CardTitle>
                <CardDescription className="text-xs">Live sales transactions across all branches</CardDescription>
              </div>
              <Link to="/sales">
                <Button variant="ghost" size="sm" className="text-xs text-primary gap-1 font-semibold hover:bg-primary/10">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {(salesData?.items ?? []).slice(0, 5).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors text-xs group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                        <ShoppingBag className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">{sale.saleNumber}</span>
                          <Badge variant="outline" className="text-[10px] uppercase px-1.5 py-0 font-mono">
                            {sale.channel || 'POS'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5 truncate">
                          {sale.customerName ?? 'Walk-in Customer'} · {sale.itemCount || 1} line item(s)
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-sm text-foreground tabular-nums">
                        ${sale.grandTotal.toFixed(2)}
                      </div>
                      <Badge
                        variant={sale.status === 'COMPLETED' ? 'success' : 'destructive'}
                        className="text-[10px] px-1.5 py-0 uppercase mt-0.5 font-semibold"
                      >
                        {sale.status}
                      </Badge>
                    </div>
                  </div>
                ))}

                {(salesData?.items ?? []).length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    No orders recorded yet. Start by generating a transaction in the POS!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actionable operational alerts (5 cols) */}
          <Card className="lg:col-span-5 shadow-sm rounded-2xl border-border/80 bg-card/80 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Action Center</CardTitle>
                    <CardDescription className="text-xs">Operational alerts & stock tasks</CardDescription>
                  </div>
                </div>
                {(dashboard?.alerts.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {dashboard?.alerts.length} pending
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {(dashboard?.alerts ?? []).map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.href}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs transition-all hover:-translate-y-0.5 shadow-2xs ${
                      alert.severity === 'critical'
                        ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
                        : alert.severity === 'warning'
                          ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                          : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-foreground">{alert.title}</p>
                      <p className="mt-0.5 text-muted-foreground line-clamp-1">{alert.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[11px] font-bold">
                        {alert.count}
                      </Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}

                {!dashboardLoading && (dashboard?.alerts.length ?? 0) === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <p className="font-medium text-emerald-500">No active operational alerts.</p>
                    <p className="text-xs text-muted-foreground mt-1">Inventory, approvals, and service queues are clear.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </EnterpriseShell>
  );
}
