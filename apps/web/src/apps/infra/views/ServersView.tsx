import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  RotateCw,
  Power,
  Terminal,
  Layers,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Clock,
  Shield,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface ServerAgent {
  id: string;
  hostname: string;
  ipAddress: string;
  port: number;
  osType: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  version: string;
  tags: string[];
  lastHeartbeatAt?: string;
  latestMetrics?: {
    cpu?: { percent: number; count: number };
    memory?: { percent: number; usedMb: number; totalMb: number };
    disk?: { percent: number; usedGb: number; totalGb: number };
    network?: { rxBytesPerSec: number; txBytesPerSec: number };
    docker?: { totalContainers: number; running: number };
    system?: { uptimeSeconds: number };
  };
  createdAt?: string;
}

export function ServersView() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedAgent, setSelectedAgent] = useState<ServerAgent | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [showRebootModal, setShowRebootModal] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState('uptime');
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 6000);
  };

  // Fetch registered agents
  const { data: agents = [], isLoading, refetch } = useQuery<ServerAgent[]>({
    queryKey: ['infra-agents'],
    queryFn: async () => {
      const res = await apiClient.get<ServerAgent[]>('/infra/agents');
      return res || [];
    },
    refetchInterval: 5000,
  });

  // Execute command mutation
  const execMutation = useMutation({
    mutationFn: async ({ agentId, command }: { agentId: string; command: string }) => {
      return await apiClient.post<any>(`/infra/agents/${agentId}/command`, { command });
    },
    onSuccess: (data) => {
      setCommandOutput(JSON.stringify(data, null, 2));
      queryClient.invalidateQueries({ queryKey: ['infra-agents'] });
      showToast('success', 'Command executed successfully');
    },
    onError: (err: any) => {
      setCommandOutput(`Error: ${err.message || 'Execution failed'}`);
      showToast('error', `Command failed: ${err.message || 'Execution failed'}`);
    },
  });

  // Reboot mutation
  const rebootMutation = useMutation({
    mutationFn: async ({ agentId }: { agentId: string }) => {
      return await apiClient.post<any>(`/infra/agents/${agentId}/system/reboot`, {
        delaySeconds: 10,
        breakGlassToken: 'CONFIRMED_REBOOT_OPERATIONAL',
      });
    },
    onSuccess: () => {
      showToast('warning', 'Reboot signal transmitted. Server is restarting (est. 30-45s)...');
      setShowRebootModal(false);
      queryClient.invalidateQueries({ queryKey: ['infra-agents'] });
    },
    onError: (err: any) => {
      showToast('error', `Reboot failed: ${err.message || 'Error occurred'}`);
    },
  });

  // Deregister mutation
  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      return await apiClient.delete<any>(`/infra/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-agents'] });
    },
  });

  const filtered = agents.filter((a) => {
    const match =
      a.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.ipAddress.includes(searchTerm) ||
      (a.tags && a.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));
    const statusMatch = statusFilter === 'ALL' || a.status === statusFilter;
    return match && statusMatch;
  });

  const onlineCount = agents.filter((a) => a.status === 'ONLINE').length;
  const offlineCount = agents.filter((a) => a.status === 'OFFLINE').length;
  const degradedCount = agents.filter((a) => a.status === 'DEGRADED').length;

  const installScriptCmd = `curl -sSL https://raw.githubusercontent.com/hashira779/CamTech_Store/main/services/agent/install.sh | sudo bash -s -- --control-center https://gateway.camtech.cam --api-key $(openssl rand -hex 24)`;

  const copyInstallScript = () => {
    navigator.clipboard.writeText(installScriptCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ── Top Bar / Stats ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Server className="w-5 h-5 text-primary" />
            Server Fleet &amp; Edge Compute Agents
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time node telemetry, resource saturation, and secure out-of-band management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-card border border-border text-foreground hover:text-foreground hover:border-border transition cursor-pointer"
            title="Refresh Fleet"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowInstallModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Server Agent
          </button>
        </div>
      </div>

      {/* ── Summary Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-card/60 border border-border/80">
          <div className="text-xs text-muted-foreground mb-1">Total Fleet Nodes</div>
          <div className="text-2xl font-bold text-foreground font-mono">{agents.length}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-card/60 border border-border/80">
          <div className="text-xs text-success mb-1">Online &amp; Healthy</div>
          <div className="text-2xl font-bold text-success font-mono">{onlineCount}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-card/60 border border-border/80">
          <div className="text-xs text-warning mb-1">Degraded Nodes</div>
          <div className="text-2xl font-bold text-warning font-mono">{degradedCount}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-card/60 border border-border/80">
          <div className="text-xs text-destructive mb-1">Offline Nodes</div>
          <div className="text-2xl font-bold text-destructive font-mono">{offlineCount}</div>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-card/60 border border-border/80">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search hostname, IP, or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-card/80 border border-border/80 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {['ALL', 'ONLINE', 'DEGRADED', 'OFFLINE'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground font-bold shadow-[0_0_12px_rgba(243,128,32,0.4)]'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* ── Server Nodes Grid ── */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">Loading managed server fleet...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card/40 border border-dashed border-border">
          <Server className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground text-sm font-semibold">No servers match your criteria</p>
          <p className="text-muted-foreground text-xs mt-1">
            Install the ICP Agent on your Linux or Windows server to begin automated telemetry.
          </p>
          <button
            onClick={() => setShowInstallModal(true)}
            className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer shadow-md shadow-primary/20"
          >
            Show Agent Install Script
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((agent) => {
            const m: any = agent.latestMetrics || {};
            const cpu = m.cpuPercent ?? m.cpu?.percent ?? 0;
            const mem = m.memoryPercent ?? m.memory?.percent ?? 0;
            const disk = m.diskPercent ?? m.disk?.percent ?? 0;
            const containers = m.containerCount ?? m.docker?.totalContainers ?? 0;

            const isOnline = agent.status === 'ONLINE';

            return (
              <div
                key={agent.id}
                className="p-4 rounded-xl bg-card/70 border border-border/80 hover:border-border transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{agent.hostname}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? 'bg-success shadow-[0_0_8px_color-mix(in srgb, var(--success) 70%, transparent)]' : 'bg-destructive'
                          }`}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {agent.ipAddress}:{agent.port} • {agent.osType.toUpperCase()}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        isOnline
                          ? 'bg-success/10 text-success border border-success/20'
                          : 'bg-destructive/10 text-destructive border border-destructive/20'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  {/* Resource Gauges */}
                  <div className="space-y-2.5 my-4">
                    {/* CPU */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
                        <span className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-primary" /> CPU
                        </span>
                        <span className={cpu > 80 ? 'text-destructive font-bold' : 'text-foreground'}>
                          {cpu.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cpu > 80 ? 'bg-destructive' : cpu > 60 ? 'bg-warning' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(cpu, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* RAM */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
                        <span className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-warning" /> RAM
                        </span>
                        <span className={mem > 85 ? 'text-destructive font-bold' : 'text-foreground'}>
                          {mem.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            mem > 85 ? 'bg-destructive' : mem > 70 ? 'bg-warning' : 'bg-warning'
                          }`}
                          style={{ width: `${Math.min(mem, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Disk */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
                        <span className="flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-info" /> Disk
                        </span>
                        <span className={disk > 90 ? 'text-destructive font-bold' : 'text-foreground'}>
                          {disk.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            disk > 90 ? 'bg-destructive' : 'bg-info'
                          }`}
                          style={{ width: `${Math.min(disk, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Metadata pills */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono pt-2 border-t border-border/60">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-success" /> {containers} Containers
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" /> v{agent.version}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowCommandModal(true);
                        setCommandOutput(null);
                      }}
                      className="px-2.5 py-1 rounded bg-muted hover:bg-muted text-foreground text-xs flex items-center gap-1.5 transition cursor-pointer"
                      title="Run Command"
                    >
                      <Terminal className="w-3 h-3 text-primary" /> Exec
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowRebootModal(true);
                      }}
                      className="px-2.5 py-1 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 text-xs flex items-center gap-1.5 transition cursor-pointer"
                      title="Reboot Server"
                    >
                      <Power className="w-3 h-3 text-destructive" /> Reboot
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Deregister agent ${agent.hostname}?`)) {
                        deleteMutation.mutate(agent.id);
                      }
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                    title="Deregister agent"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Install Agent Modal ── */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" /> Install ICP Server Agent
              </h3>
              <button
                onClick={() => setShowInstallModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Run this single command as <code className="text-warning font-mono">root</code> on any Ubuntu/Debian
              server. The installer creates a dedicated Python virtualenv, installs the systemd service, registers with
              this control center, and starts reporting metrics immediately:
            </p>

            <div className="relative">
              <pre className="p-3.5 rounded-lg bg-card border border-border text-[11px] font-mono text-foreground overflow-x-auto select-all">
                {installScriptCmd}
              </pre>
              <button
                onClick={copyInstallScript}
                className="absolute top-2 right-2 p-1.5 rounded bg-muted hover:bg-muted text-foreground transition"
                title="Copy Command"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-primary/10 border border-primary/25 text-xs text-primary">
              🔒 <strong>Security Model:</strong> The dashboard never executes raw shell commands directly on the server.
              All operations pass through strict allowlist gates and mutual API key authentication.
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowInstallModal(false)}
                className="px-4 py-1.5 bg-muted hover:bg-muted text-foreground rounded-lg text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exec Command Modal ── */}
      {showCommandModal && selectedAgent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" /> Execute on {selectedAgent.hostname}
              </h3>
              <button
                onClick={() => setShowCommandModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Approved Command</label>
              <select
                value={selectedCommand}
                onChange={(e) => setSelectedCommand(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
              >
                <option value="uptime">uptime — System load &amp; uptime</option>
                <option value="free -m">free -m — Memory allocations</option>
                <option value="df -h">df -h — Disk partition usage</option>
                <option value="docker ps">docker ps — Active containers</option>
                <option value="systemctl status docker">systemctl status docker — Docker daemon</option>
                <option value="netstat -tuln">netstat -tuln — Listening ports</option>
              </select>
            </div>

            <button
              onClick={() => execMutation.mutate({ agentId: selectedAgent.id, command: selectedCommand })}
              disabled={execMutation.isPending}
              className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50 transition cursor-pointer shadow-md shadow-primary/20"
            >
              {execMutation.isPending ? 'Executing on Agent...' : 'Dispatch Command'}
            </button>

            {commandOutput && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Agent Response</label>
                <pre className="p-3 rounded-lg bg-card border border-border text-[11px] font-mono text-success max-h-48 overflow-y-auto">
                  {commandOutput}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Reboot Server Modal ── */}
      {showRebootModal && selectedAgent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-destructive/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-destructive font-bold text-base">
              <Power className="w-5 h-5" /> Confirm Server Reboot
            </div>

            <p className="text-xs text-foreground leading-relaxed">
              You are requesting an operating system restart on{' '}
              <strong className="text-foreground font-mono">{selectedAgent.hostname}</strong> ({selectedAgent.ipAddress}).
              This operation requires Break-Glass authorization and will briefly interrupt all services hosted on this
              node.
            </p>

            <div className="p-3 rounded-lg bg-destructive/30 border border-destructive/40 text-xs text-destructive">
              ⚠️ A 10-second warning countdown will be broadcast before the node executes <code className="font-mono">shutdown -r</code>.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRebootModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => rebootMutation.mutate({ agentId: selectedAgent.id })}
                disabled={rebootMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-destructive hover:bg-destructive text-destructive-foreground text-xs font-bold shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
              >
                {rebootMutation.isPending ? 'Sending Reboot Signal...' : 'Authorize & Reboot Now'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Toast Notification Banner ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm transition duration-panel animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'success'
              ? 'bg-card/95 border-success/50 text-success shadow-emerald-500/10'
              : toast.type === 'warning'
              ? 'bg-card/95 border-warning/50 text-warning shadow-amber-500/10'
              : 'bg-card/95 border-destructive/50 text-destructive shadow-rose-500/10'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 animate-pulse" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
          )}
          <span className="text-xs font-mono font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default ServersView;
