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
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const selectedService = selectedServiceId ? services.find(s => s.id === selectedServiceId) : null;

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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-card/60 border border-border/80">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search service name, role, or port..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-card/80 border border-border/80 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['ALL', 'HEALTHY', 'DEGRADED', 'DOWN'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground font-bold shadow-[0_0_12px_rgba(243,128,32,0.4)]'
                  : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* ── Services Table ── */}
      <div className="rounded-xl bg-card/60 border border-border/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-card/60 text-muted-foreground text-[11px] uppercase tracking-wider">
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
            <tbody className="divide-y divide-border/60">
              {filtered.map((s) => {
                const isHealthy = s.status === 'HEALTHY';
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-muted/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectService?.(s.id)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <div>
                          <div className="font-bold text-foreground text-xs">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground">v{s.version} • {s.instancesCount} instance(s)</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-muted text-foreground border border-border font-semibold">
                        {s.role}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-foreground font-bold">:{s.port}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        isHealthy
                          ? 'bg-success/10 text-success border border-success/30'
                          : 'bg-destructive/10 text-destructive border border-destructive/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-success animate-pulse' : 'bg-destructive'}`}></span>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-foreground font-mono">
                      {s.p95LatencyMs?.toFixed(1) ?? '12.0'}ms
                    </td>
                    <td className="p-3 text-foreground font-mono">{s.requestsPerSec?.toFixed(1) ?? '0.0'}</td>
                    <td className="p-3 font-mono text-success">
                      {((s.errorRatePct ?? 0) * 100).toFixed(2)}%
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(s.dependencies || []).map((dep: string) => (
                          <span
                            key={dep}
                            className="px-1.5 py-0.5 rounded bg-card text-[10px] text-muted-foreground border border-border"
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
                          setSelectedServiceId(s.id);
                          onSelectService?.(s.id);
                        }}
                        className="px-2.5 py-1 rounded bg-muted hover:bg-muted text-foreground text-xs font-sans transition"
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

      {/* ── Service Detail Inspector Modal ── */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl bg-card border border-border shadow-2xl p-5 space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground truncate max-w-sm">
                  {selectedService.name} <span className="text-muted-foreground font-normal">({selectedService.role})</span>
                </span>
              </div>
              <button
                onClick={() => setSelectedServiceId(null)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className={`font-bold ${
                  selectedService.status === 'HEALTHY' ? 'text-success' :
                  selectedService.status === 'DEGRADED' ? 'text-warning' : 'text-destructive'
                }`}>
                  {selectedService.status}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Version:</span>
                <div className="text-foreground font-bold">{selectedService.version}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Port:</span>
                <div className="text-primary font-bold">:{selectedService.port}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Instances:</span>
                <div className="text-foreground font-bold">{selectedService.instancesCount} instance(s)</div>
              </div>
              <div>
                <span className="text-muted-foreground">CPU Usage:</span>
                <div className="text-success font-bold">{selectedService.cpuPct.toFixed(2)}%</div>
              </div>
              <div>
                <span className="text-muted-foreground">Memory Usage:</span>
                <div className="text-success font-bold">{selectedService.memoryPct.toFixed(2)}%</div>
              </div>
              <div>
                <span className="text-muted-foreground">Uptime:</span>
                <div className="text-foreground font-bold">{(selectedService.uptimeSeconds / 3600).toFixed(1)} hours</div>
              </div>
              <div>
                <span className="text-muted-foreground">DB Latency:</span>
                <div className="text-warning font-bold">{selectedService.dbPingMs !== undefined ? `${selectedService.dbPingMs.toFixed(1)}ms` : 'N/A'}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-border/80 text-xs">
              <span className="text-muted-foreground mb-2 block">Dependencies:</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedService.dependencies?.length > 0 ? (
                  selectedService.dependencies.map(dep => (
                    <span key={dep} className="px-2 py-1 rounded bg-card border border-border text-foreground">
                      {dep}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            </div>
            
            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setSelectedServiceId(null)}
                className="px-4 py-1.5 rounded-lg bg-muted hover:bg-muted text-foreground text-xs font-sans transition"
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
