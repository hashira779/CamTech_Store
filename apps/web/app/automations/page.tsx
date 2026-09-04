'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError, BASE_URL } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type {
  AutomationFlowDto,
  CreateFlowInput,
  FlowExecutionDto,
  FlowNode,
  FlowEdge,
  FlowNodeType,
  FlowNodeSubtype,
} from '@mystore/contracts';
import {
  Workflow,
  Plus,
  Play,
  RefreshCw,
  Trash2,
  X,
  Check,
  AlertCircle,
  Clock,
  ArrowRight,
  Split,
  Send,
  LifeBuoy,
  Globe,
  Bell,
  Sliders,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Copy,
  Settings2,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Zap,
} from 'lucide-react';

export default function AutomationsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isNewFlowModalOpen, setIsNewFlowModalOpen] = useState(false);
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [isTestRunModalOpen, setIsTestRunModalOpen] = useState(false);
  const [selectedNodeToEdit, setSelectedNodeToEdit] = useState<FlowNode | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<FlowExecutionDto | null>(null);
  const [expandedTraceNodes, setExpandedTraceNodes] = useState<Record<string, boolean>>({});
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Form states
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDesc, setNewFlowDesc] = useState('');
  const [newFlowTrigger, setNewFlowTrigger] = useState('MANUAL');
  const [testPayloadStr, setTestPayloadStr] = useState('{\n  "orderId": "ORD-10023",\n  "amount": 350.0,\n  "customer": "VIP Client"\n}');

  // Node editing state
  const [nodeEditName, setNodeEditName] = useState('');
  const [nodeEditParams, setNodeEditParams] = useState<Record<string, any>>({});

  // Queries
  const { data: flows = [], refetch: refetchFlows, isLoading: loadingFlows } = useQuery({
    queryKey: ['automationFlows'],
    queryFn: () => api.listFlows(token!),
    enabled: Boolean(token),
  });

  const activeFlow = flows.find((f) => f.id === selectedFlowId) || flows[0] || null;

  const { data: executions = [], refetch: refetchExecutions } = useQuery({
    queryKey: ['flowExecutions', activeFlow?.id],
    queryFn: () => api.listFlowExecutions(token!, activeFlow!.id),
    enabled: Boolean(token && activeFlow?.id),
  });

  // Mutations
  const createFlowMutation = useMutation({
    mutationFn: (input: CreateFlowInput) => api.createFlow(token!, input),
    onSuccess: (newFlow) => {
      queryClient.invalidateQueries({ queryKey: ['automationFlows'] });
      setIsNewFlowModalOpen(false);
      setSelectedFlowId(newFlow.id);
      setNewFlowName('');
      setNewFlowDesc('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to create flow'),
  });

  const updateFlowMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateFlowInput> }) =>
      api.updateFlow(token!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationFlows'] });
      setSelectedNodeToEdit(null);
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to update flow'),
  });

  const deleteFlowMutation = useMutation({
    mutationFn: (id: string) => api.deleteFlow(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationFlows'] });
      setSelectedFlowId(null);
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to delete flow'),
  });

  const toggleFlowMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateFlow(token!, id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automationFlows'] }),
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to toggle flow'),
  });

  const executeFlowMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      api.executeFlow(token!, id, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['flowExecutions', activeFlow?.id] });
      queryClient.invalidateQueries({ queryKey: ['automationFlows'] });
      setIsTestRunModalOpen(false);
      setSelectedExecution(result);
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Execution failed'),
  });

  const handleCreateDefaultFlow = () => {
    createFlowMutation.mutate({
      name: newFlowName || 'VIP Order Alert Flow',
      description: newFlowDesc || 'Automates customer escalations and team notifications',
      triggerType: newFlowTrigger,
      nodes: [
        {
          id: 'node_trig',
          name: newFlowTrigger === 'MANUAL' ? 'Manual Trigger' : 'Webhook Ingestion',
          type: 'TRIGGER',
          subtype: newFlowTrigger === 'MANUAL' ? 'manual_trigger' : 'webhook_trigger',
          parameters: {},
          position: { x: 50, y: 150 },
        },
        {
          id: 'node_cond',
          name: 'High-Value Filter',
          type: 'CONDITION',
          subtype: 'if_condition',
          parameters: { field: '{{trigger.amount}}', operator: 'GREATER_THAN', value: 100 },
          position: { x: 300, y: 150 },
        },
        {
          id: 'node_alert',
          name: 'Notify Telegram Channel',
          type: 'ACTION',
          subtype: 'send_telegram',
          parameters: { text: '🚨 High-Value Order detected: ${{trigger.amount}} from {{trigger.customer}}' },
          position: { x: 600, y: 80 },
        },
        {
          id: 'node_ticket',
          name: 'Open Helpdesk Ticket',
          type: 'ACTION',
          subtype: 'create_ticket',
          parameters: { title: 'Standard Review Ticket for Order {{trigger.orderId}}' },
          position: { x: 600, y: 240 },
        },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'node_trig', targetNodeId: 'node_cond' },
        { id: 'e2', sourceNodeId: 'node_cond', targetNodeId: 'node_alert', sourceHandle: 'true' },
        { id: 'e3', sourceNodeId: 'node_cond', targetNodeId: 'node_ticket', sourceHandle: 'false' },
      ],
    });
  };

  const handleTestRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlow) return;
    try {
      const parsed = JSON.parse(testPayloadStr);
      executeFlowMutation.mutate({ id: activeFlow.id, payload: parsed });
    } catch {
      alert('Invalid JSON input payload');
    }
  };

  const toggleNodeTrace = (nodeId: string) => {
    setExpandedTraceNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const openNodeConfig = (node: FlowNode) => {
    setSelectedNodeToEdit(node);
    setNodeEditName(node.name);
    setNodeEditParams({ ...node.parameters });
  };

  const saveNodeConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlow || !selectedNodeToEdit) return;

    const updatedNodes = activeFlow.nodes.map((n) =>
      n.id === selectedNodeToEdit.id
        ? { ...n, name: nodeEditName, parameters: nodeEditParams }
        : n,
    );

    updateFlowMutation.mutate({
      id: activeFlow.id,
      input: { nodes: updatedNodes },
    });
  };

  const copyWebhookUrl = (flowId: string) => {
    const url = `${BASE_URL}/api/v1/flows/${flowId}/webhook`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30">
                <Workflow className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                  Flow Automation Engine
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    n8n v2.4
                  </span>
                </h1>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Visual node-based workflow orchestration. Connect triggers, conditions, alerts, and system actions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refetchFlows();
                if (activeFlow) refetchExecutions();
              }}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsNewFlowModalOpen(true)}
              className="btn flex items-center gap-1.5 text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Automation Flow
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card p-4 border-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Total Flows</span>
              <p className="text-2xl font-bold text-foreground mt-1">{flows.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="card p-4 border-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Active Automations</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {flows.filter((f) => f.isActive).length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="card p-4 border-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Recorded Executions</span>
              <p className="text-2xl font-bold text-foreground mt-1">{executions.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="card p-4 border-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Security Guard</span>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>SSRF & Timeout Protected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Flow List */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold uppercase text-muted-foreground px-1">Configured Automations</h3>
            {flows.length === 0 ? (
              <div className="card p-6 text-center border-border">
                <p className="text-xs text-muted-foreground">No flows created yet.</p>
                <button
                  onClick={() => setIsNewFlowModalOpen(true)}
                  className="btn btn-secondary text-xs mt-3 w-full"
                >
                  Create First Flow
                </button>
              </div>
            ) : (
              flows.map((flow) => {
                const isSelected = activeFlow?.id === flow.id;
                return (
                  <div
                    key={flow.id}
                    onClick={() => setSelectedFlowId(flow.id)}
                    className={`card p-3 border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-border/80 bg-card'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-xs text-foreground truncate">{flow.name}</h4>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          flow.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-400'
                        }`}
                      >
                        {flow.isActive ? 'Active' : 'Muted'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground font-mono">
                      <span>{flow.nodes.length} nodes</span>
                      <span>•</span>
                      <span>{flow.triggerType}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Visual Canvas & Execution Trace */}
          <div className="lg:col-span-3 space-y-6">
            {activeFlow ? (
              <div className="card border-border shadow-sm overflow-hidden flex flex-col">
                {/* Canvas Action Bar */}
                <div className="p-4 border-b border-border bg-accent/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground">{activeFlow.name}</h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent text-primary">
                        ID: {activeFlow.id.slice(-8)}
                      </span>
                    </div>
                    {activeFlow.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{activeFlow.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        toggleFlowMutation.mutate({
                          id: activeFlow.id,
                          isActive: !activeFlow.isActive,
                        })
                      }
                      className="btn btn-secondary text-xs py-1.5 px-3"
                    >
                      {activeFlow.isActive ? 'Disable Flow' : 'Enable Flow'}
                    </button>
                    <button
                      onClick={() => setIsTestRunModalOpen(true)}
                      disabled={executeFlowMutation.isPending}
                      className="btn text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {executeFlowMutation.isPending ? 'Executing...' : 'Run Test'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete flow '${activeFlow.name}'?`)) {
                          deleteFlowMutation.mutate(activeFlow.id);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete flow"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* n8n-style Node Flow Visualizer */}
                <div className="p-6 bg-accent/5 min-h-[300px] overflow-x-auto relative">
                  <div className="flex items-center gap-6 min-w-max py-4">
                    {activeFlow.nodes.map((node, index) => {
                      let nodeBadgeBg = 'bg-primary/10 text-primary border-primary/20';
                      let NodeIcon = Workflow;

                      if (node.type === 'TRIGGER') {
                        nodeBadgeBg = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                        NodeIcon = Play;
                      } else if (node.type === 'CONDITION') {
                        nodeBadgeBg = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                        NodeIcon = Split;
                      } else if (node.type === 'ACTION') {
                        nodeBadgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                        if (node.subtype === 'send_telegram') NodeIcon = Send;
                        else if (node.subtype === 'create_ticket') NodeIcon = LifeBuoy;
                        else if (node.subtype === 'http_request') NodeIcon = Globe;
                        else if (node.subtype === 'send_notification') NodeIcon = Bell;
                      }

                      const hasNext = index < activeFlow.nodes.length - 1;

                      return (
                        <div key={node.id} className="flex items-center gap-6">
                          <div
                            onClick={() => openNodeConfig(node)}
                            className="card w-64 p-4 border-border bg-card shadow-md relative hover:border-primary/80 transition-all cursor-pointer group hover:scale-[1.02]"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${nodeBadgeBg}`}>
                                {node.type}
                              </span>
                              <div className="p-1.5 rounded-md bg-accent text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <NodeIcon className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            <h4 className="font-bold text-xs text-foreground truncate">{node.name}</h4>
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{node.subtype}</p>

                            {/* Parameter Snippet */}
                            <div className="mt-3 pt-2 border-t border-border/60 text-[10px] text-muted-foreground font-mono truncate">
                              {node.type === 'CONDITION' && (
                                <span className="text-amber-400">
                                  {node.parameters.field} {node.parameters.operator} {node.parameters.value}
                                </span>
                              )}
                              {node.type === 'ACTION' && (
                                <span>{node.parameters.text || node.parameters.title || node.parameters.url || 'Configured'}</span>
                              )}
                              {node.type === 'TRIGGER' && <span>Event: {activeFlow.triggerType}</span>}
                            </div>

                            <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Settings2 className="w-3.5 h-3.5 text-primary" />
                            </div>
                          </div>

                          {hasNext && (
                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                              <ArrowRight className="w-5 h-5 text-muted-foreground/60" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Inbound Webhook Link Banner */}
                <div className="px-6 py-3 bg-accent/20 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-1 overflow-hidden">
                    <Globe className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground shrink-0">Inbound Webhook Endpoint:</span>
                    <span className="font-mono text-primary font-semibold truncate select-all">
                      {BASE_URL}/api/v1/flows/{activeFlow.id}/webhook
                    </span>
                  </div>
                  <button
                    onClick={() => copyWebhookUrl(activeFlow.id)}
                    className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedWebhook ? 'Copied' : 'Copy Webhook'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center border-border">
                <Workflow className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-base font-bold text-foreground">Select an automation flow</p>
                <p className="text-xs text-muted-foreground mt-1">Select a workflow from the list or click "New Flow" to begin.</p>
              </div>
            )}

            {/* n8n-style Execution History & Trace Inspector */}
            {activeFlow && (
              <div className="card border-border shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border bg-accent/20 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Execution Runs & Observability ({executions.length})
                    </h3>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {executions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No executions recorded yet. Click "Run Test" above to simulate an automated run.
                    </div>
                  ) : (
                    executions.map((exec) => {
                      const isSelected = selectedExecution?.id === exec.id;
                      const isSuccess = exec.status === 'SUCCESS';
                      return (
                        <div key={exec.id} className="p-4 hover:bg-accent/10 transition-colors">
                          <div
                            onClick={() => setSelectedExecution(isSelected ? null : exec)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isSuccess
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {exec.status}
                              </span>
                              <span className="text-xs font-bold text-foreground font-mono">
                                Run #{exec.id.slice(-6)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(exec.startedAt).toLocaleString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{exec.executionTrace.length} steps executed</span>
                              {isSelected ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                          </div>

                          {/* Expanded Step-by-Step Node Execution Trace */}
                          {isSelected && (
                            <div className="mt-4 pt-4 border-t border-border/80 space-y-3">
                              <h5 className="text-[11px] font-bold uppercase text-muted-foreground">Step Execution Trace</h5>
                              <div className="space-y-2">
                                {exec.executionTrace.map((step) => {
                                  const isExpanded = expandedTraceNodes[step.nodeId];
                                  return (
                                    <div
                                      key={step.nodeId}
                                      className="rounded-lg border border-border bg-background p-3 text-xs"
                                    >
                                      <div
                                        onClick={() => toggleNodeTrace(step.nodeId)}
                                        className="flex items-center justify-between cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`w-2 h-2 rounded-full ${
                                              step.status === 'SUCCESS' ? 'bg-emerald-400' : 'bg-rose-400'
                                            }`}
                                          />
                                          <span className="font-bold text-foreground">{step.nodeName}</span>
                                          <span className="px-1.5 py-0.2 rounded bg-accent text-[9px] font-mono text-muted-foreground">
                                            {step.subtype}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-[10px] font-mono text-muted-foreground">{step.durationMs}ms</span>
                                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        </div>
                                      </div>

                                      {isExpanded && (
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/60">
                                          <div>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Input Data</span>
                                            <pre className="p-2.5 rounded bg-black/40 border border-border font-mono text-[10px] text-zinc-300 max-h-36 overflow-auto">
                                              {JSON.stringify(step.inputData, null, 2)}
                                            </pre>
                                          </div>
                                          <div>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Output Data</span>
                                            <pre className="p-2.5 rounded bg-black/40 border border-border font-mono text-[10px] text-emerald-300 max-h-36 overflow-auto">
                                              {JSON.stringify(step.outputData || { error: step.errorMessage }, null, 2)}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL: EDIT NODE CONFIGURATION */}
        {selectedNodeToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary" />
                  Configure Node: {selectedNodeToEdit.type}
                </h3>
                <button onClick={() => setSelectedNodeToEdit(null)}><X className="w-4 h-4" /></button>
              </div>

              <form onSubmit={saveNodeConfig} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Node Name</label>
                  <input
                    required
                    value={nodeEditName}
                    onChange={(e) => setNodeEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>

                {selectedNodeToEdit.type === 'CONDITION' && (
                  <>
                    <div>
                      <label className="block uppercase font-bold text-muted-foreground mb-1">Evaluated Field Expression</label>
                      <input
                        value={nodeEditParams.field || ''}
                        onChange={(e) => setNodeEditParams({ ...nodeEditParams, field: e.target.value })}
                        placeholder="{{trigger.amount}}"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono"
                      />
                    </div>
                    <div>
                      <label className="block uppercase font-bold text-muted-foreground mb-1">Operator</label>
                      <select
                        value={nodeEditParams.operator || 'GREATER_THAN'}
                        onChange={(e) => setNodeEditParams({ ...nodeEditParams, operator: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono"
                      >
                        <option value="GREATER_THAN">GREATER_THAN (&gt;)</option>
                        <option value="LESS_THAN">LESS_THAN (&lt;)</option>
                        <option value="EQUALS">EQUALS (==)</option>
                        <option value="NOT_EQUALS">NOT_EQUALS (!=)</option>
                        <option value="CONTAINS">CONTAINS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block uppercase font-bold text-muted-foreground mb-1">Comparison Value</label>
                      <input
                        value={nodeEditParams.value || ''}
                        onChange={(e) => setNodeEditParams({ ...nodeEditParams, value: e.target.value })}
                        placeholder="100"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono"
                      />
                    </div>
                  </>
                )}

                {selectedNodeToEdit.subtype === 'send_telegram' && (
                  <div>
                    <label className="block uppercase font-bold text-muted-foreground mb-1">Message Template</label>
                    <textarea
                      rows={3}
                      value={nodeEditParams.text || ''}
                      onChange={(e) => setNodeEditParams({ ...nodeEditParams, text: e.target.value })}
                      placeholder="🚨 VIP Order Alert: ${{trigger.amount}}"
                      className="w-full p-2.5 rounded-lg border border-border bg-background"
                    />
                  </div>
                )}

                {selectedNodeToEdit.subtype === 'create_ticket' && (
                  <div>
                    <label className="block uppercase font-bold text-muted-foreground mb-1">Incident Ticket Title</label>
                    <input
                      value={nodeEditParams.title || ''}
                      onChange={(e) => setNodeEditParams({ ...nodeEditParams, title: e.target.value })}
                      placeholder="Follow up on order {{trigger.orderId}}"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                    />
                  </div>
                )}

                {selectedNodeToEdit.subtype === 'http_request' && (
                  <div>
                    <label className="block uppercase font-bold text-muted-foreground mb-1">Destination URL (SSRF Protected)</label>
                    <input
                      type="url"
                      value={nodeEditParams.url || ''}
                      onChange={(e) => setNodeEditParams({ ...nodeEditParams, url: e.target.value })}
                      placeholder="https://api.partner.com/webhook"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setSelectedNodeToEdit(null)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={updateFlowMutation.isPending} className="btn">
                    {updateFlowMutation.isPending ? 'Saving...' : 'Save Parameters'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE NEW FLOW */}
        {isNewFlowModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Create Automation Flow</h3>
                <button onClick={() => setIsNewFlowModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleCreateDefaultFlow();
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Flow Name</label>
                  <input
                    required
                    value={newFlowName}
                    onChange={(e) => setNewFlowName(e.target.value)}
                    placeholder="e.g. VIP Order Telegram Dispatcher"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Description</label>
                  <input
                    value={newFlowDesc}
                    onChange={(e) => setNewFlowDesc(e.target.value)}
                    placeholder="Short summary of this automation..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Trigger Type</label>
                  <select
                    value={newFlowTrigger}
                    onChange={(e) => setNewFlowTrigger(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  >
                    <option value="MANUAL">Manual Trigger (On-Demand / Button)</option>
                    <option value="WEBHOOK">Inbound Webhook Endpoint</option>
                    <option value="EVENT">System Business Event (Order, Stock)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsNewFlowModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createFlowMutation.isPending} className="btn">
                    {createFlowMutation.isPending ? 'Creating...' : 'Create Flow'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RUN TEST SIMULATOR */}
        {isTestRunModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-lg p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Execute Automation Test</h3>
                <button onClick={() => setIsTestRunModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleTestRun} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Simulation Payload (JSON)</label>
                  <textarea
                    rows={6}
                    required
                    value={testPayloadStr}
                    onChange={(e) => setTestPayloadStr(e.target.value)}
                    className="w-full p-3 rounded-lg border border-border bg-background font-mono text-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The flow engine will evaluate the nodes, interpolate parameters, traverse conditions, and record step results.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsTestRunModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={executeFlowMutation.isPending} className="btn flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5" />
                    {executeFlowMutation.isPending ? 'Executing...' : 'Run Flow'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
