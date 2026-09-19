import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Play,
  Plus,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Server,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Terminal,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  agentId?: string;
  cronExpr: string;
  command: string;
  parameters: Record<string, any>;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastResult?: string;
  createdAt?: string;
}

export function SchedulerView() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskCron, setNewTaskCron] = useState('0 4 * * *');
  const [newTaskCommand, setNewTaskCommand] = useState('system.restart:camtech-backend');
  const [newTaskAgentId, setNewTaskAgentId] = useState('');

  // Fetch agents
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ['infra-agents'],
    queryFn: async () => {
      return (await apiClient.get<any[]>('/infra/agents')) || [];
    },
  });

  // Fetch scheduled tasks
  const { data: tasks = [], isLoading, refetch } = useQuery<ScheduledTask[]>({
    queryKey: ['infra-scheduled-tasks'],
    queryFn: async () => {
      const res = await apiClient.get<ScheduledTask[]>('/infra/tasks');
      return res || [];
    },
  });

  // Create Task Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiClient.post<any>('/infra/tasks', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-scheduled-tasks'] });
      setShowAddModal(false);
      setNewTaskName('');
      setNewTaskDesc('');
    },
  });

  // Toggle Task Enable Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return await apiClient.put<any>(`/infra/tasks/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-scheduled-tasks'] });
    },
  });

  // Delete Task Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete<any>(`/infra/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-scheduled-tasks'] });
    },
  });

  // Run Now Mutation
  const runNowMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.post<any>(`/infra/tasks/${id}/run`, {});
    },
    onSuccess: (data) => {
      alert(`Execution triggered: ${data?.result || 'Done'}`);
      queryClient.invalidateQueries({ queryKey: ['infra-scheduled-tasks'] });
    },
    onError: (err: any) => {
      alert(`Run failed: ${err.message || 'Error'}`);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName || !newTaskCron || !newTaskCommand) return;
    createMutation.mutate({
      name: newTaskName,
      description: newTaskDesc,
      cronExpr: newTaskCron,
      command: newTaskCommand,
      agentId: newTaskAgentId || null,
      enabled: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-indigo-400" />
            Scheduled Operations & Auto-Remediation
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Automate routine service restarts, database optimizations, backups, and maintenance cron schedules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition"
            title="Refresh Tasks"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Scheduled Task
          </button>
        </div>
      </div>

      {/* ── Task List ── */}
      {isLoading ? (
        <div className="p-12 text-center text-zinc-500 text-sm">Loading scheduler cron jobs...</div>
      ) : tasks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800">
          <Calendar className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-300 text-sm font-semibold">No scheduled operations configured</p>
          <p className="text-zinc-500 text-xs mt-1">
            Configure automated cron jobs to restart memory-heavy services nightly or run automated backups.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Create Nightly Auto-Restart
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => {
            const agent = agents.find((a) => a.id === task.agentId);
            return (
              <div
                key={task.id}
                className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        {task.name}
                        {task.enabled ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-zinc-600" />
                        )}
                      </h4>
                      {task.description && <p className="text-xs text-zinc-400 mt-0.5">{task.description}</p>}
                    </div>

                    <button
                      onClick={() => toggleMutation.mutate({ id: task.id, enabled: !task.enabled })}
                      className="text-zinc-400 hover:text-white transition cursor-pointer"
                      title={task.enabled ? 'Pause Schedule' : 'Enable Schedule'}
                    >
                      {task.enabled ? (
                        <ToggleRight className="w-6 h-6 text-indigo-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-zinc-600" />
                      )}
                    </button>
                  </div>

                  {/* Task Specs */}
                  <div className="mt-3.5 space-y-1.5 p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 font-mono text-xs">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Cron Expression:</span>
                      <span className="text-indigo-400 font-bold bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/50">
                        {task.cronExpr}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Command:</span>
                      <span className="text-zinc-200 truncate max-w-[200px]">{task.command}</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Target Host:</span>
                      <span className="text-zinc-300">{agent ? agent.hostname : 'Platform Cluster'}</span>
                    </div>
                  </div>

                  {/* Execution Feedback */}
                  {task.lastResult && (
                    <div className="mt-3 p-2 rounded bg-zinc-950/40 border border-zinc-800 text-[11px] font-mono text-zinc-400 truncate">
                      Last execution: <span className="text-emerald-400">{task.lastResult}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {task.lastRunAt ? `Last run: ${new Date(task.lastRunAt).toLocaleTimeString()}` : 'Never executed'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runNowMutation.mutate(task.id)}
                      disabled={runNowMutation.isPending}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Play className="w-3 h-3" /> Run Now
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete scheduled task "${task.name}"?`)) {
                          deleteMutation.mutate(task.id);
                        }
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Task Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> New Scheduled Operation
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Operation Name</label>
              <input
                type="text"
                placeholder="e.g. Nightly Backend Auto-Restart"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Clears memory leaks by restarting container at 04:00 AM"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Cron Schedule</label>
                <input
                  type="text"
                  placeholder="0 4 * * *"
                  value={newTaskCron}
                  onChange={(e) => setNewTaskCron(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-indigo-400 font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-zinc-500 mt-0.5 block">Default: 4:00 AM nightly</span>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Target Host</label>
                <select
                  value={newTaskAgentId}
                  onChange={(e) => setNewTaskAgentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Platform Cluster (All)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.hostname} ({a.ipAddress})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Command / Action</label>
              <select
                value={newTaskCommand}
                onChange={(e) => setNewTaskCommand(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
              >
                <option value="system.restart:camtech-backend">Restart Backend Service</option>
                <option value="docker.restart:camtech-gateway">Restart Gateway Container</option>
                <option value="docker.restart:postgres-replica">Restart Read Replica Container</option>
                <option value="docker system prune -f">Docker System Cleanup (Prune dangling)</option>
                <option value="sync && echo 3 > /proc/sys/vm/drop_caches">Drop Linux Memory Caches</option>
                <option value="system.reboot">Server Operating System Reboot</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {createMutation.isPending ? 'Scheduling...' : 'Save Scheduled Task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default SchedulerView;
