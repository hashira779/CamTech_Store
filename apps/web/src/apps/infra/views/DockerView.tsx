import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Play,
  Square,
  RotateCw,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  X,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: 'running' | 'exited' | 'restarting' | 'paused';
  ports?: string;
  cpuPct?: number;
  memoryMb?: number;
  created?: string;
  agentId?: string;
  agentHostname?: string;
}

export function DockerView() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('ALL');
  const [activeLogsContainer, setActiveLogsContainer] = useState<DockerContainer | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingLogsContainerId, setLoadingLogsContainerId] = useState<string | null>(null);
  const [logsText, setLogsText] = useState('');
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ containerId: string; action: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch agents to populate the server dropdown
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ['infra-agents'],
    queryFn: async () => {
      return (await apiClient.get<any[]>('/infra/agents')) || [];
    },
  });

  // Fetch containers: either aggregate from latestMetrics or direct call
  const {
    data: containers = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<DockerContainer[]>({
    queryKey: ['infra-docker-containers', selectedAgentId],
    queryFn: async () => {
      // If a specific agent is selected, query its live docker API
      if (selectedAgentId !== 'ALL') {
        const res = await apiClient.get<any>(`/infra/agents/${selectedAgentId}/docker`);
        const agent = agents.find((a) => a.id === selectedAgentId);
        return (res?.containers || []).map((c: any) => ({
          ...c,
          agentId: selectedAgentId,
          agentHostname: agent?.hostname || 'Unknown',
        }));
      }

      // If ALL is selected, query the centralized endpoint or aggregate
      if (selectedAgentId === 'ALL') {
        try {
          const res = await apiClient.get<any>('/infra/docker/containers');
          if (res?.containers && res.containers.length > 0) {
            return res.containers.map((c: any) => ({
              id: c.id || c.name,
              name: c.name || 'unnamed',
              image: c.image || 'unknown',
              status: c.status || 'running',
              state: c.state || (c.status?.toLowerCase().includes('up') ? 'running' : 'exited'),
              cpuPct: c.cpuPercent || 0,
              memoryMb: c.memoryUsageMb || c.memoryMb || 0,
              ports: Array.isArray(c.ports) ? c.ports.join(', ') : c.ports || '',
              agentId: c.agentId,
              agentHostname: c.agentHostname,
              created: c.created,
            }));
          }
        } catch {
          // Fallback to iterating agents
        }

        const list: DockerContainer[] = [];
        for (const agent of agents) {
          const dcList = agent.latestMetrics?.docker?.containers || [];
          for (const c of dcList) {
            list.push({
              id: c.id || c.name,
              name: c.name || 'unnamed',
              image: c.image || 'unknown',
              status: c.status || 'running',
              state: c.state || 'running',
              cpuPct: c.cpuPercent || 0,
              memoryMb: c.memoryMb || 0,
              ports: Array.isArray(c.ports) ? c.ports.join(', ') : c.ports || '',
              agentId: agent.id,
              agentHostname: agent.hostname,
            });
          }
        }
        return list;
      }
    },
    refetchInterval: 5000,
  });

  // Container Action Mutation (start/stop/restart)
  const actionMutation = useMutation({
    mutationFn: async ({
      agentId,
      containerId,
      action,
    }: {
      agentId: string;
      containerId: string;
      action: 'start' | 'stop' | 'restart';
    }) => {
      setPendingAction({ containerId, action });
      return await apiClient.post<any>(`/infra/agents/${agentId}/docker/${containerId}/action`, { action });
    },
    onSuccess: (_, vars) => {
      setPendingAction(null);
      showToast('success', `Container ${vars.containerId} ${vars.action}ed successfully`);
      queryClient.invalidateQueries({ queryKey: ['infra-docker-containers'] });
      queryClient.invalidateQueries({ queryKey: ['infra-agents'] });
    },
    onError: (err: any, vars) => {
      setPendingAction(null);
      showToast('error', `Failed to ${vars.action} ${vars.containerId}: ${err.message || 'Action failed'}`);
    },
  });

  const viewLogs = async (c: DockerContainer) => {
    setLoadingLogsContainerId(c.name);
    setActiveLogsContainer(c);
    setLoadingLogs(true);
    setLogsText('');
    setCopiedLogs(false);
    try {
      if (c.agentId) {
        let res: any = null;
        try {
          res = await apiClient.get<any>(`/infra/agents/${c.agentId}/docker/${c.name}/logs?tail=150`);
        } catch {
          res = await apiClient.post<any>(`/infra/agents/${c.agentId}/command`, {
            command: `docker logs --tail 150 ${c.name}`,
          });
        }
        const raw = res?.logs || res?.stdout || res?.result || 'No logs captured.';
        setLogsText(typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2));
      } else {
        setLogsText('Agent ID not found for container.');
      }
    } catch (e: any) {
      setLogsText(`Failed to fetch logs: ${e.message}`);
    } finally {
      setLoadingLogs(false);
      setLoadingLogsContainerId(null);
    }
  };

  const copyToClipboard = () => {
    if (!logsText) return;
    navigator.clipboard.writeText(logsText);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const filtered = containers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.image.toLowerCase().includes(term);
  });

  const runningCount = containers.filter((c) => c.state === 'running').length;
  const stoppedCount = containers.filter((c) => c.state !== 'running').length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[#F38020]" />
            Docker &amp; Container Workloads
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time lifecycle control, resource consumption, and logs across all host engines
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#F38020]/10 border border-[#F38020]/30 text-[#F38020] text-xs font-mono animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing workloads...</span>
            </div>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition cursor-pointer disabled:opacity-50"
            title="Refresh Containers"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#F38020]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition">
          <div className="text-xs text-zinc-400 mb-1">Total Workloads</div>
          <div className="text-2xl font-bold text-white font-mono">{containers.length}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-emerald-500/30 transition">
          <div className="text-xs text-emerald-400 mb-1">Running Containers</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{runningCount}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-amber-500/30 transition">
          <div className="text-xs text-amber-400 mb-1">Stopped / Exited</div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{stoppedCount}</div>
        </div>
      </div>

      {/* ── Search & Host Filter ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search container name or image..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-700/80 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#F38020] focus:ring-1 focus:ring-[#F38020]/30 transition"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 font-mono">
            Showing <strong className="text-white">{filtered.length}</strong> of {containers.length}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Host Server:</span>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#F38020]"
            >
              <option value="ALL">All Server Nodes</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.hostname} ({a.ipAddress})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Containers Table & Animated States ── */}
      {isLoading ? (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden p-6 space-y-5">
          {/* Animated Center Spinner */}
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-[#F38020] animate-spin" />
              <Layers className="w-5 h-5 text-[#F38020] absolute animate-pulse" />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-white tracking-wide">Inspecting Docker Daemon Workloads</div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">Querying container runtime via ICP agent...</div>
            </div>
          </div>

          {/* Skeleton Shimmer Rows */}
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-zinc-800/30 border border-zinc-800/40 rounded-lg animate-pulse flex items-center justify-between px-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 animate-pulse" />
                  <div className="w-36 h-3.5 bg-zinc-700/60 rounded" />
                  <div className="w-48 h-3 bg-zinc-800/80 rounded hidden md:block" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-5 bg-zinc-800 rounded-full" />
                  <div className="w-24 h-3 bg-zinc-800 rounded hidden sm:block" />
                  <div className="w-28 h-6 bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800">
          <Layers className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-300 text-sm font-semibold">No containers found</p>
          <p className="text-zinc-500 text-xs mt-1">
            Ensure Docker is running on your managed servers and the ICP Agent has permissions to access /var/run/docker.sock.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden shadow-lg relative">
          {/* Subtle loading bar on background refetch */}
          {isFetching && (
            <div className="h-0.5 w-full bg-zinc-800 overflow-hidden absolute top-0 left-0 right-0 z-10">
              <div className="h-full bg-[#F38020] w-1/3 animate-[shimmer_1.5s_infinite]" />
            </div>
          )}

          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-mono">
              <tr>
                <th className="py-3 px-4">Container</th>
                <th className="py-3 px-4">Image</th>
                <th className="py-3 px-4">Host Node</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Resources</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {filtered.map((c) => {
                const isRunning = c.state === 'running';
                const isThisActionPending = pendingAction?.containerId === c.name;
                const isRestarting = isThisActionPending && pendingAction?.action === 'restart';
                const isStopping = isThisActionPending && pendingAction?.action === 'stop';
                const isStarting = isThisActionPending && pendingAction?.action === 'start';
                const isLoadingThisLog = loadingLogsContainerId === c.name;
                const isBusy = !!pendingAction;

                return (
                  <tr
                    key={c.id + (c.agentId || '')}
                    className={`transition-colors duration-200 ${
                      isThisActionPending
                        ? 'bg-[#F38020]/10 border-l-2 border-l-[#F38020]'
                        : 'hover:bg-zinc-800/30'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full transition-all ${
                          isThisActionPending
                            ? 'bg-[#F38020] animate-ping'
                            : isRunning
                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                            : 'bg-zinc-500'
                        }`}
                      />
                      <span className="truncate max-w-[200px]" title={c.name}>
                        {c.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400 truncate max-w-xs" title={c.image}>
                      {c.image}
                    </td>
                    <td className="py-3 px-4 text-zinc-300">{c.agentHostname || 'Local'}</td>
                    <td className="py-3 px-4">
                      {isThisActionPending ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-flex items-center gap-1.5 bg-[#F38020]/20 text-[#F38020] border border-[#F38020]/40 animate-pulse shadow-[0_0_10px_rgba(243,128,32,0.2)]">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          {isRestarting ? 'Restarting...' : isStopping ? 'Stopping...' : 'Starting...'}
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isRunning
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {c.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {c.cpuPct !== undefined ? `${c.cpuPct.toFixed(1)}% CPU • ${c.memoryMb || 0} MB` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {/* View Logs Button */}
                      <button
                        onClick={() => viewLogs(c)}
                        disabled={isLoadingThisLog}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition text-[11px] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="View Tail Logs"
                      >
                        {isLoadingThisLog ? (
                          <Loader2 className="w-3 h-3 animate-spin text-[#F38020]" />
                        ) : (
                          <FileText className="w-3 h-3 text-zinc-400" />
                        )}
                        {isLoadingThisLog ? 'Loading...' : 'Logs'}
                      </button>

                      {isRunning ? (
                        <>
                          {/* Restart Button with animated spinner */}
                          <button
                            onClick={() =>
                              c.agentId &&
                              actionMutation.mutate({
                                agentId: c.agentId,
                                containerId: c.name,
                                action: 'restart',
                              })
                            }
                            disabled={isBusy}
                            className={`px-2.5 py-1 rounded border transition text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                              isRestarting
                                ? 'bg-[#F38020]/30 border-[#F38020] text-[#F38020] shadow-[0_0_12px_rgba(243,128,32,0.4)] animate-pulse'
                                : 'bg-[#F38020]/15 hover:bg-[#F38020]/25 text-[#F38020] border-[#F38020]/30'
                            }`}
                            title="Restart Container"
                          >
                            <RotateCw className={`w-3 h-3 ${isRestarting ? 'animate-spin text-[#F38020]' : ''}`} />
                            {isRestarting ? 'Restarting...' : 'Restart'}
                          </button>

                          {/* Stop Button with animated spinner */}
                          <button
                            onClick={() =>
                              c.agentId &&
                              actionMutation.mutate({
                                agentId: c.agentId,
                                containerId: c.name,
                                action: 'stop',
                              })
                            }
                            disabled={isBusy}
                            className={`px-2.5 py-1 rounded border transition text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                              isStopping
                                ? 'bg-rose-900/70 border-rose-500 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse'
                                : 'bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border-rose-800/50'
                            }`}
                            title="Stop Container"
                          >
                            {isStopping ? (
                              <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                            ) : (
                              <Square className="w-3 h-3" />
                            )}
                            {isStopping ? 'Stopping...' : 'Stop'}
                          </button>
                        </>
                      ) : (
                        /* Start Button with animated spinner */
                        <button
                          onClick={() =>
                            c.agentId &&
                            actionMutation.mutate({
                              agentId: c.agentId,
                              containerId: c.name,
                              action: 'start',
                            })
                          }
                          disabled={isBusy}
                          className={`px-2.5 py-1 rounded border transition text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            isStarting
                              ? 'bg-emerald-900/70 border-emerald-500 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse'
                              : 'bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 border-emerald-800/50'
                          }`}
                          title="Start Container"
                        >
                          {isStarting ? (
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          {isStarting ? 'Starting...' : 'Start'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Logs Modal ── */}
      {activeLogsContainer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-zinc-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#F38020]" />
                  logs://{activeLogsContainer.agentHostname}/{activeLogsContainer.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveLogsContainer(null)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Terminal Body */}
            <div className="relative">
              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-black/90 rounded-xl border border-zinc-800/80">
                  <div className="relative flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-2 border-zinc-800 border-t-[#F38020] animate-spin" />
                    <Terminal className="w-4 h-4 text-[#F38020] absolute" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-300 font-mono font-medium">Connecting to Docker runtime stream...</p>
                    <p className="text-[11px] text-zinc-500 font-mono mt-1 animate-pulse">
                      &gt; streaming stdout / stderr tail buffer (150 lines)...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative group">
                  <pre className="p-4 rounded-xl bg-black border border-zinc-800/80 text-[11px] font-mono text-zinc-300 max-h-[460px] overflow-y-auto whitespace-pre-wrap leading-relaxed selection:bg-[#F38020]/30 selection:text-white">
                    {logsText || 'No logs captured from container output.'}
                  </pre>
                  {logsText && (
                    <button
                      onClick={copyToClipboard}
                      className="absolute top-3 right-3 px-2.5 py-1 rounded bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/70 text-[11px] font-mono flex items-center gap-1.5 shadow-md backdrop-blur transition cursor-pointer opacity-80 group-hover:opacity-100"
                    >
                      {copiedLogs ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Logs</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-zinc-500 font-mono">
                Container Image: <span className="text-zinc-400">{activeLogsContainer.image}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => viewLogs(activeLogsContainer)}
                  disabled={loadingLogs}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-mono inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin text-[#F38020]' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => setActiveLogsContainer(null)}
                  className="px-4 py-1.5 bg-[#F38020] hover:bg-[#E07116] text-white rounded-lg text-xs font-semibold font-mono transition cursor-pointer shadow-md shadow-[#F38020]/20"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification Banner ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'success'
              ? 'bg-zinc-900/95 border-emerald-500/50 text-emerald-300 shadow-emerald-500/10'
              : 'bg-zinc-900/95 border-rose-500/50 text-rose-300 shadow-rose-500/10'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-mono font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default DockerView;
