'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Store,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  Bot,
  CreditCard,
  Building2,
  Plus,
  RefreshCw,
  Code2,
  Smartphone,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coffee,
  ShoppingBag,
} from 'lucide-react';
import type { BusinessType, CreateOrganizationInput } from '@mystore/contracts';

const BUSINESS_TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  CAFE: { label: 'Coffee Shop & Bakery', icon: Coffee },
  RETAIL: { label: 'Retail & Supermarket', icon: ShoppingBag },
  RESTAURANT: { label: 'Restaurant & Dining', icon: Store },
  WHOLESALE: { label: 'Wholesale & B2B', icon: Building2 },
};

export default function StorefrontChannelsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // Form state for creating new store (e.g. coffee shop)
  const [newStore, setNewStore] = useState<CreateOrganizationInput>({
    name: '',
    slug: '',
    currency: 'USD',
    timezone: 'UTC',
    businessType: 'CAFE',
    ownerEmail: '',
    ownerName: '',
    ownerPassword: '',
  });

  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');

  // 1. Fetch current or all organizations
  const { data: orgs = [], isLoading: isLoadingOrgs, refetch: refetchOrgs } = useQuery({
    queryKey: ['organizations-list'],
    queryFn: () => api.listOrganizations(token!),
    enabled: Boolean(token),
  });

  const activeOrgId = selectedOrgId || user?.organizationId || orgs[0]?.id || '';
  const currentOrg = orgs.find((o) => o.id === activeOrgId) || orgs[0];

  // 2. Fetch live channels for active organization
  const { data: channels, isLoading: isLoadingChannels, refetch: refetchChannels } = useQuery({
    queryKey: ['org-channels', activeOrgId],
    queryFn: () => api.getOrgChannels(token!, activeOrgId),
    enabled: Boolean(token && activeOrgId),
  });

  // 3. Create Store Mutation
  const createStoreMutation = useMutation({
    mutationFn: (input: CreateOrganizationInput) => api.createOrganization(token!, input),
    onSuccess: (created) => {
      toast.success(`Store "${created.name}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['organizations-list'] });
      setSelectedOrgId(created.id);
      setIsCreateModalOpen(false);
      setNewStore({
        name: '',
        slug: '',
        currency: 'USD',
        timezone: 'UTC',
        businessType: 'CAFE',
        ownerEmail: '',
        ownerName: '',
        ownerPassword: '',
      });
    },
    onError: (err: any) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to create store');
    },
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.name) {
      toast.error('Store name is required');
      return;
    }
    createStoreMutation.mutate(newStore);
  };

  // QR Code URL via standard image generator
  const qrCodeUrl = channels?.telegramMiniAppUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(channels.telegramMiniAppUrl)}`
    : '';

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Store className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Storefront & Telegram Mini App Channels
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Multi-store management, Telegram WebApp e-commerce, and live customer checkout channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Multi-Store Switcher for Super Admins */}
          {isSuperAdmin && orgs.length > 1 && (
            <select
              value={activeOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="bg-card border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.slug})
                </option>
              ))}
            </select>
          )}

          {isSuperAdmin && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Provision New Store / Cafe
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              refetchOrgs();
              refetchChannels();
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Active Store Banner */}
      <div className="bg-gradient-to-r from-card to-card/50 border border-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-foreground">
              {channels?.organizationName || currentOrg?.name || 'My Store'}
            </span>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 uppercase text-xs">
              {currentOrg?.businessType || 'CAFE'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              ID: {channels?.organizationId || activeOrgId}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span>Slug: <strong className="text-foreground">{channels?.organizationSlug || currentOrg?.slug}</strong></span>
            <span>•</span>
            <span>Currency: <strong className="text-foreground">{currentOrg?.currency || 'USD'}</strong></span>
            <span>•</span>
            <span>Tax Rate: <strong className="text-foreground">{currentOrg?.taxRatePct || 10}%</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={channels?.storefrontUrl || 'http://localhost:5001'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-card border border-border hover:bg-muted text-foreground transition-all"
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            Open Web Store
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </a>
          <a
            href={channels?.telegramMiniAppUrl || '/mini'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
          >
            <Smartphone className="w-4 h-4" />
            Test Telegram Mini App
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 2-Column Grid: Channel 1 & Channel 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel 1: Telegram Mini App */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">Telegram Mini App E-Commerce</h3>
                <p className="text-xs text-muted-foreground">
                  Embedded e-commerce running inside Telegram chats and channels
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Active Channel
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-muted/40 border border-border">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="Telegram Mini App QR"
                className="w-36 h-36 rounded-lg border border-border bg-white p-1.5 shadow-sm"
              />
            ) : (
              <div className="w-36 h-36 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
                Generating QR...
              </div>
            )}
            <div className="space-y-3 flex-1">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Mini App WebApp URL:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={channels?.telegramMiniAppUrl || ''}
                    className="w-full text-xs font-mono bg-background border border-border rounded px-2.5 py-1.5 text-foreground truncate"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(channels?.telegramMiniAppUrl || '', 'mini-url')}
                  >
                    {copiedKey === 'mini-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Scan with any phone camera or Telegram scanner to open this store's ordering catalog instantly.
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              BotFather Setup Instructions:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open <strong>@BotFather</strong> on Telegram and send <code className="text-primary">/setmenubutton</code>.</li>
              <li>Select your coffee shop bot token registered in <strong>Telegram Platform</strong>.</li>
              <li>Paste the <strong>Mini App WebApp URL</strong> shown above.</li>
              <li>Customers can now click the &quot;Order Now&quot; button in Telegram to browse and pay!</li>
            </ol>
          </div>
        </div>

        {/* Channel 2: ABA PayWay & Dynamic Payment */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">ABA PayWay Dynamic Gateway</h3>
                <p className="text-xs text-muted-foreground">
                  Per-tenant KHQR generation and bank account settlement
                </p>
              </div>
            </div>
            {channels?.paywayConfigured ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Linked & Active
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Not Configured
              </Badge>
            )}
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Active Merchant ID:</span>
              <span className="font-mono font-bold text-foreground">
                {channels?.paywayMerchantId || 'Platform Default (Sandbox)'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Settlement Target:</span>
              <span className="text-foreground">
                Direct to {channels?.organizationName || 'Store'} Bank Account
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Payment Verification:</span>
              <span className="text-emerald-400 font-semibold">
                HMAC-SHA512 + EMVCo NBC Bakong KHQR
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-2">
            <p>
              Each store owner can enter their own ABA PayWay Merchant ID and API Key under <strong>Settings</strong>.
              When an order is created, customer QR codes are generated with that store&apos;s credentials.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/settings'}
              className="text-xs text-primary border-primary/30 hover:bg-primary/10 mt-2"
            >
              Configure PayWay Credentials in Settings →
            </Button>
          </div>
        </div>
      </div>

      {/* Public Endpoints Directory */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <Code2 className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-foreground text-sm">
              Multi-Tenant API Endpoints for this Store
            </h3>
            <p className="text-xs text-muted-foreground">
              Use these endpoints for custom mobile apps, third-party kiosks, or web frontends.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              method: 'GET',
              name: 'Public Catalog for this Store',
              url: channels?.publicCatalogEndpoint || `${channels?.apiBaseUrl}/public/products?organizationId=${activeOrgId}`,
            },
            {
              method: 'POST',
              name: 'Storefront Checkout & KHQR Generation',
              url: channels?.checkoutEndpoint || `${channels?.apiBaseUrl}/sales/checkout`,
            },
            {
              method: 'POST',
              name: 'Telegram WebApp Session Authentication',
              url: channels?.telegramBotAuthEndpoint || `${channels?.apiBaseUrl}/telegram/mini-app/auth`,
            },
          ].map((ep, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                    {ep.method}
                  </span>
                  <span className="text-xs font-semibold text-foreground">{ep.name}</span>
                </div>
                <code className="text-[11px] font-mono text-muted-foreground block truncate">
                  {ep.url}
                </code>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(ep.url, `ep-${idx}`)}
                className="self-start sm:self-auto shrink-0"
              >
                {copiedKey === `ep-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Dialog: Create New Store / Coffee Shop */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Coffee className="w-5 h-5 text-primary" />
              Provision New Store / Coffee Shop
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create an isolated organization tenant with dedicated catalog, staff, PayWay gateway, and Telegram Mini App.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Store Name *</label>
              <Input
                type="text"
                placeholder="e.g. Brown Coffee - BKK Branch"
                value={newStore.name}
                onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Business Type</label>
                <select
                  value={newStore.businessType}
                  onChange={(e) => setNewStore({ ...newStore, businessType: e.target.value as BusinessType })}
                  className="w-full bg-background border border-border text-foreground text-xs rounded-md px-3 py-2 outline-none"
                >
                  <option value="CAFE">CAFE (Coffee Shop)</option>
                  <option value="RETAIL">RETAIL (Retail & Supermarket)</option>
                  <option value="RESTAURANT">RESTAURANT (Dining)</option>
                  <option value="WHOLESALE">WHOLESALE (B2B)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Currency</label>
                <select
                  value={newStore.currency}
                  onChange={(e) => setNewStore({ ...newStore, currency: e.target.value })}
                  className="w-full bg-background border border-border text-foreground text-xs rounded-md px-3 py-2 outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="KHR">KHR (៛)</option>
                </select>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-3">
              <h4 className="text-xs font-bold text-foreground">
                Optional: Store Owner Account (ORG_ADMIN)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">Owner Name</label>
                  <Input
                    type="text"
                    placeholder="e.g. Sokha Chan"
                    value={newStore.ownerName || ''}
                    onChange={(e) => setNewStore({ ...newStore, ownerName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">Owner Email</label>
                  <Input
                    type="email"
                    placeholder="owner@cafe.test"
                    value={newStore.ownerEmail || ''}
                    onChange={(e) => setNewStore({ ...newStore, ownerEmail: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Initial Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newStore.ownerPassword || ''}
                  onChange={(e) => setNewStore({ ...newStore, ownerPassword: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createStoreMutation.isPending}>
                {createStoreMutation.isPending ? 'Creating Store...' : 'Create Store'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
