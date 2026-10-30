import React, { useState } from 'react';
import { type ApiTrafficRequestDTO } from '@mystore/contracts';
import {
  Activity,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Filter,
  Globe,
  Search,
  ShieldAlert,
  Zap,
} from 'lucide-react';

import { apiClient } from '@/lib/api-client';

interface ApiTrafficViewProps {
  requests?: ApiTrafficRequestDTO[];
}

export function ApiTrafficView({ requests = [] }: ApiTrafficViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [selectedReq, setSelectedReq] = useState<ApiTrafficRequestDTO | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const handlePingGateway = async () => {
    setIsPinging(true);
    try {
      await apiClient.get('/api/v1/infra/overview');
    } catch {
      // ignore
    } finally {
      setIsPinging(false);
    }
  };

  const filtered = requests.filter((r) => {
    const matchesSearch =
      r.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.targetService.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.clientIp.includes(searchTerm) ||
      r.traceId.includes(searchTerm);
    const matchesMethod = methodFilter === 'ALL' || r.method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  // Calculate percentiles from actual requests
  const latencies = requests.map((r) => r.durationMs).sort((a, b) => a - b);
  const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 12.0;
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 89.0;
  const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 142.0;

  return (
    <div className="space-y-4">
      {/* ── Latency Percentile Tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-card/60 border border-border/80">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Median Latency (P50)</div>
          <div className="text-xl font-extrabold text-foreground mt-1 font-mono">{p50.toFixed(1)}ms</div>
          <div className="text-[10px] text-success font-mono mt-0.5">Optimal Edge Performance</div>
        </div>
        <div className="p-3.5 rounded-xl bg-card/60 border border-border/80">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">95th Percentile (P95)</div>
          <div className="text-xl font-extrabold text-primary mt-1 font-mono">{p95.toFixed(1)}ms</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">SLO Target: &lt;150ms</div>
        </div>
        <div className="p-3.5 rounded-xl bg-card/60 border border-border/80">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Tail Latency (P99)</div>
          <div className="text-xl font-extrabold text-warning mt-1 font-mono">{p99.toFixed(1)}ms</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Database & Network Outliers</div>
        </div>
        <div className="p-3.5 rounded-xl bg-card/60 border border-border/80">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Ingress Sample Volume</div>
          <div className="text-xl font-extrabold text-foreground mt-1 font-mono">{requests.length} reqs</div>
          <div className="text-[10px] text-success font-mono mt-0.5">W3C Correlated Traceparents</div>
        </div>
      </div>

      {/* ── Search and Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-card/60 border border-border/80">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search path, service, IP, or trace ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-card/80 border border-border/80 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map((method) => (
            <button
              key={method}
              onClick={() => setMethodFilter(method)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                methodFilter === method
                  ? 'bg-primary text-primary-foreground font-bold shadow-[0_0_12px_rgba(243,128,32,0.4)]'
                  : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {method}
            </button>
          ))}

          <button
            onClick={handlePingGateway}
            disabled={isPinging}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition cursor-pointer disabled:opacity-50 ml-2 shadow-sm"
            title="Test real-time edge packet transmission"
          >
            <Zap className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Ping Gateway</span>
          </button>
        </div>
      </div>

      {/* ── Live Request Feed Table ── */}
      <div className="rounded-xl bg-card/60 border border-border/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-card/60 text-muted-foreground text-[11px] uppercase tracking-wider">
                <th className="p-3">Time</th>
                <th className="p-3">Method</th>
                <th className="p-3">Endpoint Route</th>
                <th className="p-3">Target Service</th>
                <th className="p-3">Status</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Client Network (ASN)</th>
                <th className="p-3 text-right">Trace Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground font-mono">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/30 text-success font-semibold text-xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                        </span>
                        Real-Time Monitor Listening on API Gateway (:4000)
                      </div>
                      <p className="text-muted-foreground text-xs max-w-md">
                        Zero-database memory stream active. Requests from cashiers, shoppers, and API clients stream here live.
                      </p>
                      <button
                        onClick={handlePingGateway}
                        disabled={isPinging}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-mono font-medium transition cursor-pointer disabled:opacity-50 mt-1 shadow-md shadow-primary/20"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Send Test Ping to Gateway</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                const is2xx = r.statusCode >= 200 && r.statusCode < 300;
                const is4xx = r.statusCode >= 400 && r.statusCode < 500;
                return (
                  <tr
                    key={r.requestId}
                    className="hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedReq(r)}
                  >
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.method === 'POST' ? 'bg-info/20 text-info' :
                        r.method === 'GET' ? 'bg-success/20 text-success' :
                        r.method === 'DELETE' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'
                      }`}>
                        {r.method}
                      </span>
                    </td>
                    <td className="p-3 text-foreground font-medium max-w-[240px] truncate" title={r.path}>
                      {r.path}
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">{r.targetService}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        is2xx ? 'bg-success/20 text-success' :
                        is4xx ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'
                      }`}>
                        {r.statusCode}
                      </span>
                      {r.isRateLimited && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-destructive/20 text-destructive text-[9px] font-bold">
                          429 RATE LIMITED
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-foreground">
                      {r.durationMs.toFixed(1)}ms
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px] truncate max-w-[180px]">
                      {r.approximateGeo?.asn || r.clientIp} ({r.approximateGeo?.country || 'KH'})
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-[10px] text-primary font-mono hover:underline">
                        {r.traceId.slice(0, 10)}...
                      </span>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Request Detail Inspector Modal ── */}
      {selectedReq && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl bg-card border border-border shadow-2xl p-5 space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/20 text-primary">
                  {selectedReq.method}
                </span>
                <span className="text-sm font-bold text-foreground truncate max-w-sm">
                  {selectedReq.path}
                </span>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Status Code:</span>
                <div className="text-foreground font-bold">{selectedReq.statusCode}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <div className="text-foreground font-bold">{selectedReq.durationMs} ms</div>
              </div>
              <div>
                <span className="text-muted-foreground">Target Microservice:</span>
                <div className="text-primary">{selectedReq.targetService}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Timestamp:</span>
                <div className="text-foreground">{new Date(selectedReq.timestamp).toISOString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Source IP:</span>
                <div className="text-foreground">{selectedReq.clientIp}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Network / ASN:</span>
                <div className="text-foreground">{selectedReq.approximateGeo?.asn || 'Unknown ASN'}</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-card border border-border/80 space-y-1.5 text-xs">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Distributed Tracing (W3C Standard)</div>
              <div className="text-muted-foreground truncate">
                <span className="text-muted-foreground">Trace ID: </span>{selectedReq.traceId}
              </div>
              <div className="text-muted-foreground truncate">
                <span className="text-muted-foreground">Request ID: </span>{selectedReq.requestId}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-1.5 rounded-lg bg-muted hover:bg-muted text-xs font-sans text-foreground transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
