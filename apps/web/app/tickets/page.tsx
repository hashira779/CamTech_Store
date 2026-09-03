'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type {
  ServiceTicketDto,
  TicketStatus,
  TicketPriority,
  CreateServiceTicketInput,
  AddTicketCommentInput,
} from '@mystore/contracts';
import {
  LifeBuoy,
  Plus,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  X,
  Send,
} from 'lucide-react';

export default function TicketsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'ALL'>('OPEN');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // New Ticket Form
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [category, setCategory] = useState('POS_TERMINAL');

  // Comment Form
  const [commentText, setCommentText] = useState('');

  const { data: tickets = [], refetch, isLoading } = useQuery({
    queryKey: ['ticketsList', filterStatus],
    queryFn: () => api.listTickets(token!, filterStatus === 'ALL' ? undefined : filterStatus),
    enabled: Boolean(token),
  });

  const createTicketMutation = useMutation({
    mutationFn: (input: CreateServiceTicketInput) => api.createTicket(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticketsList'] });
      setIsModalOpen(false);
      setSubject('');
      setDescription('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to create ticket'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: TicketStatus; resolution?: string }) =>
      api.updateTicketStatus(token!, id, status, resolution),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticketsList'] }),
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to update status'),
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddTicketCommentInput }) =>
      api.addTicketComment(token!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticketsList'] });
      setCommentText('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to add comment'),
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
                <LifeBuoy className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Service Desk & Helpdesk
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Operational incident resolution, hardware maintenance tickets, and support dispatch.
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
              onClick={() => setIsModalOpen(true)}
              className="btn flex items-center gap-1.5 text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create Ticket
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 border-b border-border pb-3 flex-wrap">
          {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ALL'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === st
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {st === 'ALL' ? 'All Incidents' : st}
            </button>
          ))}
        </div>

        {/* Tickets Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="card p-12 text-center border-border">
            <LifeBuoy className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-base font-semibold text-foreground">No active incidents</p>
            <p className="text-xs text-muted-foreground mt-1">No support tickets found matching '{filterStatus}'.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => {
              const priorityColors: Record<TicketPriority, string> = {
                CRITICAL: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                HIGH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                MEDIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                LOW: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
              };

              return (
                <div key={t.id} className="card p-5 border-border shadow-sm flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono font-bold text-foreground text-xs">{t.ticketNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityColors[t.priority]}`}>
                        {t.priority}
                      </span>
                      <h3 className="text-base font-bold text-foreground">{t.subject}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-accent text-muted-foreground font-mono">
                        {t.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.status === 'OPEN' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: t.id, status: 'IN_PROGRESS' })}
                          className="btn btn-secondary text-xs py-1 px-2.5"
                        >
                          Start Investigation
                        </button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: t.id, status: 'RESOLVED', resolution: 'Hardware restored' })}
                          className="btn text-xs py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {t.status === 'RESOLVED' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: t.id, status: 'CLOSED' })}
                          className="btn btn-secondary text-xs py-1 px-2.5"
                        >
                          Close Ticket
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-foreground/90 whitespace-pre-line">{t.description}</p>

                  {/* Comments Thread */}
                  {t.comments && t.comments.length > 0 && (
                    <div className="p-3 rounded-lg bg-accent/20 border border-border space-y-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block">Resolution Notes & Trail</span>
                      {t.comments.map((c) => (
                        <div key={c.id} className="text-xs text-foreground">
                          <span className="font-bold text-primary">{c.authorName}:</span> {c.comment}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add quick comment */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <input
                      type="text"
                      placeholder="Add investigation update or resolution note..."
                      value={selectedTicketId === t.id ? commentText : ''}
                      onChange={(e) => {
                        setSelectedTicketId(t.id);
                        setCommentText(e.target.value);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
                    />
                    <button
                      onClick={() => {
                        if (!commentText.trim()) return;
                        addCommentMutation.mutate({ id: t.id, input: { comment: commentText } });
                      }}
                      className="btn py-1.5 px-3 text-xs flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" /> Reply
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL: NEW TICKET */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Create Support Incident Ticket</h3>
                <button onClick={() => setIsModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createTicketMutation.mutate({ subject, description, priority, category });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Subject</label>
                  <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. POS Receipt Printer Jammed" className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className="w-full px-3 py-2 rounded-lg border border-border bg-background">
                    <option value="CRITICAL">CRITICAL (Store register down)</option>
                    <option value="HIGH">HIGH (Degraded performance)</option>
                    <option value="MEDIUM">MEDIUM (Normal request)</option>
                    <option value="LOW">LOW (Cosmetic / inquiry)</option>
                  </select>
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background">
                    <option value="POS_TERMINAL">POS Terminal & Peripherals</option>
                    <option value="NETWORK">Network & Connectivity</option>
                    <option value="CUSTOMER_SERVICE">Customer Support</option>
                    <option value="GENERAL">General IT Support</option>
                  </select>
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Description</label>
                  <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed error or symptom description..." className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createTicketMutation.isPending} className="btn">{createTicketMutation.isPending ? 'Filing...' : 'Create Ticket'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
