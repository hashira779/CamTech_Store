'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { Skeleton } from '@/components/ui/skeleton';
import {
  QrCode,
  Save,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import type { UpdateBakongConfigInput } from '@mystore/contracts';

export function BakongSettings() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UpdateBakongConfigInput>({
    accountId: '',
    merchantName: '',
    merchantCity: 'Phnom Penh',
    currency: 'USD',
    enabled: true,
    token: '',
  });

  const canWrite = hasPermission('organizations.write');

  const { data: bakongData, isLoading } = useQuery({
    queryKey: ['org-bakong'],
    queryFn: () => api.getCurrentOrgBakong(token!),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (bakongData) {
      setFormData({
        accountId: bakongData.accountId || '',
        merchantName: bakongData.merchantName || '',
        merchantCity: bakongData.merchantCity || 'Phnom Penh',
        currency: bakongData.currency || 'USD',
        enabled: bakongData.enabled ?? true,
        token: '', // Never display bearer tokens in UI
      });
    }
  }, [bakongData]);

  const mutation = useMutation({
    mutationFn: (input: UpdateBakongConfigInput) => api.updateOrgBakong(token!, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['org-bakong'], updated);
      queryClient.invalidateQueries({ queryKey: ['org-channels'] });
      setSavedSuccess(true);
      setError(null);
      setFormData((prev) => ({ ...prev, token: '' }));
      setTimeout(() => setSavedSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err instanceof ApiClientError ? err.message : 'Failed to save Bakong KHQR settings');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId.trim()) {
      setError('Bakong Account ID is required (e.g. your_account@bank or phone number).');
      return;
    }
    mutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="card p-5 border-border space-y-4 mt-6">
        <Skeleton className="h-5 w-48 rounded" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    );
  }

  const isConfigured = Boolean(bakongData?.isConfigured);

  return (
    <div className="card p-5 border-border mt-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 font-black text-xs tracking-wider">
            KHQR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-foreground text-sm">Bakong KHQR Payment Dynamic Integration</h2>
              {isConfigured ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Active & Bound
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" /> Not Configured
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              Every store receives funds directly into their own Bakong account. Configure your account ID below.
            </p>
          </div>
        </div>

        {bakongData?.accountName && (
          <div className="text-[11px] bg-secondary/40 border border-border px-2.5 py-1 rounded-md text-foreground flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified: <strong className="font-mono">{bakongData.accountName}</strong></span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-foreground text-xs mb-1">
              Bakong Account ID / Phone *
            </label>
            <input
              type="text"
              disabled={!canWrite}
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              className="input w-full text-xs font-mono"
              placeholder="e.g. chhoy_ratha@aclb or 012345678@wing"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Obtain this from your Bakong App profile or commercial bank integration.
            </p>
          </div>

          <div>
            <label className="block font-medium text-foreground text-xs mb-1">
              Merchant Display Name *
            </label>
            <input
              type="text"
              disabled={!canWrite}
              value={formData.merchantName}
              onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
              className="input w-full text-xs"
              placeholder="e.g. CamTech Coffee Store"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Shown to the customer when scanning the dynamic KHQR code.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium text-foreground text-xs mb-1">
              Merchant City
            </label>
            <input
              type="text"
              disabled={!canWrite}
              value={formData.merchantCity}
              onChange={(e) => setFormData({ ...formData, merchantCity: e.target.value })}
              className="input w-full text-xs"
              placeholder="Phnom Penh"
            />
          </div>

          <div>
            <label className="block font-medium text-foreground text-xs mb-1">
              Default Settlement Currency
            </label>
            <select
              disabled={!canWrite}
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="input w-full text-xs"
            >
              <option value="USD">USD ($) - United States Dollar</option>
              <option value="KHR">KHR (៛) - Khmer Riel</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-foreground text-xs mb-1">
              Payment Gateway Status
            </label>
            <label className="flex items-center gap-2 text-xs h-9 cursor-pointer">
              <input
                type="checkbox"
                disabled={!canWrite}
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary w-4 h-4"
              />
              <span className="font-medium text-foreground">
                {formData.enabled ? 'Enabled in Storefront & POS' : 'Disabled (Hidden)'}
              </span>
            </label>
          </div>
        </div>

        {/* Optional partner token for high-volume stores */}
        <div className="pt-2">
          <label className="block font-medium text-foreground text-xs mb-1">
            Custom Bakong OpenAPI Partner Token <span className="text-muted-foreground font-normal">(Optional)</span>
          </label>
          <input
            type="password"
            disabled={!canWrite}
            value={formData.token}
            onChange={(e) => setFormData({ ...formData, token: e.target.value })}
            className="input w-full text-xs font-mono"
            placeholder={isConfigured ? '•••••••• Leave blank to keep existing store token ••••••••' : 'Paste custom Bearer token if issued directly to your organization'}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            If left blank, the system automatically uses the central platform gateway token for NBC verification.
          </p>
        </div>

        {canWrite && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              <span>Dynamic KHQR will immediately route payments for this store without hardcoded code.</span>
            </div>
            <div className="flex items-center gap-3">
              {savedSuccess && (
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved & Synchronized
                </div>
              )}
              <button
                type="submit"
                disabled={mutation.isPending}
                className="btn px-4 py-2 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {mutation.isPending ? 'Validating on NBC...' : 'Save Bakong Settings'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
