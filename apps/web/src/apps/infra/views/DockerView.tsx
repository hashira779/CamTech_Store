import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Play,
  Square,
  RotateCw,
  FileText,
  Search,
  Server,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Activity,
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
  const [logsText, setLogsText] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch agents to populate the server dropdown
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ['infra-agents'],
    queryFn: async () => {
      return (await apiClient.get<any[]>('/infra/agents')) || [];
    },
  });

  // Fetch containers: either aggregate from latestMetrics or direct call
  const { data: containers = [], isLoading, refetch } = useQuery<DockerContainer[]>({
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

      // If ALL is selected, aggregate from agent metrics or fetch all
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
            agentId: agent.id,
            agentHostname: agent.hostname,
          });
        }
      }
      return list;
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
      return await apiClient.post<any>(`/infra/agents/${agentId}/docker/${containerId}/action`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-docker-containers'] });
      queryClient.invalidateQueries({ queryKey: ['infra-agents'] });
    },
    onError: (err: any) => {
      alert(`Docker action failed: ${err.message || 'Error'}`);
    },
  });

  const viewLogs = async (c: DockerContainer) => {
    setActiveLogsContainer(c);
    setLoadingLogs(true);
    try {
      if (c.agentId) {
        const res = await apiClient.post<any>(`/infra/agents/${c.agentId}/command`, {
          command: `docker logs --tail 100 ${c.name}`,
        });
        setLogsText(res?.stdout || res?.result || 'No logs captured.');
      } else {
        setLogsText('Agent ID not found for container.');
      }
    } catch (e: any) {
      setLogsText(`Failed to fetch logs: ${e.message}`);
    } finally {
      setLoadingLogs(false);
    }
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
            <Layers className="w-5 h-5 text-indigo-400" />
            Docker & Container Workloads
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time lifecycle control, resource consumption, and logs across all host engines
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition"
          title="Refresh Containers"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-xs text-zinc-400 mb-1">Total Workloads</div>
          <div className="text-2xl font-bold text-white font-mono">{containers.length}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-xs text-emerald-400 mb-1">Running Containers</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{runningCount}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
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
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-700/80 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Host Server:</span>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
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

      {/* ── Containers Table ── */}
      {isLoading ? (
        <div className="p-12 text-center text-zinc-500 text-sm">Inspecting Docker daemons...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800">
          <Layers className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-300 text-sm font-semibold">No containers found</p>
          <p className="text-zinc-500 text-xs mt-1">
            Ensure Docker is running on your managed servers and the ICP Agent has permissions to access /var/run/docker.sock.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden">
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
                return (
                  <tr key={c.id + (c.agentId || '')} className="hover:bg-zinc-800/30 transition">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isRunning ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-zinc-500'
                        }`}
                      />
                      {c.name}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 truncate max-w-xs">{c.image}</td>
                    <td className="py-3 px-4 text-zinc-300">{c.agentHostname || 'Local'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isRunning
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {c.cpuPct !== undefined ? `${c.cpuPct.toFixed(1)}% CPU • ${c.memoryMb || 0} MB` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => viewLogs(c)}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-[11px]"
                        title="View Logs"
                      >
                        <FileText className="w-3 h-3 inline mr-1" /> Logs
                      </button>

                      {isRunning ? (
                        <>
                          <button
                            onClick={() =>
                              c.agentId &&
                              actionMutation.mutate({
                                agentId: c.agentId,
                                containerId: c.name,
                                action: 'restart',
                              })
                            }
                            disabled={actionMutation.isPending}
                            className="px-2 py-1 rounded bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/50 transition text-[11px]"
                            title="Restart"
                          >
                            <RotateCw className="w-3 h-3 inline mr-1" /> Restart
                          </button>
                          <button
                            onClick={() =>
                              c.agentId &&
                              actionMutation.mutate({
                                agentId: c.agentId,
                                containerId: c.name,
                                action: 'stop',
                              })
                            }
                            disabled={actionMutation.isPending}
                            className="px-2 py-1 rounded bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition text-[11px]"
                            title="Stop"
                          >
                            <Square className="w-3 h-3 inline mr-1" /> Stop
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() =>
                            c.agentId &&
                            actionMutation.mutate({
                              agentId: c.agentId,
                              containerId: c.name,
                              action: 'start',
                            })
                          }
                          disabled={actionMutation.isPending}
                          className="px-2 py-1 rounded bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 transition text-[11px]"
                          title="Start"
                        >
                          <Play className="w-3 h-3 inline mr-1" /> Start
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Logs: {activeLogsContainer.name} ({activeLogsContainer.agentHostname})
              </h3>
              <button
                onClick={() => setActiveLogsContainer(null)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-xl bg-black border border-zinc-800 text-[11px] font-mono text-zinc-300 max-h-96 overflow-y-auto whitespace-pre-wrap">
                {loadingLogs ? 'Streaming tail logs from container...' : logsText}
              </pre>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => viewLogs(activeLogsContainer)}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs"
              >
                Refresh
              </button>
              <button
                onClick={() => setActiveLogsContainer(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DockerView;
