import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Layers,
  Zap,
  Check,
  X,
  ArrowRight,
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

type FrequencyType = 'daily' | 'hourly' | 'six_hours' | 'weekly' | 'custom';

export function SchedulerView() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>('daily');
  const [dailyHour, setDailyHour] = useState('04:00');
  const [weeklyDay, setWeeklyDay] = useState('0'); // 0 = Sunday
  const [customCron, setCustomCron] = useState('0 4 * * *');
  const [actionCategory, setActionCategory] = useState<'service' | 'docker' | 'system' | 'custom'>('service');
  const [selectedContainer, setSelectedContainer] = useState('camtech-gateway');
  const [selectedService, setSelectedService] = useState('camtech-backend');
  const [customCommand, setCustomCommand] = useState('');
  const [newTaskAgentId, setNewTaskAgentId] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch agents
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ['infra-agents'],
    queryFn: async () => {
      return (await apiClient.get<any[]>('/infra/agents')) || [];
    },
  });

  // Fetch live docker containers to populate container choices
  const { data: liveContainers = [] } = useQuery<any[]>({
    queryKey: ['infra-docker-containers-list'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>('/infra/docker/containers');
        return res?.containers || [];
      } catch {
        return [];
      }
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

  // Compute effective cron expression
  const computeCron = (): string => {
    if (frequency === 'hourly') return '0 * * * *';
    if (frequency === 'six_hours') return '0 */6 * * *';
    if (frequency === 'daily') {
      const [h, m] = dailyHour.split(':');
      return `${parseInt(m, 10) || 0} ${parseInt(h, 10) || 0} * * *`;
    }
    if (frequency === 'weekly') {
      const [h, m] = dailyHour.split(':');
      return `${parseInt(m, 10) || 0} ${parseInt(h, 10) || 0} * * ${weeklyDay}`;
    }
    return customCron;
  };

  // Human readable description of the schedule
  const getScheduleSummary = (): string => {
    if (frequency === 'hourly') return 'Every hour at minute :00';
    if (frequency === 'six_hours') return 'Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)';
    if (frequency === 'daily') return `Every day at ${dailyHour} UTC`;
    if (frequency === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `Every ${days[parseInt(weeklyDay, 10)] || 'Sunday'} at ${dailyHour} UTC`;
    }
    return `Custom: ${customCron}`;
  };

  // Compute effective command
  const computeCommand = (): string => {
    if (actionCategory === 'service') return `system.restart:${selectedService}`;
    if (actionCategory === 'docker') return `docker.restart:${selectedContainer}`;
    if (actionCategory === 'system') return 'docker system prune -f';
    return customCommand || 'echo 1';
  };

  // Auto-generate name and description when category/schedule changes if user hasn't typed custom
  const applyTemplate = (template: {
    title: string;
    description: string;
    frequency: FrequencyType;
    dailyHour?: string;
    weeklyDay?: string;
    actionCategory: 'service' | 'docker' | 'system' | 'custom';
    service?: string;
    container?: string;
    customCommand?: string;
    customCron?: string;
  }) => {
    setNewTaskName(template.title);
    setNewTaskDesc(template.description);
    setFrequency(template.frequency);
    if (template.dailyHour) setDailyHour(template.dailyHour);
    if (template.weeklyDay) setWeeklyDay(template.weeklyDay);
    if (template.customCron) setCustomCron(template.customCron);
    setActionCategory(template.actionCategory);
    if (template.service) setSelectedService(template.service);
    if (template.container) setSelectedContainer(template.container);
    if (template.customCommand) setCustomCommand(template.customCommand);
  };

  const QUICK_TEMPLATES = [
    {
      title: 'Nightly Backend Auto-Restart',
      description: 'Clears memory leaks and recycles backend workers daily at 04:00 AM',
      frequency: 'daily' as FrequencyType,
      dailyHour: '04:00',
      actionCategory: 'service' as const,
      service: 'camtech-backend',
      badge: 'Recommended',
      icon: RotateCw,
    },
    {
      title: 'Weekly Docker Disk Prune',
      description: 'Reclaims disk space by pruning dangling images and build caches every Sunday at 03:00 AM',
      frequency: 'weekly' as FrequencyType,
      weeklyDay: '0',
      dailyHour: '03:00',
      actionCategory: 'system' as const,
      badge: 'Disk Health',
      icon: Trash2,
    },
    {
      title: 'Restart Gateway Proxy',
      description: 'Recycles the reverse proxy gateway container daily at 04:30 AM',
      frequency: 'daily' as FrequencyType,
      dailyHour: '04:30',
      actionCategory: 'docker' as const,
      container: 'mystore-infra-service',
      badge: 'Network',
      icon: Server,
    },
    {
      title: 'Drop RAM Caches (Every 6h)',
      description: 'Flushes Linux pagecache, dentries and inodes every 6 hours to keep memory usage low',
      frequency: 'six_hours' as FrequencyType,
      actionCategory: 'custom' as const,
      customCommand: 'sync && echo 3 > /proc/sys/vm/drop_caches',
      badge: 'Performance',
      icon: Zap,
    },
  ];

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
      showToast('success', 'Scheduled task created successfully');
    },
    onError: (err: any) => {
      showToast('error', `Failed to create task: ${err.message || 'Error'}`);
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
      showToast('success', 'Scheduled task deleted');
    },
  });

  // Run Now Mutation
  const runNowMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.post<any>(`/infra/tasks/${id}/run`, {});
    },
    onSuccess: (data) => {
      showToast('success', `Execution triggered: ${data?.result || 'Completed'}`);
      queryClient.invalidateQueries({ queryKey: ['infra-scheduled-tasks'] });
    },
    onError: (err: any) => {
      showToast('error', `Run failed: ${err.message || 'Error'}`);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cron = computeCron();
    const cmd = computeCommand();
    const name = newTaskName || `${getScheduleSummary()} - ${cmd}`;

    createMutation.mutate({
      name,
      description: newTaskDesc || `Automated schedule: ${getScheduleSummary()}`,
      cronExpr: cron,
      command: cmd,
      agentId: newTaskAgentId || null,
      enabled: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-primary" />
            Scheduled Operations &amp; Cron Triggers
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Automate routine service restarts, database optimizations, backups, and maintenance cron schedules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-card border border-border text-foreground hover:text-foreground hover:border-border transition cursor-pointer"
            title="Refresh Tasks"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              applyTemplate(QUICK_TEMPLATES[0]);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Scheduled Task
          </button>
        </div>
      </div>

      {/* ── Task List ── */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground text-sm font-mono">Loading scheduler cron jobs...</div>
      ) : tasks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card/40 border border-dashed border-border space-y-4">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto" />
          <div>
            <p className="text-foreground text-sm font-semibold">No scheduled operations configured</p>
            <p className="text-muted-foreground text-xs mt-1 max-w-md mx-auto">
              Automate nightly container recycles, memory cleanup, or database maintenance without writing raw cron syntax.
            </p>
          </div>
          <button
            onClick={() => {
              applyTemplate(QUICK_TEMPLATES[0]);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer shadow-md shadow-primary/20 transition"
          >
            Create 1-Click Nightly Auto-Restart
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => {
            const agent = agents.find((a) => a.id === task.agentId);
            return (
              <div
                key={task.id}
                className="p-4 rounded-xl bg-card/70 border border-border/80 hover:border-border transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                        {task.name}
                        {task.enabled ? (
                          <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_color-mix(in srgb, var(--success) 70%, transparent)]" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-accent" />
                        )}
                      </h4>
                      {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                    </div>

                    <button
                      onClick={() => toggleMutation.mutate({ id: task.id, enabled: !task.enabled })}
                      className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                      title={task.enabled ? 'Pause Schedule' : 'Enable Schedule'}
                    >
                      {task.enabled ? (
                        <ToggleRight className="w-6 h-6 text-primary" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {/* Task Specs */}
                  <div className="mt-3.5 space-y-1.5 p-2.5 rounded-lg bg-card/60 border border-border/60 font-mono text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Schedule:</span>
                      <span className="text-primary font-bold bg-primary/15 px-2 py-0.5 rounded border border-primary/30">
                        {task.cronExpr}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Command:</span>
                      <span className="text-foreground truncate max-w-[200px]" title={task.command}>
                        {task.command}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Target Host:</span>
                      <span className="text-foreground">{agent ? agent.hostname : 'Platform Cluster'}</span>
                    </div>
                  </div>

                  {/* Execution Feedback */}
                  {task.lastResult && (
                    <div className="mt-3 p-2 rounded bg-card/40 border border-border text-[11px] font-mono text-muted-foreground truncate">
                      Last execution: <span className="text-success">{task.lastResult}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {task.lastRunAt ? `Last run: ${new Date(task.lastRunAt).toLocaleTimeString()}` : 'Never executed'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runNowMutation.mutate(task.id)}
                      disabled={runNowMutation.isPending}
                      className="px-2.5 py-1 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <Play className="w-3 h-3" /> Run Now
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete scheduled task "${task.name}"?`)) {
                          deleteMutation.mutate(task.id);
                        }
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition cursor-pointer"
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

      {/* ── Create Task Modal (Easy Mode + Presets + Visual Picker) ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/15 border border-primary/30 text-primary">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Create Cron Trigger &amp; Operation</h3>
                  <p className="text-xs text-muted-foreground">
                    Choose a quick template or configure a custom recurring schedule in plain English
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Quick Templates Section ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  1-Click Quick Templates
                </span>
                <span className="text-[11px] text-muted-foreground">Click to auto-fill everything</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {QUICK_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyTemplate(tmpl)}
                    className="p-3 rounded-xl bg-card/80 hover:bg-accent border border-border hover:border-primary/50 text-left transition group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-bold text-foreground group-hover:text-primary transition flex items-center gap-1.5">
                        <tmpl.icon className="w-3.5 h-3.5 text-primary" />
                        {tmpl.title}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                        {tmpl.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{tmpl.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 pt-1 border-t border-border/80">
              {/* ── 1. Schedule Frequency (Visual Picker) ── */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  1. How often should it run?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { key: 'daily', label: 'Daily', desc: 'Once a day' },
                    { key: 'hourly', label: 'Hourly', desc: 'Every 60 mins' },
                    { key: 'six_hours', label: 'Every 6h', desc: '4x daily' },
                    { key: 'weekly', label: 'Weekly', desc: 'Once a week' },
                    { key: 'custom', label: 'Custom', desc: 'Raw cron' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFrequency(f.key as FrequencyType)}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        frequency === f.key
                          ? 'bg-primary/20 border-primary text-foreground shadow-[0_0_12px_rgba(243,128,32,0.25)]'
                          : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                    >
                      <div className="text-xs font-bold">{f.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{f.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Sub-selectors for Frequency */}
                <div className="mt-3 p-3 rounded-xl bg-card/80 border border-border/80 space-y-2.5">
                  {frequency === 'daily' && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Run daily at:</span>
                      <select
                        value={dailyHour}
                        onChange={(e) => setDailyHour(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                      >
                        {[
                          '00:00',
                          '01:00',
                          '02:00',
                          '03:00',
                          '04:00',
                          '04:30',
                          '05:00',
                          '06:00',
                          '12:00',
                          '18:00',
                          '23:00',
                        ].map((t) => (
                          <option key={t} value={t}>
                            {t} UTC ({parseInt(t.split(':')[0], 10) < 12 ? `${t} AM` : `${t} PM`})
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground font-mono">Recommended: 04:00 AM (lowest traffic)</span>
                    </div>
                  )}

                  {frequency === 'weekly' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-muted-foreground">Run on:</span>
                      <select
                        value={weeklyDay}
                        onChange={(e) => setWeeklyDay(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                      >
                        <option value="0">Sunday</option>
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                      </select>
                      <span className="text-xs text-muted-foreground">at:</span>
                      <select
                        value={dailyHour}
                        onChange={(e) => setDailyHour(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                      >
                        <option value="02:00">02:00 AM UTC</option>
                        <option value="03:00">03:00 AM UTC</option>
                        <option value="04:00">04:00 AM UTC</option>
                      </select>
                    </div>
                  )}

                  {frequency === 'hourly' && (
                    <p className="text-xs text-muted-foreground font-mono">
                      ⚡ Triggers automatically at minute :00 of every hour (e.g. 01:00, 02:00, 03:00...)
                    </p>
                  )}

                  {frequency === 'six_hours' && (
                    <p className="text-xs text-muted-foreground font-mono">
                      ⚡ Triggers 4 times daily: at 00:00, 06:00, 12:00, and 18:00 UTC
                    </p>
                  )}

                  {frequency === 'custom' && (
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Custom Cron Expression (min hour day month weekday)</label>
                      <input
                        type="text"
                        placeholder="0 4 * * *"
                        value={customCron}
                        onChange={(e) => setCustomCron(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}

                  {/* Live Plain English Translation Badge */}
                  <div className="flex items-center gap-2 pt-1 border-t border-border/60 text-xs font-mono">
                    <span className="text-muted-foreground">Plain English:</span>
                    <span className="text-success font-bold">{getScheduleSummary()}</span>
                    <span className="text-muted-foreground">({computeCron()})</span>
                  </div>
                </div>
              </div>

              {/* ── 2. Action / Command Selection ── */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  2. What action should be executed?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    { key: 'service', label: 'Service Restart', icon: RotateCw },
                    { key: 'docker', label: 'Docker Container', icon: Layers },
                    { key: 'system', label: 'System Cleanup', icon: Trash2 },
                    { key: 'custom', label: 'Custom Shell', icon: Terminal },
                  ].map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setActionCategory(cat.key as any)}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        actionCategory === cat.key
                          ? 'bg-primary/20 border-primary text-foreground shadow-[0_0_12px_rgba(243,128,32,0.25)]'
                          : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                    >
                      <cat.icon className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium">{cat.label}</span>
                    </button>
                  ))}
                </div>

                {/* Sub-inputs per action category */}
                <div className="p-3 rounded-xl bg-card/80 border border-border/80">
                  {actionCategory === 'service' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <span className="text-xs text-muted-foreground shrink-0">Select Service:</span>
                      <select
                        value={selectedService}
                        onChange={(e) => setSelectedService(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                      >
                        <option value="camtech-backend">camtech-backend (FastAPI Monolith)</option>
                        <option value="camtech-gateway">camtech-gateway (API Gateway)</option>
                        <option value="nginx">nginx (Web Server Proxy)</option>
                        <option value="postgresql">postgresql (Database Engine)</option>
                        <option value="redis">redis (Event Queue / Cache)</option>
                      </select>
                    </div>
                  )}

                  {actionCategory === 'docker' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <span className="text-xs text-muted-foreground shrink-0">Select Container:</span>
                      <select
                        value={selectedContainer}
                        onChange={(e) => setSelectedContainer(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                      >
                        {liveContainers.length > 0 ? (
                          liveContainers.map((c: any) => (
                            <option key={c.name} value={c.name}>
                              {c.name} ({c.image})
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="mystore-infra-service">mystore-infra-service</option>
                            <option value="mystore-infra-app">mystore-infra-app</option>
                            <option value="camtech-gateway">camtech-gateway</option>
                            <option value="postgres-replica">postgres-replica</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}

                  {actionCategory === 'system' && (
                    <div className="text-xs text-foreground font-mono flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      <span>Command: `docker system prune -f` (Prunes unused images and dangling volumes)</span>
                    </div>
                  )}

                  {actionCategory === 'custom' && (
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Enter shell / agent command:</label>
                      <input
                        type="text"
                        placeholder="e.g. sync && echo 3 > /proc/sys/vm/drop_caches"
                        value={customCommand}
                        onChange={(e) => setCustomCommand(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ── 3. Name & Host (Optional customization) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Operation Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Nightly Backend Auto-Restart"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Target Host</label>
                  <select
                    value={newTaskAgentId}
                    onChange={(e) => setNewTaskAgentId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                  >
                    <option value="">Platform Cluster (All Nodes)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.hostname} ({a.ipAddress})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Clears memory leaks by restarting container at 04:00 AM"
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border/80">
                <div className="text-[11px] text-muted-foreground font-mono hidden sm:block">
                  Command: <strong className="text-foreground">{computeCommand()}</strong>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted text-xs cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {createMutation.isPending ? 'Scheduling...' : 'Save Scheduled Task'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast Notification Banner ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm transition duration-panel animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'success'
              ? 'bg-card/95 border-success/50 text-success shadow-emerald-500/10'
              : 'bg-card/95 border-destructive/50 text-destructive shadow-rose-500/10'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          )}
          <span className="text-xs font-mono font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default SchedulerView;
