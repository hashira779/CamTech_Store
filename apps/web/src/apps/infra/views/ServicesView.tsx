import React, { useState } from 'react';
import { type InfraServiceNodeDTO } from '@mystore/contracts';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Activity,
  Cpu,
  Layers,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface ServicesViewProps {
  services?: InfraServiceNodeDTO[];
  onSelectService?: (id: string) => void;
}

export function ServicesView({ services = [], onSelectService }: ServicesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(s.port).includes(searchTerm);
    const matchesStatus =
      statusFilter === 'ALL' || s.status.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search service name, role, or port..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-700/80 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['ALL', 'HEALTHY', 'DEGRADED', 'DOWN'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white font-bold shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                  : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* ── Services Table ── */}
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 text-[11px] uppercase tracking-wider">
                <th className="p-3">Service Name</th>
                <th className="p-3">Role</th>
                <th className="p-3">Port</th>
                <th className="p-3">Status</th>
                <th className="p-3">P95 Latency</th>
                <th className="p-3">Req/s</th>
                <th className="p-3">Error Rate</th>
                <th className="p-3">Dependencies</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((s) => {
                const isHealthy = s.status === 'HEALTHY';
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectService?.(s.id)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
                        <div>
                          <div className="font-bold text-white text-xs">{s.name}</div>
                          <div className="text-[10px] text-zinc-500">v{s.version} • {s.instancesCount} instance(s)</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold">
                        {s.role}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-zinc-300 font-bold">:{s.port}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        isHealthy
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-300 font-mono">
                      {s.p95LatencyMs?.toFixed(1) ?? '12.0'}ms
                    </td>
                    <td className="p-3 text-zinc-300 font-mono">{s.requestsPerSec?.toFixed(1) ?? '0.0'}</td>
                    <td className="p-3 font-mono text-emerald-400">
                      {((s.errorRatePct ?? 0) * 100).toFixed(2)}%
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(s.dependencies || []).map((dep: string) => (
                          <span
                            key={dep}
                            className="px-1.5 py-0.5 rounded bg-zinc-950 text-[10px] text-zinc-400 border border-zinc-800"
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectService?.(s.id);
                        }}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-sans transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
