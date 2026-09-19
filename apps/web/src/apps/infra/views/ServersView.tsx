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
    },
    onError: (err: any) => {
      setCommandOutput(`Error: ${err.message || 'Execution failed'}`);
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
      alert('Reboot signal transmitted to server agent.');
      setShowRebootModal(false);
      queryClient.invalidateQueries({ queryKey: ['infra-agents'] });
    },
    onError: (err: any) => {
      alert(`Reboot failed: ${err.message || 'Error occurred'}`);
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
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Server className="w-5 h-5 text-indigo-400" />
            Server Fleet & Infrastructure Agents
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time node telemetry, resource saturation, and secure out-of-band management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition"
            title="Refresh Fleet"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowInstallModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Server Agent
          </button>
        </div>
      </div>

      {/* ── Summary Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Total Servers</span>
            <Server className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{agents.length}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
            <span>Online</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{onlineCount}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs text-amber-400 mb-1">
            <span>Degraded</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{degradedCount}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs text-rose-400 mb-1">
            <span>Offline</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">{offlineCount}</div>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search hostname, IP, or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-700/80 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {['ALL', 'ONLINE', 'DEGRADED', 'OFFLINE'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white font-bold shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                  : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* ── Server Nodes Grid ── */}
      {isLoading ? (
        <div className="p-12 text-center text-zinc-500 text-sm">Loading managed server fleet...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800">
          <Server className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-300 text-sm font-semibold">No servers match your criteria</p>
          <p className="text-zinc-500 text-xs mt-1">
            Install the ICP Agent on your Linux or Windows server to begin automated telemetry.
          </p>
          <button
            onClick={() => setShowInstallModal(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Show Agent Install Script
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((agent) => {
            const m = agent.latestMetrics || {};
            const cpu = m.cpu?.percent ?? 0;
            const mem = m.memory?.percent ?? 0;
            const disk = m.disk?.percent ?? 0;
            const containers = m.docker?.totalContainers ?? 0;

            const isOnline = agent.status === 'ONLINE';

            return (
              <div
                key={agent.id}
                className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">{agent.hostname}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                      <div className="text-xs text-zinc-400 font-mono mt-0.5">
                        {agent.ipAddress}:{agent.port} • {agent.osType.toUpperCase()}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        isOnline
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  {/* Resource Gauges */}
                  <div className="space-y-2.5 my-4">
                    {/* CPU */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                        <span className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-indigo-400" /> CPU
                        </span>
                        <span className={cpu > 80 ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                          {cpu.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cpu > 80 ? 'bg-rose-500' : cpu > 60 ? 'bg-amber-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min(cpu, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* RAM */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                        <span className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-violet-400" /> RAM
                        </span>
                        <span className={mem > 85 ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                          {mem.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            mem > 85 ? 'bg-rose-500' : mem > 70 ? 'bg-amber-500' : 'bg-violet-500'
                          }`}
                          style={{ width: `${Math.min(mem, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Disk */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                        <span className="flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-sky-400" /> Disk
                        </span>
                        <span className={disk > 90 ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                          {disk.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            disk > 90 ? 'bg-rose-500' : 'bg-sky-500'
                          }`}
                          style={{ width: `${Math.min(disk, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Metadata pills */}
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono pt-2 border-t border-zinc-800/60">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" /> {containers} Containers
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" /> v{agent.version}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowCommandModal(true);
                        setCommandOutput(null);
                      }}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs flex items-center gap-1.5 transition cursor-pointer"
                      title="Run Command"
                    >
                      <Terminal className="w-3 h-3 text-indigo-400" /> Exec
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowRebootModal(true);
                      }}
                      className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs flex items-center gap-1.5 transition cursor-pointer"
                      title="Reboot Server"
                    >
                      <Power className="w-3 h-3 text-rose-400" /> Reboot
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Deregister agent ${agent.hostname}?`)) {
                        deleteMutation.mutate(agent.id);
                      }
                    }}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" /> Install ICP Server Agent
              </h3>
              <button
                onClick={() => setShowInstallModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Run this single command as <code className="text-amber-400 font-mono">root</code> on any Ubuntu/Debian
              server. The installer creates a dedicated Python virtualenv, installs the systemd service, registers with
              this control center, and starts reporting metrics immediately:
            </p>

            <div className="relative">
              <pre className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto select-all">
                {installScriptCmd}
              </pre>
              <button
                onClick={copyInstallScript}
                className="absolute top-2 right-2 p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                title="Copy Command"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/40 text-xs text-indigo-300">
              🔒 <strong>Security Model:</strong> The dashboard never executes raw shell commands directly on the server.
              All operations pass through strict allowlist gates and mutual API key authentication.
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowInstallModal(false)}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold"
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" /> Execute on {selectedAgent.hostname}
              </h3>
              <button
                onClick={() => setShowCommandModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Approved Command</label>
              <select
                value={selectedCommand}
                onChange={(e) => setSelectedCommand(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
              >
                <option value="uptime">uptime — System load & uptime</option>
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
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition"
            >
              {execMutation.isPending ? 'Executing on Agent...' : 'Dispatch Command'}
            </button>

            {commandOutput && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Agent Response</label>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-emerald-400 max-h-48 overflow-y-auto">
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
          <div className="bg-zinc-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400 font-bold text-base">
              <Power className="w-5 h-5" /> Confirm Server Reboot
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              You are requesting an operating system restart on{' '}
              <strong className="text-white font-mono">{selectedAgent.hostname}</strong> ({selectedAgent.ipAddress}).
              This operation requires Break-Glass authorization and will briefly interrupt all services hosted on this
              node.
            </p>

            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300">
              ⚠️ A 10-second warning countdown will be broadcast before the node executes <code className="font-mono">shutdown -r</code>.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRebootModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => rebootMutation.mutate({ agentId: selectedAgent.id })}
                disabled={rebootMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
              >
                {rebootMutation.isPending ? 'Sending Reboot Signal...' : 'Authorize & Reboot Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServersView;
