'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type { TelegramChatBindingDto, BindTelegramChatInput } from '@mystore/contracts';
import {
  Send,
  Bot,
  Plus,
  RefreshCw,
  Trash2,
  X,
  MessageSquare,
  ShieldCheck,
  Radio,
  Terminal,
  Play,
} from 'lucide-react';

export default function TelegramPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [isBindModalOpen, setIsBindModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Forms
  const [chatId, setChatId] = useState('');
  const [chatTitle, setChatTitle] = useState('');
  const [role, setRole] = useState('OPERATOR');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // Simulator
  const [simChatId, setSimChatId] = useState('');
  const [simCommand, setSimCommand] = useState('/sales');
  const [simResponse, setSimResponse] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const { data: bindings = [], refetch, isLoading } = useQuery({
    queryKey: ['telegramBindings'],
    queryFn: () => api.listTelegramBindings(token!),
    enabled: Boolean(token),
  });

  const bindMutation = useMutation({
    mutationFn: (input: BindTelegramChatInput) => api.bindTelegramChat(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegramBindings'] });
      setIsBindModalOpen(false);
      setChatId('');
      setChatTitle('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to bind chat'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTelegramBinding(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['telegramBindings'] }),
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to unbind chat'),
  });

  const broadcastMutation = useMutation({
    mutationFn: (msg: string) => api.sendTelegramBroadcast(token!, msg),
    onSuccess: (res) => {
      setIsBroadcastModalOpen(false);
      setBroadcastMessage('');
      alert(`Broadcast sent successfully to ${res.sentCount} active Telegram destination(s).`);
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to broadcast message'),
  });

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simChatId) {
      if (bindings.length > 0) {
        setSimChatId(bindings[0].chatId);
      } else {
        alert('Please bind a chat ID or enter one in the simulator.');
        return;
      }
    }

    setIsSimulating(true);
    setSimResponse(null);
    try {
      const res = await fetch('http://localhost:4000/api/v1/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            chat: { id: simChatId || bindings[0]?.chatId },
            text: simCommand,
          },
        }),
      });
      const data = await res.json();
      setSimResponse(data.response || JSON.stringify(data));
    } catch (err: any) {
      setSimResponse(`Error communicating with webhook: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <Send className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Telegram Platform & Operations Bot
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Operational chat bindings, live slash commands, interactive webhooks, and incident broadcast dispatch.
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
              onClick={() => setIsBroadcastModalOpen(true)}
              className="btn btn-secondary flex items-center gap-1.5 text-xs py-2"
            >
              <Radio className="w-3.5 h-3.5 text-rose-400" /> Broadcast Alert
            </button>
            <button
              onClick={() => setIsBindModalOpen(true)}
              className="btn flex items-center gap-1.5 text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" /> Bind Chat ID
            </button>
          </div>
        </div>

        {/* Command Reference Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="card p-4 border-border shadow-sm">
            <span className="font-mono font-bold text-sky-400 text-xs">/sales</span>
            <p className="text-xs text-foreground font-semibold mt-1">Live Sales Velocity</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Returns today’s total revenue, completed tickets, and AOV.</p>
          </div>
          <div className="card p-4 border-border shadow-sm">
            <span className="font-mono font-bold text-amber-400 text-xs">/stock</span>
            <p className="text-xs text-foreground font-semibold mt-1">Inventory Alert</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lists depleted SKUs and items requiring purchase orders.</p>
          </div>
          <div className="card p-4 border-border shadow-sm">
            <span className="font-mono font-bold text-emerald-400 text-xs">/orders</span>
            <p className="text-xs text-foreground font-semibold mt-1">Orders Tracker</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Shows completed volume vs. workflows awaiting review.</p>
          </div>
          <div className="card p-4 border-border shadow-sm">
            <span className="font-mono font-bold text-purple-400 text-xs">/approve &lt;id&gt;</span>
            <p className="text-xs text-foreground font-semibold mt-1">Executive Sign-Off</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Reviews and advances a pending approval step.</p>
          </div>
        </div>

        {/* Bound Chats Table */}
        <div className="card border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-accent/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                Authorized Telegram Chat Bindings ({bindings.length})
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-accent/40 text-muted-foreground border-b border-border">
                  <th className="p-3 font-semibold uppercase tracking-wider">Chat Title / Group</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Telegram Chat ID</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Assigned Role</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Status</th>
                  <th className="p-3 font-semibold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bindings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No Telegram chats currently bound. Click "Bind Chat ID" to register a manager or group chat.
                    </td>
                  </tr>
                ) : (
                  bindings.map((b) => (
                    <tr key={b.id} className="hover:bg-accent/20 transition-colors">
                      <td className="p-3 font-bold text-foreground">{b.chatTitle || 'Direct Private Chat'}</td>
                      <td className="p-3 font-mono text-primary font-semibold">{b.chatId}</td>
                      <td className="p-3 font-mono text-muted-foreground">{b.role}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {b.isActive ? 'ACTIVE' : 'MUTED'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Unbind chat ${b.chatId}?`)) {
                              deleteMutation.mutate(b.id);
                            }
                          }}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Unbind"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Bot Webhook Simulator */}
        <div className="card p-6 border-border shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Interactive Bot Command Simulator</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Test slash commands against your tenant database as if received through the Telegram Bot webhook gateway.
          </p>

          <form onSubmit={handleSimulate} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Chat ID (e.g. 12345678)"
              value={simChatId}
              onChange={(e) => setSimChatId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-xs font-mono w-full sm:w-48"
            />
            <select
              value={simCommand}
              onChange={(e) => setSimCommand(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-xs font-mono"
            >
              <option value="/sales">/sales</option>
              <option value="/stock">/stock</option>
              <option value="/orders">/orders</option>
              <option value="/help">/help</option>
              <option value="/approve test_wf_01">/approve test_wf_01</option>
            </select>
            <button
              type="submit"
              disabled={isSimulating}
              className="btn py-2 px-4 text-xs flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5" /> {isSimulating ? 'Executing...' : 'Run Command'}
            </button>
          </form>

          {simResponse && (
            <div className="p-4 rounded-lg bg-black/40 border border-border/80 font-mono text-xs whitespace-pre-wrap text-emerald-400">
              {simResponse}
            </div>
          )}
        </div>

        {/* MODAL: BIND CHAT */}
        {isBindModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-sm p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Bind Telegram Chat</h3>
                <button onClick={() => setIsBindModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                bindMutation.mutate({ chatId, chatTitle: chatTitle || undefined, role });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Telegram Chat ID</label>
                  <input required value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="e.g. 987654321 or -100123456" className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Chat / Group Title</label>
                  <input value={chatTitle} onChange={(e) => setChatTitle(e.target.value)} placeholder="e.g. Phnom Penh Branch Managers" className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Assigned Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background">
                    <option value="OPERATOR">OPERATOR (Sales, stock, orders)</option>
                    <option value="BRANCH_MANAGER">BRANCH_MANAGER (All commands + approvals)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Full platform access)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsBindModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={bindMutation.isPending} className="btn">
                    {bindMutation.isPending ? 'Binding...' : 'Authorize Binding'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: BROADCAST */}
        {isBroadcastModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Dispatch Telegram Broadcast</h3>
                <button onClick={() => setIsBroadcastModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                broadcastMutation.mutate(broadcastMessage);
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Broadcast Message</label>
                  <textarea rows={4} required value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} placeholder="Type emergency alert or operational broadcast..." className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This notification will be dispatched instantly to all {bindings.length} active Telegram chats bound to this enterprise organization.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsBroadcastModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={broadcastMutation.isPending} className="btn">
                    {broadcastMutation.isPending ? 'Broadcasting...' : 'Send Broadcast'}
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
