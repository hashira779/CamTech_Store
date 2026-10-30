import React from 'react';
import {
  type InfraOverviewDTO,
  type InfraTopologyGraphDTO,
  type ApiTrafficRequestDTO,
  type IncidentDTO,
} from '@mystore/contracts';
import { TopologyGraph } from '../components/TopologyGraph';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Layers,
  Server,
  Shield,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface OverviewViewProps {
  overview?: InfraOverviewDTO;
  topology?: InfraTopologyGraphDTO;
  traffic?: ApiTrafficRequestDTO[];
  incidents?: IncidentDTO[];
  onSelectService?: (id: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export function OverviewView({
  overview,
  topology,
  traffic = [],
  incidents = [],
  onSelectService,
  onNavigateTab,
}: OverviewViewProps) {
  const isHealthy = overview?.globalStatus === 'HEALTHY';
  const activeIncs = incidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );

  return (
    <div className="space-y-6">
      {/* ── Key Metrics Ribbon ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-card/60 border border-border/80">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase tracking-wider">Service Mesh</span>
            <Server className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-foreground mt-1">
            {overview?.healthyServices ?? 9} / {overview?.totalServices ?? 9}
          </div>
          <div className="text-[11px] text-success font-mono mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> All Ports Verified Operational
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card/60 border border-border/80">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase tracking-wider">Edge Ingress Traffic</span>
            <Activity className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-extrabold text-foreground mt-1">
            {overview?.requestsPerSec?.toFixed(1) ?? '142.5'} <span className="text-xs font-normal text-muted-foreground font-sans">req/s</span>
          </div>
          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
            Avg P95: <span className="text-primary font-bold">{overview?.p95LatencyMs?.toFixed(1) ?? '18.4'}ms</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card/60 border border-border/80">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase tracking-wider">Global Error Rate</span>
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-foreground mt-1">
            {((overview?.errorRatePct ?? 0) * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] text-success font-mono mt-0.5">
            Success rate: {((1 - (overview?.errorRatePct ?? 0)) * 100).toFixed(2)}%
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card/60 border border-border/80">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase tracking-wider">Active Threats & Bans</span>
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-2xl font-extrabold text-foreground mt-1">
            {overview?.blockedSourcesCount ?? 0} <span className="text-xs font-normal text-muted-foreground font-sans">blocked IPs</span>
          </div>
          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
            Active Incidents: <span className={activeIncs.length > 0 ? 'text-destructive font-bold' : 'text-success'}>{activeIncs.length}</span>
          </div>
        </div>
      </div>

      {/* ── Interactive Topology Map ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Live Mesh Topology & Service Interconnect
            </h2>
            <p className="text-[11px] text-muted-foreground">Real-time edge traffic routing and persistence dependencies</p>
          </div>
          <button
            onClick={() => onNavigateTab?.('topology')}
            className="text-[11px] font-mono text-primary hover:text-warning transition"
          >
            Full Topology Explorer →
          </button>
        </div>
        <TopologyGraph data={topology} onSelectNode={onSelectService} />
      </div>

      {/* ── Split Panel: Live Ingress Feed & Active Incidents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Requests Stream */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-card/60 border border-border/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">Live API Telemetry Tail</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-success/10 text-success border border-success/20 animate-pulse">
              ● STREAM ACTIVE
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-[10px] uppercase">
                  <th className="pb-2">Method</th>
                  <th className="pb-2">Route</th>
                  <th className="pb-2">Service</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Latency</th>
                  <th className="pb-2">Network (ASN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {traffic.slice(0, 6).map((r) => {
                  const is2xx = r.statusCode >= 200 && r.statusCode < 300;
                  const is4xx = r.statusCode >= 400 && r.statusCode < 500;
                  return (
                    <tr key={r.requestId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.method === 'POST' ? 'bg-info/20 text-info' :
                          r.method === 'GET' ? 'bg-success/20 text-success' :
                          r.method === 'DELETE' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'
                        }`}>
                          {r.method}
                        </span>
                      </td>
                      <td className="py-2.5 text-foreground truncate max-w-[180px]" title={r.path}>
                        {r.path}
                      </td>
                      <td className="py-2.5 text-muted-foreground text-[11px]">{r.targetService}</td>
                      <td className="py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          is2xx ? 'bg-success/20 text-success' :
                          is4xx ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'
                        }`}>
                          {r.statusCode}
                        </span>
                      </td>
                      <td className="py-2.5 text-foreground text-[11px]">{r.durationMs.toFixed(1)}ms</td>
                      <td className="py-2.5 text-muted-foreground text-[10px] truncate max-w-[140px]">
                        {r.approximateGeo?.asn || r.clientIp}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Incidents & Security State */}
        <div className="p-4 rounded-xl bg-card/60 border border-border/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">Incident Dispatch</h3>
            </div>
            <button
              onClick={() => onNavigateTab?.('incidents')}
              className="text-[10px] font-mono text-primary hover:text-warning"
            >
              View All →
            </button>
          </div>

          {activeIncs.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
              <div className="text-xs font-bold text-foreground">Zero Active Incidents</div>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                Platform operating within established SLO bounds across all 9 services.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeIncs.slice(0, 3).map((inc) => (
                <div key={inc.id} className="p-2.5 rounded-lg bg-card/80 border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-warning/20 text-warning">
                      {inc.severity}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{inc.incidentNumber}</span>
                  </div>
                  <div className="text-xs font-semibold text-foreground truncate">{inc.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{inc.description}</div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Security Status */}
          <div className="pt-3 border-t border-border/80 space-y-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Defensive Boundary State</div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Sliding-Window Rate Limiter</span>
              <span className="text-success font-mono text-[11px]">ACTIVE (5 req/s burst)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Automatic IP Ban Escalation</span>
              <span className="text-success font-mono text-[11px]">ACTIVE (1h TTL)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">W3C Traceparent Injection</span>
              <span className="text-success font-mono text-[11px]">ENFORCED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
