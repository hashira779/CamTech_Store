import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Send,
  Plus,
  Trash2,
  RotateCw,
  ShieldAlert,
  Radio,
  Sliders,
  Check,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export function AlertCenterView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'RULES' | 'CHANNELS'>('ALERTS');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);

  // New Rule State
  const [ruleName, setRuleName] = useState('');
  const [ruleCategory, setRuleCategory] = useState('INFRA');
  const [ruleSeverity, setRuleSeverity] = useState('HIGH');
  const [ruleMetric, setRuleMetric] = useState('cpu_pct');
  const [ruleThreshold, setRuleThreshold] = useState('90');

  // New Channel State
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('TELEGRAM');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  // Fetch Alerts
  const { data: alerts = [], isLoading: loadingAlerts, refetch: refetchAlerts } = useQuery<any[]>({
    queryKey: ['infra-alerts'],
    queryFn: async () => {
      return (await apiClient.get<any[]>('/infra/alerts')) || [];
    },
    refetchInterval: 10000,
  });

  // Fetch Rules
  const { data: rules = [], refetch: refetchRules } = useQuery<any[]>({
    queryKey: ['infra-alert-rules'],
    queryFn: async () => {
      return (await apiClient.get<any[]>('/infra/alert-rules')) || [];
    },
  });

  // Fetch Channels
  const { data: channels = [], refetch: refetchChannels } = useQuery<any[]>({
    queryKey: ['infra-notification-channels'],
    queryFn: async () => {
      return (await apiClient.get<any[]>('/infra/notification-channels')) || [];
    },
  });

  // Acknowledge Alert Mutation
  const ackMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return await apiClient.post<any>(`/infra/alerts/${alertId}/acknowledge`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-alerts'] });
    },
  });

  // Resolve Alert Mutation
  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return await apiClient.post<any>(`/infra/alerts/${alertId}/resolve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-alerts'] });
    },
  });

  // Create Rule Mutation
  const createRuleMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiClient.post<any>('/infra/alert-rules', payload);
    },
    onSuccess: () => {
      setShowRuleModal(false);
      setRuleName('');
      queryClient.invalidateQueries({ queryKey: ['infra-alert-rules'] });
    },
  });

  // Delete Rule Mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return await apiClient.delete<any>(`/infra/alert-rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-alert-rules'] });
    },
  });

  // Create Channel Mutation
  const createChannelMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiClient.post<any>('/infra/notification-channels', payload);
    },
    onSuccess: () => {
      setShowChannelModal(false);
      setChannelName('');
      setBotToken('');
      setChatId('');
      setWebhookUrl('');
      queryClient.invalidateQueries({ queryKey: ['infra-notification-channels'] });
    },
  });

  // Delete Channel Mutation
  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return await apiClient.delete<any>(`/infra/notification-channels/${channelId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-notification-channels'] });
    },
  });

  // Test Channel Mutation
  const testChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return await apiClient.post<any>(`/infra/notification-channels/${channelId}/test`, {});
    },
    onSuccess: () => {
      alert('Test alert notification transmitted successfully.');
    },
  });

  const firingAlerts = alerts.filter((a) => a.status === 'FIRING');

  return (
    <div className="space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-rose-400" />
            Alert Center & Multichannel Notifications
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Automated threshold evaluation, deduplication, and instant delivery via Telegram, Slack, and Webhooks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchAlerts();
              refetchRules();
              refetchChannels();
            }}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition"
            title="Refresh Alert Center"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {activeTab === 'RULES' && (
            <button
              onClick={() => setShowRuleModal(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#F38020] hover:bg-[#E07116] text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-[#F38020]/20"
            >
              <Plus className="w-3.5 h-3.5" />
              New Alert Rule
            </button>
          )}

          {activeTab === 'CHANNELS' && (
            <button
              onClick={() => setShowChannelModal(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#F38020] hover:bg-[#E07116] text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-[#F38020]/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Notification Channel
            </button>
          )}
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('ALERTS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'ALERTS'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" /> Active &amp; Historical Alerts
          {firingAlerts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
              {firingAlerts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('RULES')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'RULES'
              ? 'bg-[#F38020]/15 text-[#F38020] border border-[#F38020]/30 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Threshold Rules ({rules.length})
        </button>

        <button
          onClick={() => setActiveTab('CHANNELS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'CHANNELS'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5" /> Notification Channels ({channels.length})
        </button>
      </div>

      {/* ── Tab Content: Active Alerts ── */}
      {activeTab === 'ALERTS' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              <p className="text-zinc-300 text-sm font-semibold">All Systems Normal — No Active Alerts</p>
              <p className="text-zinc-500 text-xs mt-1">
                Your infrastructure and services are operating within normal baseline parameters.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => {
                const isFiring = a.status === 'FIRING';
                return (
                  <div
                    key={a.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition ${
                      isFiring
                        ? 'bg-rose-950/20 border-rose-900/60'
                        : 'bg-zinc-900/60 border-zinc-800/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.severity === 'CRITICAL'
                              ? 'bg-rose-600 text-white'
                              : a.severity === 'HIGH'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {a.severity}
                        </span>
                        <h4 className="font-bold text-white text-sm">{a.title}</h4>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            isFiring ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>
                      {a.description && (
                        <p className="text-xs text-zinc-400 mt-1 font-mono">{a.description}</p>
                      )}
                      <div className="text-[10px] text-zinc-500 font-mono mt-1">
                        Fired at: {a.firedAt ? new Date(a.firedAt).toLocaleString() : 'N/A'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isFiring && (
                        <button
                          onClick={() => ackMutation.mutate(a.id)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      {a.status !== 'RESOLVED' && (
                        <button
                          onClick={() => resolveMutation.mutate(a.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Rules ── */}
      {activeTab === 'RULES' && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-mono">
              <tr>
                <th className="py-3 px-4">Rule Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Trigger Condition</th>
                <th className="py-3 px-4">Cooldown</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No threshold alert rules defined yet.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/30 transition">
                    <td className="py-3 px-4 font-bold text-white">{r.name}</td>
                    <td className="py-3 px-4 text-zinc-400">{r.category}</td>
                    <td className="py-3 px-4">
                      <span className="text-rose-400 font-bold">{r.severity}</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      {JSON.stringify(r.condition)}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{r.cooldownSec}s</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => deleteRuleMutation.mutate(r.id)}
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab Content: Channels ── */}
      {activeTab === 'CHANNELS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.length === 0 ? (
            <div className="col-span-2 p-12 text-center rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800">
              <Radio className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-300 text-sm font-semibold">No notification channels added</p>
              <p className="text-zinc-500 text-xs mt-1">
                Configure a Telegram Bot or Slack Webhook to receive instant downtime and security alerts.
              </p>
            </div>
          ) : (
            channels.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{c.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F38020]/15 text-[#F38020] border border-[#F38020]/30">
                      {c.type}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 font-mono mt-1">
                    Configured and active
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testChannelMutation.mutate(c.id)}
                    disabled={testChannelMutation.isPending}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Send className="w-3 h-3" /> Test
                  </button>
                  <button
                    onClick={() => deleteChannelMutation.mutate(c.id)}
                    className="p-1 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Add Rule Modal ── */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Create Alert Rule</h3>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Rule Name</label>
              <input
                type="text"
                placeholder="e.g. CPU Exceeds 90%"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-[#F38020]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Category</label>
                <select
                  value={ruleCategory}
                  onChange={(e) => setRuleCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#F38020]"
                >
                  <option value="INFRA">INFRA</option>
                  <option value="SECURITY">SECURITY</option>
                  <option value="DEPLOYMENT">DEPLOYMENT</option>
                  <option value="AVAILABILITY">AVAILABILITY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Severity</label>
                <select
                  value={ruleSeverity}
                  onChange={(e) => setRuleSeverity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#F38020]"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Metric</label>
                <select
                  value={ruleMetric}
                  onChange={(e) => setRuleMetric(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#F38020]"
                >
                  <option value="cpu_pct">CPU Usage (%)</option>
                  <option value="memory_pct">RAM Usage (%)</option>
                  <option value="disk_pct">Disk Usage (%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Threshold (%)</label>
                <input
                  type="number"
                  value={ruleThreshold}
                  onChange={(e) => setRuleThreshold(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#F38020]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createRuleMutation.mutate({
                    name: ruleName,
                    category: ruleCategory,
                    severity: ruleSeverity,
                    condition: { metric: ruleMetric, op: '>', threshold: Number(ruleThreshold) },
                  })
                }
                disabled={!ruleName || createRuleMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-[#F38020] hover:bg-[#E07116] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-md shadow-[#F38020]/20"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Channel Modal ── */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Add Notification Channel</h3>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Channel Name</label>
              <input
                type="text"
                placeholder="e.g. NOC Emergency Telegram Group"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-[#F38020]"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Channel Type</label>
              <select
                value={channelType}
                onChange={(e) => setChannelType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#F38020]"
              >
                <option value="TELEGRAM">Telegram Bot</option>
                <option value="SLACK">Slack Incoming Webhook</option>
                <option value="WEBHOOK">Custom HTTP Webhook</option>
              </select>
            </div>

            {channelType === 'TELEGRAM' && (
              <>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Bot Token</label>
                  <input
                    type="password"
                    placeholder="123456789:ABCDefGHI..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#F38020]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Chat ID</label>
                  <input
                    type="text"
                    placeholder="-100xxxxxxxxx or user ID"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#F38020]"
                  />
                </div>
              </>
            )}

            {(channelType === 'SLACK' || channelType === 'WEBHOOK') && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://hooks.slack.com/services/... or https://api.mycorp.com/alerts"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#F38020]"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowChannelModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createChannelMutation.mutate({
                    name: channelName,
                    type: channelType,
                    config:
                      channelType === 'TELEGRAM'
                        ? { bot_token: botToken, chat_id: chatId }
                        : { webhook_url: webhookUrl },
                  })
                }
                disabled={!channelName || createChannelMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Save Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlertCenterView;
