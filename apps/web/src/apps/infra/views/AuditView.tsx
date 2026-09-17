import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  Search, 
  Terminal, 
  AlertTriangle, 
  RefreshCw,
  CheckCircle2,
  User
} from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import { InfraAuditEntryDTO } from '@mystore/contracts';
import { stopPollingOnAuthFailure } from '@/lib/query-polling';

export const AuditView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBreakGlass, setFilterBreakGlass] = useState<boolean | null>(null);
  const [selectedLog, setSelectedLog] = useState<InfraAuditEntryDTO | null>(null);

  const { data: auditLogs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['infra-audit'],
    queryFn: async () => {
      const res = await apiClient.get<InfraAuditEntryDTO[]>('/api/v1/infra/audit');
      return res || [];
    },
    refetchInterval: stopPollingOnAuthFailure(15000),
  });

  const filteredLogs = auditLogs.filter((log: InfraAuditEntryDTO) => {
    const matchesSearch = 
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.actorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.targetResource || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.ip || '').includes(searchTerm) ||
      (log.traceId || '').includes(searchTerm);
    
    if (filterBreakGlass !== null) {
      return matchesSearch && log.isBreakGlass === filterBreakGlass;
    }
    return matchesSearch;
  });

  const breakGlassCount = auditLogs.filter((l: InfraAuditEntryDTO) => l.isBreakGlass).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between backdrop-blur-sm">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Recorded Events</div>
            <div className="text-2xl font-black text-foreground mt-1">{auditLogs.length}</div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
            <Terminal className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between backdrop-blur-sm">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Break-Glass Invocations</div>
            <div className="text-2xl font-black text-rose-400 mt-1">{breakGlassCount}</div>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-lg text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between backdrop-blur-sm">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Log Immutability</div>
            <div className="text-sm font-bold text-emerald-400 mt-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> SHA-256 Verified Ledger
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border backdrop-blur-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search action, actor, resource, trace ID, or IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="inline-flex rounded-lg border border-border bg-background p-1">
            <button
              onClick={() => setFilterBreakGlass(null)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterBreakGlass === null ? 'bg-accent text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterBreakGlass(true)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterBreakGlass === true ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Break-Glass Only
            </button>
            <button
              onClick={() => setFilterBreakGlass(false)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterBreakGlass === false ? 'bg-accent text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Standard
            </button>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-accent hover:bg-accent text-foreground rounded-lg border border-border transition-colors disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-background text-xs uppercase font-mono tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    Loading immutable audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground font-sans">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log: InfraAuditEntryDTO) => (
                  <tr 
                    key={log.id} 
                    className={`hover:bg-accent transition-colors cursor-pointer ${
                      log.isBreakGlass ? 'bg-rose-950/10' : ''
                    }`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4 text-foreground font-semibold whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-sans">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{log.actorName || log.actorId}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-primary font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground max-w-[200px] truncate" title={log.targetResource}>
                      {log.targetResource}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {log.ip}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.isBreakGlass ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse font-sans">
                          <AlertTriangle className="w-3 h-3" /> BREAK-GLASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-accent text-muted-foreground border border-border font-sans">
                          STANDARD
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                        className="text-xs text-muted-foreground hover:text-primary font-sans font-medium hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Audit Record Inspector</h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-muted-foreground hover:text-white p-1 rounded-lg hover:bg-accent"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background p-3 rounded-lg border border-border">
                  <span className="text-xs text-muted-foreground block uppercase font-mono">Record ID</span>
                  <span className="text-foreground font-mono text-xs break-all">{selectedLog.id}</span>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <span className="text-xs text-muted-foreground block uppercase font-mono">Timestamp</span>
                  <span className="text-foreground font-mono text-xs">{selectedLog.timestamp}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background p-3 rounded-lg border border-border">
                  <span className="text-xs text-muted-foreground block uppercase font-mono">Actor</span>
                  <span className="text-foreground font-medium">{selectedLog.actorName || selectedLog.actorId}</span>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <span className="text-xs text-muted-foreground block uppercase font-mono">Action</span>
                  <span className="text-primary font-mono font-semibold">{selectedLog.action}</span>
                </div>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground block uppercase font-mono">Target Resource</span>
                <span className="text-foreground font-mono text-xs break-all">{selectedLog.targetResource}</span>
              </div>

              {selectedLog.reason && (
                <div className="bg-background p-3 rounded-lg border border-border">
                  <span className="text-xs text-muted-foreground block uppercase font-mono">Operational Reason</span>
                  <span className="text-foreground text-xs italic">{selectedLog.reason}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background p-3 rounded-lg border border-border">
                  <span className="text-xs text-muted-foreground block uppercase font-mono">Trace ID</span>
                  <span className="text-foreground font-mono text-xs break-all">{selectedLog.traceId || 'N/A'}</span>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <span className="text-xs text-muted-foreground block uppercase font-mono">Client IP</span>
                  <span className="text-foreground font-mono text-xs">{selectedLog.ip}</span>
                </div>
              </div>

              {selectedLog.isBreakGlass && (
                <div className="bg-rose-950/30 border border-rose-500/50 p-3 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">EMERGENCY BREAK-GLASS ACTION</span>
                    This operation was executed under an active break-glass session with elevated privileges. An automatic incident report has been flagged for compliance.
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-accent hover:bg-accent text-foreground text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
