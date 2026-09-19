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
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Median Latency (P50)</div>
          <div className="text-xl font-extrabold text-white mt-1 font-mono">{p50.toFixed(1)}ms</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Optimal Edge Performance</div>
        </div>
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">95th Percentile (P95)</div>
          <div className="text-xl font-extrabold text-[#F38020] mt-1 font-mono">{p95.toFixed(1)}ms</div>
          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">SLO Target: &lt;150ms</div>
        </div>
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Tail Latency (P99)</div>
          <div className="text-xl font-extrabold text-amber-400 mt-1 font-mono">{p99.toFixed(1)}ms</div>
          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">Database & Network Outliers</div>
        </div>
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Ingress Sample Volume</div>
          <div className="text-xl font-extrabold text-white mt-1 font-mono">{requests.length} reqs</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">W3C Correlated Traceparents</div>
        </div>
      </div>

      {/* ── Search and Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search path, service, IP, or trace ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-700/80 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#F38020] focus:ring-1 focus:ring-[#F38020]/30 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map((method) => (
            <button
              key={method}
              onClick={() => setMethodFilter(method)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                methodFilter === method
                  ? 'bg-[#F38020] text-white font-bold shadow-[0_0_12px_rgba(243,128,32,0.4)]'
                  : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {method}
            </button>
          ))}

          <button
            onClick={handlePingGateway}
            disabled={isPinging}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono bg-[#F38020]/15 hover:bg-[#F38020]/25 text-[#F38020] border border-[#F38020]/30 transition cursor-pointer disabled:opacity-50 ml-2 shadow-sm"
            title="Test real-time edge packet transmission"
          >
            <Zap className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Ping Gateway</span>
          </button>
        </div>
      </div>

      {/* ── Live Request Feed Table ── */}
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 text-[11px] uppercase tracking-wider">
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
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-zinc-500 font-mono">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Real-Time Monitor Listening on API Gateway (:4000)
                      </div>
                      <p className="text-zinc-400 text-xs max-w-md">
                        Zero-database memory stream active. Requests from cashiers, shoppers, and API clients stream here live.
                      </p>
                      <button
                        onClick={handlePingGateway}
                        disabled={isPinging}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F38020] hover:bg-[#E07116] text-white text-xs font-mono font-medium transition cursor-pointer disabled:opacity-50 mt-1 shadow-md shadow-[#F38020]/20"
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
                    className="hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedReq(r)}
                  >
                    <td className="p-3 text-zinc-500 text-[11px]">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                        r.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' :
                        r.method === 'DELETE' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {r.method}
                      </span>
                    </td>
                    <td className="p-3 text-white font-medium max-w-[240px] truncate" title={r.path}>
                      {r.path}
                    </td>
                    <td className="p-3 text-zinc-400 text-[11px]">{r.targetService}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        is2xx ? 'bg-emerald-500/20 text-emerald-300' :
                        is4xx ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {r.statusCode}
                      </span>
                      {r.isRateLimited && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[9px] font-bold">
                          429 RATE LIMITED
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-zinc-300">
                      {r.durationMs.toFixed(1)}ms
                    </td>
                    <td className="p-3 text-zinc-400 text-[11px] truncate max-w-[180px]">
                      {r.approximateGeo?.asn || r.clientIp} ({r.approximateGeo?.country || 'KH'})
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-[10px] text-[#F38020] font-mono hover:underline">
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
          <div className="w-full max-w-xl rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#F38020]/20 text-[#F38020]">
                  {selectedReq.method}
                </span>
                <span className="text-sm font-bold text-white truncate max-w-sm">
                  {selectedReq.path}
                </span>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="text-zinc-500 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-zinc-500">Status Code:</span>
                <div className="text-white font-bold">{selectedReq.statusCode}</div>
              </div>
              <div>
                <span className="text-zinc-500">Duration:</span>
                <div className="text-white font-bold">{selectedReq.durationMs} ms</div>
              </div>
              <div>
                <span className="text-zinc-500">Target Microservice:</span>
                <div className="text-[#F38020]">{selectedReq.targetService}</div>
              </div>
              <div>
                <span className="text-zinc-500">Timestamp:</span>
                <div className="text-zinc-300">{new Date(selectedReq.timestamp).toISOString()}</div>
              </div>
              <div>
                <span className="text-zinc-500">Source IP:</span>
                <div className="text-zinc-300">{selectedReq.clientIp}</div>
              </div>
              <div>
                <span className="text-zinc-500">Network / ASN:</span>
                <div className="text-zinc-300">{selectedReq.approximateGeo?.asn || 'Unknown ASN'}</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1.5 text-xs">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Distributed Tracing (W3C Standard)</div>
              <div className="text-zinc-400 truncate">
                <span className="text-zinc-600">Trace ID: </span>{selectedReq.traceId}
              </div>
              <div className="text-zinc-400 truncate">
                <span className="text-zinc-600">Request ID: </span>{selectedReq.requestId}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-sans text-white transition"
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
