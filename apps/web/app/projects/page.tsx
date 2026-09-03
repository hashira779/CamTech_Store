'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type {
  ProjectDto,
  CreateProjectInput,
  CreateProjectTaskInput,
  LogTimesheetInput,
} from '@mystore/contracts';
import {
  FolderKanban,
  Plus,
  RefreshCw,
  Clock,
  DollarSign,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function ProjectsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Project Form
  const [prjCode, setPrjCode] = useState('');
  const [prjName, setPrjName] = useState('');
  const [prjBudget, setPrjBudget] = useState('10000');

  // Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskEstHours, setTaskEstHours] = useState('8');

  // Timesheet Form
  const [tsHours, setTsHours] = useState('4');
  const [tsNotes, setTsNotes] = useState('');

  const { data: projects = [], refetch, isLoading } = useQuery({
    queryKey: ['projectsList'],
    queryFn: () => api.listProjects(token!),
    enabled: Boolean(token),
  });

  const createProjectMutation = useMutation({
    mutationFn: (input: CreateProjectInput) => api.createProject(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectsList'] });
      setIsProjectModalOpen(false);
      setPrjCode('');
      setPrjName('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to create project'),
  });

  const createTaskMutation = useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: CreateProjectTaskInput }) =>
      api.createProjectTask(token!, projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectsList'] });
      setIsTaskModalOpen(false);
      setTaskTitle('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to add task'),
  });

  const logTimesheetMutation = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: LogTimesheetInput }) =>
      api.logTimesheet(token!, taskId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectsList'] });
      setIsTimesheetModalOpen(false);
      setTsNotes('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to log hours'),
  });

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FolderKanban className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Projects & Timesheets
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Initiatives, budgets, milestone tasks, and worker billable hour tracking.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="btn flex items-center gap-1.5 text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>

        {/* Projects Cards */}
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="card p-12 text-center border-border">
            <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-base font-semibold text-foreground">No projects defined</p>
            <p className="text-xs text-muted-foreground mt-1">Create a project to begin tracking milestones and hours.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map((p) => (
              <div key={p.id} className="card p-6 border-border shadow-sm flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold text-xs">
                      {p.code}
                    </span>
                    <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground font-semibold">
                      {p.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Budget</span>
                      <span className="font-mono font-bold text-foreground">${p.budget.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Logged Hours</span>
                      <span className="font-mono font-bold text-emerald-400">{p.totalActualHours || 0} hrs</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        setIsTaskModalOpen(true);
                      }}
                      className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Task
                    </button>
                  </div>
                </div>

                {/* Tasks Table */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-accent/40 text-muted-foreground">
                        <th className="p-2.5 font-semibold">Task Title</th>
                        <th className="p-2.5 font-semibold">Status</th>
                        <th className="p-2.5 font-semibold text-right">Est. Hours</th>
                        <th className="p-2.5 font-semibold text-right">Actual Hours</th>
                        <th className="p-2.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(p.tasks || []).map((t) => (
                        <tr key={t.id} className="hover:bg-accent/20">
                          <td className="p-2.5 font-medium text-foreground">{t.title}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-accent text-muted-foreground">
                              {t.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono text-muted-foreground">{t.estimatedHours}h</td>
                          <td className="p-2.5 text-right font-mono font-bold text-foreground">{t.actualHours}h</td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedTaskId(t.id);
                                setIsTimesheetModalOpen(true);
                              }}
                              className="btn py-1 px-2 text-[11px] flex items-center gap-1 ml-auto"
                            >
                              <Clock className="w-3 h-3" /> Log Time
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL: NEW PROJECT */}
        {isProjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Create New Project</h3>
                <button onClick={() => setIsProjectModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createProjectMutation.mutate({ code: prjCode, name: prjName, budget: parseFloat(prjBudget) || 0 });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Project Code</label>
                  <input required value={prjCode} onChange={(e) => setPrjCode(e.target.value)} placeholder="e.g. PRJ-2026-03" className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Project Name</label>
                  <input required value={prjName} onChange={(e) => setPrjName(e.target.value)} placeholder="e.g. Warehouse Automation" className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Budget Allocation ($)</label>
                  <input type="number" min="0" step="0.01" required value={prjBudget} onChange={(e) => setPrjBudget(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsProjectModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createProjectMutation.isPending} className="btn">{createProjectMutation.isPending ? 'Saving...' : 'Create Project'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: NEW TASK */}
        {isTaskModalOpen && selectedProjectId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-sm p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Add Project Task</h3>
                <button onClick={() => setIsTaskModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createTaskMutation.mutate({
                  projectId: selectedProjectId,
                  input: { projectId: selectedProjectId, title: taskTitle, estimatedHours: parseFloat(taskEstHours) || 0 },
                });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Task Title</label>
                  <input required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Install barcode scanners" className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Estimated Hours</label>
                  <input type="number" min="0.5" step="0.5" required value={taskEstHours} onChange={(e) => setTaskEstHours(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsTaskModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createTaskMutation.isPending} className="btn">{createTaskMutation.isPending ? 'Adding...' : 'Add Task'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: LOG TIMESHEET */}
        {isTimesheetModalOpen && selectedTaskId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-sm p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Log Worked Hours</h3>
                <button onClick={() => setIsTimesheetModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                logTimesheetMutation.mutate({
                  taskId: selectedTaskId,
                  input: { taskId: selectedTaskId, hours: parseFloat(tsHours) || 0, notes: tsNotes || undefined },
                });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Hours Worked</label>
                  <input type="number" min="0.25" step="0.25" required value={tsHours} onChange={(e) => setTsHours(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Notes / Description</label>
                  <input value={tsNotes} onChange={(e) => setTsNotes(e.target.value)} placeholder="Summary of work performed..." className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsTimesheetModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={logTimesheetMutation.isPending} className="btn">{logTimesheetMutation.isPending ? 'Logging...' : 'Log Time'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
