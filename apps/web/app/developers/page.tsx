'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type {
  ApiKeyDto,
  CreateApiKeyInput,
  CreateApiKeyResultDto,
  WebhookSubscriptionDto,
  CreateWebhookSubscriptionInput,
  DeveloperAppDto,
  CreateDeveloperAppInput,
  ApiScope,
  WebhookEvent,
} from '@mystore/contracts';
import {
  Code2,
  Key,
  Webhook,
  AppWindow,
  Plus,
  RefreshCw,
  Copy,
  Check,
  X,
  Trash2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

const ALL_SCOPES: ApiScope[] = [
  'products:read',
  'products:write',
  'inventory:read',
  'inventory:write',
  'sales:read',
  'sales:write',
  'customers:read',
  'customers:write',
  'reports:read',
  'finance:read',
  'webhooks:manage',
];

const ALL_EVENTS: WebhookEvent[] = [
  'order.created',
  'order.paid',
  'inventory.low_stock',
  'inventory.adjusted',
  'transfer.dispatched',
  'transfer.received',
  'workflow.approval_required',
  'customer.registered',
];

export default function DevelopersPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'KEYS' | 'WEBHOOKS' | 'APPS'>('KEYS');

  // Modals
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<CreateApiKeyResultDto | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Forms
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>(['products:read', 'sales:read']);
  const [rateLimit, setRateLimit] = useState('60');

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDesc, setWebhookDesc] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>(['order.created', 'inventory.low_stock']);

  const [appName, setAppName] = useState('');
  const [appDesc, setAppDesc] = useState('');
  const [appUrl, setAppUrl] = useState('');

  // Queries
  const { data: apiKeys = [], refetch: refetchKeys, isLoading: loadingKeys } = useQuery({
    queryKey: ['developerApiKeys'],
    queryFn: () => api.listApiKeys(token!),
    enabled: Boolean(token),
  });

  const { data: webhooks = [], refetch: refetchWebhooks } = useQuery({
    queryKey: ['developerWebhooks'],
    queryFn: () => api.listWebhookSubscriptions(token!),
    enabled: Boolean(token),
  });

  const { data: apps = [], refetch: refetchApps } = useQuery({
    queryKey: ['developerApps'],
    queryFn: () => api.listDeveloperApps(token!),
    enabled: Boolean(token),
  });

  // Mutations
  const createKeyMutation = useMutation({
    mutationFn: (input: CreateApiKeyInput) => api.createApiKey(token!, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['developerApiKeys'] });
      setIsKeyModalOpen(false);
      setNewlyCreatedKey(result);
      setKeyName('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to create API key'),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => api.revokeApiKey(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['developerApiKeys'] }),
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to revoke API key'),
  });

  const createWebhookMutation = useMutation({
    mutationFn: (input: CreateWebhookSubscriptionInput) => api.createWebhookSubscription(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developerWebhooks'] });
      setIsWebhookModalOpen(false);
      setWebhookUrl('');
      setWebhookDesc('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to create webhook'),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => api.deleteWebhookSubscription(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['developerWebhooks'] }),
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to delete webhook'),
  });

  const createAppMutation = useMutation({
    mutationFn: (input: CreateDeveloperAppInput) => api.createDeveloperApp(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developerApps'] });
      setIsAppModalOpen(false);
      setAppName('');
      setAppDesc('');
      setAppUrl('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to register app'),
  });

  const handleCopyKey = () => {
    if (!newlyCreatedKey) return;
    navigator.clipboard.writeText(newlyCreatedKey.secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const toggleScope = (scope: ApiScope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Code2 className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Developer & Partner Platform
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage scoped API keys, real-time outbound webhooks, and third-party application credentials.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="http://localhost:4000/api/docs"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary flex items-center gap-1.5 text-xs py-2"
            >
              <ExternalLink className="w-3.5 h-3.5" /> API Documentation
            </a>
            <button
              onClick={() => {
                refetchKeys();
                refetchWebhooks();
                refetchApps();
              }}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {activeTab === 'KEYS' && (
              <button
                onClick={() => setIsKeyModalOpen(true)}
                className="btn flex items-center gap-1.5 text-sm shadow-sm"
              >
                <Plus className="w-4 h-4" /> Generate API Key
              </button>
            )}
            {activeTab === 'WEBHOOKS' && (
              <button
                onClick={() => setIsWebhookModalOpen(true)}
                className="btn flex items-center gap-1.5 text-sm shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Webhook
              </button>
            )}
            {activeTab === 'APPS' && (
              <button
                onClick={() => setIsAppModalOpen(true)}
                className="btn flex items-center gap-1.5 text-sm shadow-sm"
              >
                <Plus className="w-4 h-4" /> Register App
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('KEYS')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'KEYS'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            API Credentials ({apiKeys.length})
          </button>
          <button
            onClick={() => setActiveTab('WEBHOOKS')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'WEBHOOKS'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Webhook Subscriptions ({webhooks.length})
          </button>
          <button
            onClick={() => setActiveTab('APPS')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'APPS'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Registered Applications ({apps.length})
          </button>
        </div>

        {/* TAB 1: API KEYS */}
        {activeTab === 'KEYS' && (
          <div className="card border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-accent/40 text-muted-foreground border-b border-border">
                    <th className="p-3 font-semibold uppercase tracking-wider">Key Name</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Key Prefix</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Scopes Granted</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Rate Limit</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Status</th>
                    <th className="p-3 font-semibold uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {apiKeys.map((key) => {
                    const isRevoked = Boolean(key.revokedAt);
                    return (
                      <tr key={key.id} className="hover:bg-accent/20 transition-colors">
                        <td className="p-3 font-bold text-foreground">{key.name}</td>
                        <td className="p-3 font-mono text-primary font-semibold">{key.keyPrefix}••••••••</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {key.scopes.map((s) => (
                              <span key={s} className="px-1.5 py-0.5 rounded bg-accent text-foreground text-[10px] font-mono">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">{key.rateLimit} req/min</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isRevoked ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {isRevoked ? 'REVOKED' : 'ACTIVE'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {!isRevoked && (
                            <button
                              onClick={() => {
                                if (confirm(`Revoke API key '${key.name}'? Applications using it will be cut off.`)) {
                                  revokeKeyMutation.mutate(key.id);
                                }
                              }}
                              className="btn btn-secondary py-1 px-2.5 text-[11px] text-destructive hover:bg-destructive/10"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: WEBHOOKS */}
        {activeTab === 'WEBHOOKS' && (
          <div className="space-y-4">
            {webhooks.length === 0 ? (
              <div className="card p-12 text-center border-border">
                <Webhook className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-base font-semibold text-foreground">No webhook endpoints configured</p>
                <p className="text-xs text-muted-foreground mt-1">Subscribe endpoints to receive real-time JSON payloads on business events.</p>
              </div>
            ) : (
              webhooks.map((sub) => (
                <div key={sub.id} className="card p-5 border-border shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground text-sm">{sub.url}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {sub.isActive ? 'LISTENING' : 'DISABLED'}
                        </span>
                      </div>
                      {sub.description && (
                        <p className="text-xs text-muted-foreground mt-1">{sub.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteWebhookMutation.mutate(sub.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete webhook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Subscribed Events</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sub.events.map((ev) => (
                        <span key={ev} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-mono">
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: APPS */}
        {activeTab === 'APPS' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((a) => (
              <div key={a.id} className="card p-5 border-border shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">{a.name}</h3>
                  <div className="p-2 rounded-lg bg-accent text-foreground">
                    <AppWindow className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{a.description || 'Custom developer integration'}</p>
                {a.homepageUrl && (
                  <a href={a.homepageUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline flex items-center gap-1 mt-4">
                    {a.homepageUrl} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MODAL: SECRET KEY REVEAL (ONCE) */}
        {newlyCreatedKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="card w-full max-w-lg p-6 border-emerald-500/50 shadow-2xl bg-card space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <Key className="w-5 h-5" />
                <h3 className="text-base font-bold text-foreground">API Key Generated Successfully</h3>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Please copy and store your secret key now. For your security, this key <strong>will never be shown again</strong>.
                </span>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border font-mono text-xs text-foreground select-all overflow-x-auto">
                <span className="flex-1 break-all">{newlyCreatedKey.secretKey}</span>
                <button
                  onClick={handleCopyKey}
                  className="btn py-1 px-3 text-xs flex items-center gap-1.5 shrink-0"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={() => setNewlyCreatedKey(null)} className="btn text-xs">
                  I have saved this key safely
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: GENERATE API KEY */}
        {isKeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Generate Scoped API Key</h3>
                <button onClick={() => setIsKeyModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createKeyMutation.mutate({
                  name: keyName,
                  scopes: selectedScopes,
                  rateLimit: parseInt(rateLimit) || 60,
                });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Key Name / Purpose</label>
                  <input required value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. ERP Inventory Synchronization Key" className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Rate Limit (req / min)</label>
                  <input type="number" min="10" max="10000" value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Granular Scopes</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg border border-border bg-background">
                    {ALL_SCOPES.map((sc) => (
                      <label key={sc} className="flex items-center gap-2 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(sc)}
                          onChange={() => toggleScope(sc)}
                          className="rounded border-border"
                        />
                        <span className="font-mono">{sc}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsKeyModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createKeyMutation.isPending || selectedScopes.length === 0} className="btn">
                    {createKeyMutation.isPending ? 'Generating...' : 'Generate Key'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD WEBHOOK */}
        {isWebhookModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Subscribe Webhook Destination</h3>
                <button onClick={() => setIsWebhookModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createWebhookMutation.mutate({
                  url: webhookUrl,
                  description: webhookDesc || undefined,
                  events: selectedEvents,
                });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Endpoint URL (HTTPS)</label>
                  <input type="url" required value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://api.yourdomain.com/webhook" className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Description</label>
                  <input value={webhookDesc} onChange={(e) => setWebhookDesc(e.target.value)} placeholder="Fulfillment updates listener..." className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Subscribed Events</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg border border-border bg-background">
                    {ALL_EVENTS.map((ev) => (
                      <label key={ev} className="flex items-center gap-2 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(ev)}
                          onChange={() => toggleEvent(ev)}
                          className="rounded border-border"
                        />
                        <span className="font-mono">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsWebhookModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createWebhookMutation.isPending || selectedEvents.length === 0} className="btn">
                    {createWebhookMutation.isPending ? 'Subscribing...' : 'Subscribe Webhook'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: REGISTER APP */}
        {isAppModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-sm p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Register Developer Application</h3>
                <button onClick={() => setIsAppModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createAppMutation.mutate({ name: appName, description: appDesc || undefined, homepageUrl: appUrl || undefined });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Application Name</label>
                  <input required value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="e.g. Mobile Delivery Courier App" className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Description</label>
                  <input value={appDesc} onChange={(e) => setAppDesc(e.target.value)} placeholder="Integration summary..." className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Homepage / Documentation URL</label>
                  <input type="url" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsAppModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createAppMutation.isPending} className="btn">
                    {createAppMutation.isPending ? 'Registering...' : 'Register Application'}
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
