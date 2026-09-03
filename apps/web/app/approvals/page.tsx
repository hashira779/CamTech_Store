'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type {
  WorkflowInstanceDto,
  WorkflowStatus,
  WorkflowEntityType,
  SubmitApprovalInput,
} from '@mystore/contracts';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  X,
  Check,
} from 'lucide-react';

export default function ApprovalsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<WorkflowStatus | 'ALL'>('PENDING');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstanceDto | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  // Submit Form
  const [newTitle, setNewTitle] = useState('');
  const [newEntityType, setNewEntityType] = useState<WorkflowEntityType>('PURCHASE_ORDER');
  const [newEntityId, setNewEntityId] = useState('');

  const { data: instances = [], refetch, isLoading } = useQuery({
    queryKey: ['workflowInstances', filterStatus],
    queryFn: () => api.listWorkflowInstances(token!, filterStatus === 'ALL' ? undefined : filterStatus),
    enabled: Boolean(token),
  });

  const submitMutation = useMutation({
    mutationFn: (input: SubmitApprovalInput) => api.submitWorkflowApproval(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
      setIsSubmitModalOpen(false);
      setNewTitle('');
      setNewEntityId('');
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to submit workflow');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ instanceId, stepId, action, comment }: { instanceId: string; stepId: string; action: 'APPROVE' | 'REJECT'; comment?: string }) =>
      api.reviewWorkflowStep(token!, instanceId, stepId, { action, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
      setSelectedInstance(null);
      setReviewComment('');
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to review step');
    },
  });

  const handleReview = (instanceId: string, stepId: string, action: 'APPROVE' | 'REJECT') => {
    reviewMutation.mutate({ instanceId, stepId, action, comment: reviewComment });
  };

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newEntityId.trim()) return;
    submitMutation.mutate({
      title: newTitle.trim(),
      entityType: newEntityType,
      entityId: newEntityId.trim(),
    });
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Workflow & Approvals Inbox
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Universal multi-step governance engine for purchase orders, refunds, and financial adjustments.
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
              onClick={() => setIsSubmitModalOpen(true)}
              className="btn flex items-center gap-1.5 text-sm shadow-sm shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> New Approval Request
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === status
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {status === 'ALL' ? 'All Requests' : status}
            </button>
          ))}
        </div>

        {/* Workflow Instances List */}
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading approval requests...</div>
        ) : instances.length === 0 ? (
          <div className="card p-12 text-center border-border">
            <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-base font-semibold text-foreground">Inbox is clear</p>
            <p className="text-xs text-muted-foreground mt-1">No workflow requests matching filter '{filterStatus}'.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {instances.map((item) => {
              const currentPendingStep = item.steps.find((s) => s.status === 'PENDING');
              return (
                <div
                  key={item.id}
                  className="card p-5 border-border hover:border-primary/40 transition-all flex flex-col gap-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-semibold uppercase flex items-center gap-1.5 ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {item.status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {item.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
                        {item.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                        {item.status}
                      </span>
                      <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-accent text-muted-foreground font-mono">
                        {item.entityType} #{item.entityId}
                      </span>
                    </div>

                    <span className="text-xs text-muted-foreground font-mono">
                      Step {item.currentStep} of {item.totalSteps}
                    </span>
                  </div>

                  {/* Steps Progress Visualizer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {item.steps.map((step) => (
                      <div
                        key={step.id}
                        className={`p-3 rounded-lg border text-xs flex flex-col gap-1 ${
                          step.status === 'APPROVED'
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : step.status === 'REJECTED'
                            ? 'border-rose-500/30 bg-rose-500/5'
                            : 'border-border bg-accent/20'
                        }`}
                      >
                        <div className="flex justify-between items-center font-semibold">
                          <span className="text-foreground">
                            {step.stepOrder}. {step.name}
                          </span>
                          <span
                            className={`font-mono text-[10px] ${
                              step.status === 'APPROVED'
                                ? 'text-emerald-400'
                                : step.status === 'REJECTED'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>
                        {step.assignedRole && (
                          <p className="text-[11px] text-muted-foreground">Assignee: {step.assignedRole}</p>
                        )}
                        {step.comment && (
                          <p className="text-[11px] text-foreground/80 italic mt-1">"{step.comment}"</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Actions Bar if Pending */}
                  {item.status === 'PENDING' && currentPendingStep && (
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex-1 max-w-md mr-4">
                        <input
                          type="text"
                          placeholder="Optional review comment or justification..."
                          value={selectedInstance?.id === item.id ? reviewComment : ''}
                          onChange={(e) => {
                            setSelectedInstance(item);
                            setReviewComment(e.target.value);
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReview(item.id, currentPendingStep.id, 'APPROVE')}
                          className="btn text-xs py-1.5 px-3 flex items-center gap-1 shadow-sm bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve Step
                        </button>
                        <button
                          onClick={() => handleReview(item.id, currentPendingStep.id, 'REJECT')}
                          className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 text-destructive hover:bg-destructive/10"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL: NEW APPROVAL REQUEST */}
        {isSubmitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Initiate Approval Request</h3>
                <button onClick={() => setIsSubmitModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitNew} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Request Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Approve Hardware Purchase Order #42"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Entity Type</label>
                  <select
                    value={newEntityType}
                    onChange={(e) => setNewEntityType(e.target.value as WorkflowEntityType)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="PURCHASE_ORDER">PURCHASE_ORDER (Procurement)</option>
                    <option value="SALE_REFUND">SALE_REFUND (POS Refund)</option>
                    <option value="STOCK_TRANSFER">STOCK_TRANSFER (Warehouse WMS)</option>
                    <option value="JOURNAL_ENTRY">JOURNAL_ENTRY (Finance Ledger)</option>
                    <option value="EXPENSE_CLAIM">EXPENSE_CLAIM (Operating Expenses)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Entity ID / Reference</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. po_cuid_123 or JE-2026-00001"
                    value={newEntityId}
                    onChange={(e) => setNewEntityId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsSubmitModalOpen(false)} className="btn btn-secondary text-xs">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitMutation.isPending} className="btn text-xs shadow-sm shadow-primary/20">
                    {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
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
