'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError, BASE_URL } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { TableSkeletonRows } from '@/components/page-skeleton';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import type {
  TelegramChatBindingDto,
  BindTelegramChatInput,
  TelegramBotDto,
  CreateTelegramBotInput,
  UpdateTelegramBotInput,
  TelegramBotPurpose,
  TelegramBotTestResult,
} from '@mystore/contracts';
import {
  Send,
  Bot,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Radio,
  Terminal,
  Play,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Star,
  ShoppingBag,
  Truck,
  Boxes,
  Landmark,
  LifeBuoy,
  Settings,
  Users,
  MessageSquare,
  Edit2,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';

const PURPOSE_CONFIG: Record<
  TelegramBotPurpose,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badgeClass: string }
> = {
  SALES: {
    label: 'Sales & POS',
    icon: ShoppingBag,
    color: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  DELIVERY: {
    label: 'Delivery & Fleet',
    icon: Truck,
    color: 'text-sky-400',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  INVENTORY: {
    label: 'Inventory & WMS',
    icon: Boxes,
    color: 'text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  FINANCE: {
    label: 'Finance & Approvals',
    icon: Landmark,
    color: 'text-purple-400',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  SUPPORT: {
    label: 'Customer Support',
    icon: LifeBuoy,
    color: 'text-indigo-400',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  GENERAL: {
    label: 'General Operations',
    icon: Bot,
    color: 'text-zinc-400',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
};

export default function TelegramPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Modals
  const [isAddBotModalOpen, setIsAddBotModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<TelegramBotDto | null>(null);
  const [isBindModalOpen, setIsBindModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTargetBotId, setBroadcastTargetBotId] = useState<string>('');

  // Add Bot Form
  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [botPurpose, setBotPurpose] = useState<TelegramBotPurpose>('SALES');
  const [botDefaultChatId, setBotDefaultChatId] = useState('');
  const [botDescription, setBotDescription] = useState('');
  const [botIsPrimary, setBotIsPrimary] = useState(false);

  // Edit Bot Form
  const [editName, setEditName] = useState('');
  const [editToken, setEditToken] = useState('');
  const [editPurpose, setEditPurpose] = useState<TelegramBotPurpose>('SALES');
  const [editDefaultChatId, setEditDefaultChatId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);

  // Chat Binding Form
  const [bindChatId, setBindChatId] = useState('');
  const [bindChatTitle, setBindChatTitle] = useState('');
  const [bindRole, setBindRole] = useState('OPERATOR');
  const [bindBotId, setBindBotId] = useState('');
  const [bindType, setBindType] = useState<'USER' | 'GROUP'>('GROUP');

  // Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSelectedBot, setBroadcastSelectedBot] = useState<string>('');

  // Testing & Feedback State
  const [testingBotId, setTestingBotId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TelegramBotTestResult>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Simulator
  const [simChatId, setSimChatId] = useState('');
  const [simCommand, setSimCommand] = useState('/sales');
  const [simResponse, setSimResponse] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // ─── Queries ──────────────────────────────────────────────────────────
  const { data: bots = [], isLoading: isLoadingBots, refetch: refetchBots } = useQuery({
    queryKey: ['telegramBots'],
    queryFn: () => api.listTelegramBots(token!),
    enabled: Boolean(token),
  });

  const { data: bindings = [], isLoading: isLoadingBindings, refetch: refetchBindings } = useQuery({
    queryKey: ['telegramBindings'],
    queryFn: () => api.listTelegramBindings(token!),
    enabled: Boolean(token),
  });

  // ─── Mutations ────────────────────────────────────────────────────────
  const createBotMutation = useMutation({
    mutationFn: (input: CreateTelegramBotInput) => api.createTelegramBot(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegramBots'] });
      setIsAddBotModalOpen(false);
      resetBotForm();
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to create bot'),
  });

  const updateBotMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTelegramBotInput }) =>
      api.updateTelegramBot(token!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegramBots'] });
      setEditingBot(null);
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to update bot'),
  });

  const deleteBotMutation = useMutation({
    mutationFn: (id: string) => api.deleteTelegramBot(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['telegramBots'] }),
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to delete bot'),
  });

  const testBotMutation = useMutation({
    mutationFn: (id: string) => api.testTelegramBot(token!, id),
    onSuccess: (data, id) => {
      setTestResults((prev) => ({ ...prev, [id]: data }));
      queryClient.invalidateQueries({ queryKey: ['telegramBots'] });
    },
    onError: (err: any, id) => {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, status: 'ERROR', botName: 'Failed: ' + (err.message || 'Connection Error') },
      }));
    },
    onSettled: () => setTestingBotId(null),
  });

  const bindMutation = useMutation({
    mutationFn: (input: BindTelegramChatInput) => api.bindTelegramChat(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegramBindings'] });
      setIsBindModalOpen(false);
      setBindChatId('');
      setBindChatTitle('');
      setBindBotId('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to bind chat'),
  });

  const deleteBindingMutation = useMutation({
    mutationFn: (id: string) => api.deleteTelegramBinding(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['telegramBindings'] }),
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to unbind chat'),
  });

  const broadcastMutation = useMutation({
    mutationFn: ({ msg, botId }: { msg: string; botId?: string }) =>
      api.sendTelegramBroadcast(token!, msg, botId || undefined),
    onSuccess: (res) => {
      setIsBroadcastModalOpen(false);
      setBroadcastMessage('');
      alert(`Broadcast dispatched! Sent to ${res.sentCount} destination(s).`);
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to broadcast message'),
  });

  const resetBotForm = () => {
    setBotName('');
    setBotToken('');
    setBotPurpose('SALES');
    setBotDefaultChatId('');
    setBotDescription('');
    setBotIsPrimary(false);
  };

  const handleOpenEdit = (bot: TelegramBotDto) => {
    setEditingBot(bot);
    setEditName(bot.name);
    setEditToken('');
    setEditPurpose(bot.purpose);
    setEditDefaultChatId(bot.defaultChatId || '');
    setEditDescription(bot.description || '');
    setEditIsPrimary(bot.isPrimary);
    setEditIsActive(bot.isActive);
  };

  const handleTestBot = (id: string) => {
    setTestingBotId(id);
    testBotMutation.mutate(id);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetChat = simChatId || bindings[0]?.chatId || '123456789';
    setIsSimulating(true);
    setSimResponse(null);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/telegram/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            chat: { id: targetChat },
            text: simCommand,
          },
        }),
      });
      const data = await res.json();
      setSimResponse(data.response || JSON.stringify(data, null, 2));
    } catch (err: any) {
      setSimResponse(`Error communicating with webhook: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Telegram Multi-Bot Operations
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium border border-primary/20">
                    {bots.length} {bots.length === 1 ? 'Bot' : 'Bots'} Active
                  </span>
                </h1>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Configure multiple specialized Telegram bots (Sales, Delivery, Stock alerts), manage group bindings, and broadcast alerts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refetchBots();
                refetchBindings();
              }}
              className="p-2.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground transition-colors"
              title="Refresh All"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setBroadcastSelectedBot('');
                setIsBroadcastModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Dispatch Broadcast
            </button>
            <button
              onClick={() => setIsBindModalOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-border/80 bg-muted/40 hover:bg-muted text-foreground transition-colors flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-primary" /> Bind Chat ID
            </button>
            <button
              onClick={() => {
                resetBotForm();
                setIsAddBotModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Telegram Bot
            </button>
          </div>
        </div>

        {/* SECTION 1: CONFIGURED TELEGRAM BOTS (FLEET DECK) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Registered Telegram Bots ({bots.length})
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Create individual bots with @BotFather to isolate alert streams by department.
            </span>
          </div>

          {isLoadingBots ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
              ))}
            </div>
          ) : bots.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No Telegram Bots Connected"
              description="Connect your first Telegram bot using the token provided by @BotFather. You can register multiple bots for sales, delivery, inventory, or management."
              actionLabel="Add First Telegram Bot"
              onAction={() => setIsAddBotModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bots.map((bot) => {
                const purposeInfo = PURPOSE_CONFIG[bot.purpose] || PURPOSE_CONFIG.GENERAL;
                const PurposeIcon = purposeInfo.icon;
                const isTesting = testingBotId === bot.id;
                const testResult = testResults[bot.id];

                return (
                  <div
                    key={bot.id}
                    className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 bg-card/80 backdrop-blur-sm ${
                      bot.isPrimary
                        ? 'border-primary/40 shadow-sm shadow-primary/5 ring-1 ring-primary/20'
                        : 'border-border/80 hover:border-border'
                    } ${!bot.isActive ? 'opacity-65' : ''}`}
                  >
                    {/* Card Top */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl border ${purposeInfo.badgeClass}`}>
                            <PurposeIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-foreground leading-snug">{bot.name}</h3>
                              {bot.isPrimary && (
                                <span title="Primary Default Bot">
                                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                              {bot.botUsername ? `@${bot.botUsername}` : 'Username unverified'}
                            </span>
                          </div>
                        </div>

                        {/* Status Chip */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                              bot.status === 'CONNECTED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
                                bot.status === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                              }`}
                            />
                            {bot.status}
                          </span>
                        </div>
                      </div>

                      {/* Bot Purpose & Details */}
                      <div className="space-y-2 py-2 border-y border-border/40 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-[11px]">Department:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${purposeInfo.badgeClass}`}>
                            {purposeInfo.label}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-[11px]">Token Preview:</span>
                          <span className="font-mono text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/40">
                            {bot.tokenPreview}
                          </span>
                        </div>

                        {bot.defaultChatId && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-[11px]">Default Chat ID:</span>
                            <span className="font-mono text-[11px] text-primary font-semibold">
                              {bot.defaultChatId}
                            </span>
                          </div>
                        )}

                        {bot.description && (
                          <p className="text-[11px] text-muted-foreground/80 italic line-clamp-1">
                            "{bot.description}"
                          </p>
                        )}
                      </div>

                      {/* Test feedback preview if run */}
                      {testResult && (
                        <div
                          className={`mt-2 p-2 rounded-xl text-[11px] font-mono border ${
                            testResult.success
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                          }`}
                        >
                          {testResult.success ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Verified: @{testResult.botUsername || bot.botUsername}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>{testResult.botName || 'Verification Failed'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Actions Toolbar */}
                    <div className="flex items-center justify-between gap-1 pt-4 mt-3 border-t border-border/40">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTestBot(bot.id)}
                          disabled={isTesting}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-border/80 bg-muted/40 hover:bg-muted text-foreground transition-colors flex items-center gap-1"
                          title="Test Connection with Telegram API"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin text-primary' : ''}`} />
                          {isTesting ? 'Testing...' : 'Ping Test'}
                        </button>

                        <button
                          onClick={() => {
                            setBroadcastSelectedBot(bot.id);
                            setIsBroadcastModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-1"
                        >
                          <Radio className="w-3 h-3" /> Alert
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(bot)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit Bot"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete Telegram bot "${bot.name}"?`)) {
                              deleteBotMutation.mutate(bot.id);
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete Bot"
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
        </div>

        {/* SECTION 2: COMMAND REFERENCE BANNER */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="card p-4 rounded-2xl border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
            <span className="font-mono font-bold text-sky-400 text-xs">/sales</span>
            <p className="text-xs text-foreground font-semibold mt-1">Live Sales Velocity</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Returns today’s total revenue, ticket count, and AOV.</p>
          </div>
          <div className="card p-4 rounded-2xl border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
            <span className="font-mono font-bold text-amber-400 text-xs">/stock</span>
            <p className="text-xs text-foreground font-semibold mt-1">Inventory Depletion</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lists depleted SKUs and items requiring purchase orders.</p>
          </div>
          <div className="card p-4 rounded-2xl border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
            <span className="font-mono font-bold text-emerald-400 text-xs">/orders</span>
            <p className="text-xs text-foreground font-semibold mt-1">Orders Tracker</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Shows completed volume vs. workflows awaiting review.</p>
          </div>
          <div className="card p-4 rounded-2xl border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
            <span className="font-mono font-bold text-purple-400 text-xs">/status</span>
            <p className="text-xs text-foreground font-semibold mt-1">System Health</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Returns active bots count, DB sync, and fleet state.</p>
          </div>
        </div>

        {/* SECTION 3: BOUND CHATS TABLE */}
        <div className="card rounded-2xl border border-border/80 shadow-sm overflow-hidden bg-card/80 backdrop-blur-sm">
          <div className="p-4 border-b border-border/80 bg-muted/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                Authorized Telegram Chat Destinations ({bindings.length})
              </span>
            </div>
            <button
              onClick={() => setIsBindModalOpen(true)}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Bind New Destination
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground/80 border-b border-border/80">
                  <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider">Group / Channel Title</th>
                  <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider">Telegram Chat ID</th>
                  <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider">Assigned Bot</th>
                  <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider">Type & Role</th>
                  <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider">Status</th>
                  <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoadingBindings ? (
                  <TableSkeletonRows rows={4} cols={6} />
                ) : bindings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                      No Telegram chat destinations registered. Click "Bind New Destination" to link a manager or staff group.
                    </td>
                  </tr>
                ) : (
                  bindings.map((b) => {
                    const assignedBot = bots.find((bot) => bot.id === b.botId);
                    return (
                      <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3.5 font-bold text-foreground">
                          {b.chatTitle || (b.bindingType === 'USER' ? 'Direct User' : 'Group Destination')}
                        </td>
                        <td className="p-3.5 font-mono text-primary font-semibold flex items-center gap-1.5">
                          {b.chatId}
                          <button
                            onClick={() => copyToClipboard(b.chatId, b.id)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Copy Chat ID"
                          >
                            {copiedId === b.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                        <td className="p-3.5 text-xs">
                          {assignedBot ? (
                            <span className="font-medium text-foreground flex items-center gap-1.5">
                              <Bot className="w-3.5 h-3.5 text-primary" /> {assignedBot.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-mono text-[11px]">Primary Default Bot</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted border border-border/80 text-foreground">
                            {b.bindingType || 'GROUP'} · {b.role}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              b.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {b.isActive ? 'ACTIVE' : 'MUTED'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Unbind chat ${b.chatId}?`)) {
                                deleteBindingMutation.mutate(b.id);
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Unbind"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: INTERACTIVE BOT COMMAND SIMULATOR */}
        <div className="card p-6 rounded-2xl border border-border/80 shadow-sm flex flex-col gap-4 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Interactive Bot Webhook Simulator</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Test slash commands against your tenant database as if triggered inside a Telegram group by a cashier or manager.
          </p>

          <form onSubmit={handleSimulate} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Target Chat ID (optional)"
              value={simChatId}
              onChange={(e) => setSimChatId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border/80 bg-background text-xs font-mono w-full sm:w-56"
            />
            <select
              value={simCommand}
              onChange={(e) => setSimCommand(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border/80 bg-background text-xs font-mono"
            >
              <option value="/sales">/sales (Live Revenue & Volume)</option>
              <option value="/stock">/stock (Depleted SKUs)</option>
              <option value="/orders">/orders (Orders Tracker)</option>
              <option value="/status">/status (Fleet & Health)</option>
              <option value="/help">/help (Command Guide)</option>
            </select>
            <button
              type="submit"
              disabled={isSimulating}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5" /> {isSimulating ? 'Executing...' : 'Run Simulation'}
            </button>
          </form>

          {simResponse && (
            <div className="p-4 rounded-xl bg-black/60 border border-border/80 font-mono text-xs whitespace-pre-wrap text-emerald-400">
              {simResponse}
            </div>
          )}
        </div>

        {/* ─── MODAL: ADD TELEGRAM BOT ────────────────────────────────────── */}
        {isAddBotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="card w-full max-w-lg p-6 rounded-2xl border border-border shadow-2xl bg-card">
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Add New Telegram Bot</h3>
                </div>
                <button onClick={() => setIsAddBotModalOpen(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createBotMutation.mutate({
                    name: botName,
                    botToken,
                    purpose: botPurpose,
                    defaultChatId: botDefaultChatId || undefined,
                    description: botDescription || undefined,
                    isPrimary: botIsPrimary,
                    isActive: true,
                  });
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Bot Friendly Name *
                  </label>
                  <input
                    required
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="e.g. Sales Alerts Bot or Fleet Dispatcher"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  />
                </div>

                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Operational Purpose / Department *
                  </label>
                  <select
                    value={botPurpose}
                    onChange={(e) => setBotPurpose(e.target.value as TelegramBotPurpose)}
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  >
                    <option value="SALES">Sales & POS (Checkout & Cashier notifications)</option>
                    <option value="DELIVERY">Delivery & Fleet (Driver dispatch & live tracking)</option>
                    <option value="INVENTORY">Inventory & WMS (Low stock & transfer alerts)</option>
                    <option value="FINANCE">Finance & Approvals (Daily executive digests)</option>
                    <option value="SUPPORT">Customer Support (Helpdesk ticket triage)</option>
                    <option value="GENERAL">General Operations (All alerts)</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Telegram Bot Token (from @BotFather) *
                  </label>
                  <input
                    required
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background font-mono text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Tokens are securely encrypted in the PostgreSQL database.
                  </span>
                </div>

                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Default Group / Channel Chat ID (Optional)
                  </label>
                  <input
                    value={botDefaultChatId}
                    onChange={(e) => setBotDefaultChatId(e.target.value)}
                    placeholder="e.g. -100123456789"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background font-mono"
                  />
                </div>

                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Description / Notes
                  </label>
                  <input
                    value={botDescription}
                    onChange={(e) => setBotDescription(e.target.value)}
                    placeholder="e.g. Dedicated channel for Phnom Penh retail store"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={botIsPrimary}
                    onChange={(e) => setBotIsPrimary(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="isPrimary" className="text-xs text-foreground font-medium cursor-pointer">
                    Set as Primary Default Bot for this organization
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setIsAddBotModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createBotMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm transition-all"
                  >
                    {createBotMutation.isPending ? 'Verifying & Saving...' : 'Register Bot'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: EDIT TELEGRAM BOT ─────────────────────────────────────── */}
        {editingBot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="card w-full max-w-lg p-6 rounded-2xl border border-border shadow-2xl bg-card">
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Edit Telegram Bot: {editingBot.name}</h3>
                </div>
                <button onClick={() => setEditingBot(null)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateBotMutation.mutate({
                    id: editingBot.id,
                    input: {
                      name: editName,
                      botToken: editToken || undefined,
                      purpose: editPurpose,
                      defaultChatId: editDefaultChatId || undefined,
                      description: editDescription || undefined,
                      isPrimary: editIsPrimary,
                      isActive: editIsActive,
                    },
                  });
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Bot Friendly Name
                  </label>
                  <input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  />
                </div>

                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Operational Purpose / Department
                  </label>
                  <select
                    value={editPurpose}
                    onChange={(e) => setEditPurpose(e.target.value as TelegramBotPurpose)}
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  >
                    <option value="SALES">Sales & POS</option>
                    <option value="DELIVERY">Delivery & Fleet</option>
                    <option value="INVENTORY">Inventory & WMS</option>
                    <option value="FINANCE">Finance & Approvals</option>
                    <option value="SUPPORT">Customer Support</option>
                    <option value="GENERAL">General Operations</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Update Bot Token (Leave blank to keep current token)
                  </label>
                  <input
                    type="password"
                    value={editToken}
                    onChange={(e) => setEditToken(e.target.value)}
                    placeholder="Enter new token only if rotating credentials..."
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Default Group / Channel Chat ID
                  </label>
                  <input
                    value={editDefaultChatId}
                    onChange={(e) => setEditDefaultChatId(e.target.value)}
                    placeholder="e.g. -100123456789"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="editIsPrimary"
                      checked={editIsPrimary}
                      onChange={(e) => setEditIsPrimary(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="editIsPrimary" className="text-xs text-foreground font-medium cursor-pointer">
                      Primary Bot
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="editIsActive"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="editIsActive" className="text-xs text-foreground font-medium cursor-pointer">
                      Active (Receiving alerts)
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setEditingBot(null)}
                    className="px-3.5 py-2 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateBotMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm transition-all"
                  >
                    {updateBotMutation.isPending ? 'Saving...' : 'Update Bot'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: BIND CHAT DESTINATION ───────────────────────────────── */}
        {isBindModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="card w-full max-w-sm p-6 rounded-2xl border border-border shadow-2xl bg-card">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-border/60">
                <h3 className="text-base font-bold text-foreground">Bind Telegram Destination</h3>
                <button onClick={() => setIsBindModalOpen(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  bindMutation.mutate({
                    chatId: bindChatId,
                    chatTitle: bindChatTitle || undefined,
                    role: bindRole,
                    botId: bindBotId || undefined,
                    bindingType: bindType,
                  });
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Telegram Chat ID *
                  </label>
                  <input
                    required
                    value={bindChatId}
                    onChange={(e) => setBindChatId(e.target.value)}
                    placeholder="e.g. 987654321 or -100123456"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Destination Title
                  </label>
                  <input
                    value={bindChatTitle}
                    onChange={(e) => setBindChatTitle(e.target.value)}
                    placeholder="e.g. Phnom Penh Cashiers Group"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Assign Specific Bot (Optional)
                  </label>
                  <select
                    value={bindBotId}
                    onChange={(e) => setBindBotId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  >
                    <option value="">Default / Primary Bot</option>
                    {bots.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.purpose})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Assigned Role
                  </label>
                  <select
                    value={bindRole}
                    onChange={(e) => setBindRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  >
                    <option value="OPERATOR">OPERATOR (Sales, stock, orders)</option>
                    <option value="BRANCH_MANAGER">BRANCH_MANAGER (All commands + approvals)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Full platform access)</option>
                    <option value="DISPATCHER">DISPATCHER (Fleet & Delivery)</option>
                    <option value="CASHIER">CASHIER (Checkout transactions)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBindModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bindMutation.isPending}
                    className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold"
                  >
                    {bindMutation.isPending ? 'Binding...' : 'Authorize'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: TARGETED BROADCAST ──────────────────────────────────── */}
        {isBroadcastModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 rounded-2xl border border-border shadow-2xl bg-card">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-rose-400" />
                  <h3 className="text-base font-bold text-foreground">Dispatch Telegram Broadcast</h3>
                </div>
                <button onClick={() => setIsBroadcastModalOpen(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  broadcastMutation.mutate({
                    msg: broadcastMessage,
                    botId: broadcastSelectedBot || undefined,
                  });
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Dispatching Bot
                  </label>
                  <select
                    value={broadcastSelectedBot}
                    onChange={(e) => setBroadcastSelectedBot(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  >
                    <option value="">All Active Bots / Primary Bot</option>
                    {bots.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.purpose})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
                    Alert Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Type broadcast message (markdown supported)..."
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background"
                  />
                </div>

                {/* Quick Templates */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1.5">
                    Quick Templates:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setBroadcastMessage('🚨 URGENT: Low inventory detected on high-velocity items. Please review replenishment.')
                      }
                      className="px-2 py-1 rounded text-[10px] bg-muted/60 hover:bg-muted border border-border/60"
                    >
                      📦 Low Stock
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBroadcastMessage('🎉 FLASH SALE: Weekend promotion is now active across all retail branches!')
                      }
                      className="px-2 py-1 rounded text-[10px] bg-muted/60 hover:bg-muted border border-border/60"
                    >
                      🛍️ Flash Sale
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBroadcastMessage('⚡ SYSTEM: Daily fiscal closing completed. All batch receipts reconciled.')
                      }
                      className="px-2 py-1 rounded text-[10px] bg-muted/60 hover:bg-muted border border-border/60"
                    >
                      ✅ Fiscal Reconciled
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setIsBroadcastModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={broadcastMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold shadow-sm transition-all"
                  >
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
