'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { ListSkeleton } from '@/components/page-skeleton';
import type {
  NotificationRecordDto,
  NotificationConfigDto,
  NotificationChannel,
  NotificationType,
  UpdateNotificationConfigInput,
} from '@mystore/contracts';
import {
  Bell,
  Send,
  CheckCheck,
  Radio,
  Settings2,
  AlertTriangle,
  ShoppingBag,
  ArrowLeftRight,
  CheckCircle2,
  CreditCard,
  MessageSquare,
  Mail,
  Smartphone,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

export default function NotificationsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Filters & State
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD' | 'TELEGRAM' | 'EMAIL' | 'CONFIG'>('ALL');
  const [testSentMsg, setTestSentMsg] = useState<string | null>(null);

  // Channel Config Form
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['notificationStats'],
    queryFn: () => api.getNotificationStats(token!),
    enabled: Boolean(token),
  });

  const { data: config } = useQuery({
    queryKey: ['notificationConfig'],
    queryFn: async () => {
      const res = await api.getNotificationConfig(token!);
      if (!configLoaded) {
        setTelegramEnabled(res.telegramEnabled);
        setTelegramBotToken(res.telegramBotToken || '');
        setTelegramChatId(res.telegramChatId || '');
        setEmailEnabled(res.emailEnabled);
        setEmailRecipient(res.emailRecipient || '');
        setInAppEnabled(res.inAppEnabled);
        setConfigLoaded(true);
      }
      return res;
    },
    enabled: Boolean(token),
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notificationsList', activeTab],
    queryFn: () => {
      const query: any = {};
      if (activeTab === 'UNREAD') query.isRead = false;
      if (activeTab === 'TELEGRAM') query.channel = 'TELEGRAM';
      if (activeTab === 'EMAIL') query.channel = 'EMAIL';
      return api.listNotifications(token!, query);
    },
    enabled: Boolean(token) && activeTab !== 'CONFIG',
  });

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: (input: UpdateNotificationConfigInput) => api.updateNotificationConfig(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationConfig'] });
      queryClient.invalidateQueries({ queryKey: ['notificationStats'] });
      alert('Notification channels configuration saved successfully');
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to update config');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationsList'] });
      queryClient.invalidateQueries({ queryKey: ['notificationStats'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationsList'] });
      queryClient.invalidateQueries({ queryKey: ['notificationStats'] });
    },
  });

  const testAlertMutation = useMutation({
    mutationFn: () => api.sendTestNotification(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationsList'] });
      queryClient.invalidateQueries({ queryKey: ['notificationStats'] });
      setTestSentMsg('Test alert dispatched to active channels!');
      setTimeout(() => setTestSentMsg(null), 4000);
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Test alert failed');
    },
  });

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'LOW_STOCK_ALERT':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'ORDER_CREATED':
        return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
      case 'TRANSFER_DISPATCHED':
        return <ArrowLeftRight className="w-4 h-4 text-purple-400" />;
      case 'PO_APPROVED':
        return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case 'PAYMENT_RECEIVED':
        return <CreditCard className="w-4 h-4 text-teal-400" />;
      default:
        return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  const getChannelBadge = (channel: NotificationChannel) => {
    switch (channel) {
      case 'TELEGRAM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
            <Radio className="w-3 h-3" /> TELEGRAM
          </span>
        );
      case 'EMAIL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <Mail className="w-3 h-3" /> EMAIL
          </span>
        );
      case 'SMS':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> SMS
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
            <Bell className="w-3 h-3" /> IN-APP
          </span>
        );
    }
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-primary" />
              Notifications & Alerts Platform
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Multi-channel transactional delivery across Telegram, In-App alerts & operational event broadcasting
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Read
            </button>
            <button
              type="button"
              disabled={testAlertMutation.isPending}
              onClick={() => testAlertMutation.mutate()}
              className="btn flex items-center gap-2 text-xs shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              {testAlertMutation.isPending ? 'Sending...' : 'Send Test Alert'}
            </button>
          </div>
        </div>

        {testSentMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {testSentMsg}
          </div>
        )}

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Dispatched</p>
                <p className="text-xl font-bold text-foreground font-mono">{stats?.totalDispatched ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Unread In-App</p>
                <p className="text-xl font-bold text-rose-400 font-mono">{stats?.unreadInApp ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Channels</p>
                <p className="text-sm font-bold text-sky-400 font-mono">
                  {stats?.activeChannels?.length ? stats.activeChannels.join(', ') : 'IN_APP'}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Delivery Health</p>
                <p className="text-xl font-bold text-emerald-400 font-mono">100%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-border pb-2 text-xs">
          {[
            { id: 'ALL', label: 'All Alerts', icon: Bell },
            { id: 'UNREAD', label: 'Unread In-App', icon: MessageSquare },
            { id: 'TELEGRAM', label: 'Telegram Broadcasts', icon: Radio },
            { id: 'EMAIL', label: 'Email Alerts', icon: Mail },
            { id: 'CONFIG', label: 'Channel Configuration', icon: Settings2 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Notification Stream (All / Unread / Telegram / Email) */}
        {activeTab !== 'CONFIG' && (
          <div className="space-y-3">
            {isLoading ? (
              <ListSkeleton count={5} />
            ) : notifications.length === 0 ? (
              <div className="card p-8 border-border bg-card text-center text-muted-foreground text-xs">
                No notifications found in this view.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`card p-4 border-border transition-all flex items-start justify-between gap-4 ${
                    !notif.isRead && notif.channel === 'IN_APP'
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-card'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted/30 border border-border mt-0.5">
                      {getTypeIcon(notif.type)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-xs text-foreground">{notif.title}</h4>
                        {getChannelBadge(notif.channel)}
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                            notif.status === 'SENT'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : notif.status === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {notif.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {!notif.isRead && notif.channel === 'IN_APP' && (
                    <button
                      type="button"
                      onClick={() => markReadMutation.mutate(notif.id)}
                      className="px-2.5 py-1 rounded text-[11px] font-semibold bg-primary/20 text-primary hover:bg-primary/30 shrink-0 transition-colors"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Channel Configuration */}
        {activeTab === 'CONFIG' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Telegram Setup Card */}
            <div className="card p-5 border-border bg-card space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Radio className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">Telegram Bot Broadcasts</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Direct real-time alerts to team channel or private chat
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div>
                    <span className="font-semibold text-foreground block">Enable Telegram Delivery</span>
                    <span className="text-[11px] text-muted-foreground">
                      Forward sales receipts, low stock & PO events
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={telegramEnabled}
                    onChange={(e) => setTelegramEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-border cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground font-semibold block mb-1">
                    Telegram Bot Token (from @BotFather)
                  </label>
                  <input
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="input w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground font-semibold block mb-1">
                    Target Chat ID / Channel Username
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="e.g. -1001234567890 or @MyStoreAlerts"
                    className="input w-full font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Email & In-App Setup Card */}
            <div className="card p-5 border-border bg-card space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Mail className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">Email & In-App Settings</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Configure operational email distribution & dashboard center
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div>
                    <span className="font-semibold text-foreground block">In-App Notification Center</span>
                    <span className="text-[11px] text-muted-foreground">
                      Record persistent notification logs in database
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={inAppEnabled}
                    onChange={(e) => setInAppEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-border cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div>
                    <span className="font-semibold text-foreground block">Enable Operational Email</span>
                    <span className="text-[11px] text-muted-foreground">
                      Dispatch executive summaries and alerts
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-border cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground font-semibold block mb-1">
                    Alert Email Recipient
                  </label>
                  <input
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="e.g. alerts@camtechstore.com"
                    className="input w-full text-xs"
                  />
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    disabled={updateConfigMutation.isPending}
                    onClick={() =>
                      updateConfigMutation.mutate({
                        telegramEnabled,
                        telegramBotToken: telegramBotToken || undefined,
                        telegramChatId: telegramChatId || undefined,
                        emailEnabled,
                        emailRecipient: emailRecipient || undefined,
                        inAppEnabled,
                      })
                    }
                    className="btn w-full py-2 text-xs font-bold"
                  >
                    {updateConfigMutation.isPending ? 'Saving...' : 'Save Channel Configuration'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
