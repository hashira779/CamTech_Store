'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  SearchCheck,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { UpdateBakongConfigInput, VerifyBakongAccountResultDto } from '@mystore/contracts';

export function BakongSettings() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerifyBakongAccountResultDto | null>(null);

  const [formData, setFormData] = useState<UpdateBakongConfigInput>({
    accountId: '',
    accountType: 'INDIVIDUAL',
    merchantName: '',
    merchantId: '',
    acquiringBank: '',
    merchantCity: 'Phnom Penh',
    currency: 'USD',
    enabled: true,
    token: '',
    webhookSecret: '',
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
        accountType: bakongData.accountType || 'INDIVIDUAL',
        merchantName: bakongData.merchantName || '',
        merchantId: bakongData.merchantId || '',
        acquiringBank: bakongData.acquiringBank || '',
        merchantCity: bakongData.merchantCity || 'Phnom Penh',
        currency: bakongData.currency || 'USD',
        enabled: bakongData.enabled ?? true,
        token: '', // Secrets are write-only: the API returns only a mask
        webhookSecret: '',
      });
    }
  }, [bakongData]);

  const failSave = (msg: string) => {
    setError(msg);
    toast.error('Update failed', { description: msg });
  };

  // Verification Mutation
  const verifyMutation = useMutation({
    mutationFn: (input: { accountId: string; token?: string }) =>
      api.verifyOrgBakongAccount(token!, input),
    onSuccess: (res) => {
      setVerificationResult(res);
      if (res.valid) {
        setError(null);
        toast.success('Account ID exists on Bakong');
      } else {
        setError(res.message);
        toast.error('Bakong check failed', { description: res.message });
      }
    },
    onError: (err: any) => {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to reach NBC verification service';
      setError(msg);
      setVerificationResult({
        valid: false,
        accountId: formData.accountId,
        message: msg,
      });
    },
  });

  // Save Mutation
  const mutation = useMutation({
    mutationFn: (input: UpdateBakongConfigInput) => api.updateOrgBakong(token!, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['org-bakong'], updated);
      queryClient.invalidateQueries({ queryKey: ['org-channels'] });
      setSavedSuccess(true);
      setError(null);
      setFormData((prev) => ({ ...prev, token: '', webhookSecret: '' }));
      setVerificationResult({ valid: true, accountId: updated.accountId, message: 'Account ID exists on Bakong' });
      toast.success('Bakong settings updated', { description: `QR payments now go to ${updated.accountId}` });
      setTimeout(() => setSavedSuccess(false), 3000);
    },
    onError: (err: any) => {
      failSave(err instanceof ApiClientError ? err.message : 'Update failed — could not reach the server. Nothing was saved.');
    },
  });

  const handleVerify = () => {
    if (!formData.accountId.trim()) {
      setError('Please enter a Bakong Account ID to verify.');
      return;
    }
    setError(null);
    verifyMutation.mutate({
      accountId: formData.accountId.trim(),
      token: formData.token?.trim() || undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.merchantName?.trim() || '';
    const asciiOnly = /^[\x20-\x7E]+$/;
    // Same rules the server enforces (KHQR limits) — caught here so the alert is instant.
    const problems = [
      !/^[a-z0-9_.\-]+@[a-z0-9_.\-]+$/i.test(formData.accountId.trim()) && 'Bakong Account ID must look like name@bank — copy it from your Bakong app.',
      !name && 'Merchant name is required — enter it exactly as shown in your Bakong app.',
      name.length > 25 && `Merchant name is ${name.length} characters; KHQR allows at most 25.`,
      name && !asciiOnly.test(name) && 'Merchant name must use English letters, numbers and symbols only.',
      (formData.merchantCity?.trim().length || 0) > 15 && 'Merchant city allows at most 15 characters.',
      formData.accountType === 'MERCHANT' && !formData.merchantId?.trim() && 'Merchant ID is required for a merchant account (see your Bakong app).',
      formData.accountType === 'MERCHANT' && !formData.acquiringBank?.trim() && 'Acquiring bank is required for a merchant account.',
    ].filter(Boolean) as string[];
    if (problems.length) {
      failSave(problems.join(' '));
      return;
    }
    // Blank secret fields mean "keep the stored secret".
    mutation.mutate({
      ...formData,
      merchantName: name,
      merchantId: formData.accountType === 'MERCHANT' ? formData.merchantId?.trim() : undefined,
      acquiringBank: formData.acquiringBank?.trim() || undefined,
      token: formData.token?.trim() || undefined,
      webhookSecret: formData.webhookSecret?.trim() || undefined,
    });
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
          <div className="w-9 h-9 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive font-bold text-xs tracking-wider">
            KHQR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-foreground text-sm">Bakong KHQR Payment Dynamic Integration</h2>
              {isConfigured ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Active & Bound
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-warning/10 text-warning border border-warning/20 px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" /> Not Configured
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              Strictly validated with National Bank of Cambodia (NBC). All customer payments deposit directly into this account.
            </p>
          </div>
        </div>

        {bakongData?.accountVerifiedAt && (
          <div className="text-[11px] bg-success/10 border border-success/20 px-3 py-1.5 rounded-lg text-success flex items-center gap-2 self-start sm:self-auto font-medium">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>Account confirmed on Bakong {new Date(bakongData.accountVerifiedAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Update failed — nothing was saved</p>
              <p className="text-[11px] text-destructive/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Verification Success Alert */}
        {verificationResult?.valid && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Bakong confirms this account exists: <strong className="font-mono">{verificationResult.accountId}</strong>
              </span>
            </div>
            <span className="text-[10px] bg-success/20 px-2 py-0.5 rounded font-mono font-bold">
              VERIFIED
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-foreground text-xs">
                Bakong Account ID / Phone *
              </label>
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifyMutation.isPending || !formData.accountId.trim()}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold disabled:opacity-50"
              >
                {verifyMutation.isPending ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <SearchCheck className="w-3.5 h-3.5" />
                )}
                Verify on NBC Network
              </button>
            </div>
            <input
              type="text"
              disabled={!canWrite}
              value={formData.accountId}
              onChange={(e) => {
                setFormData({ ...formData, accountId: e.target.value });
                setVerificationResult(null);
              }}
              className="input w-full text-xs font-mono"
              placeholder="e.g. chhoy_ratha@aclb or 85512345678@wing"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Bakong app → Profile → your Bakong ID, including <code>@bank</code>.
            </p>
          </div>

          <div>
            <label className="block font-medium text-foreground text-xs mb-1">
              Merchant Name * <span className="text-muted-foreground font-normal">({(formData.merchantName || '').length}/25)</span>
            </label>
            <input
              type="text"
              disabled={!canWrite}
              value={formData.merchantName}
              onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
              className="input w-full text-xs"
              placeholder="Exactly as shown in your Bakong app"
              maxLength={25}
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Bakong does not return the owner name, so type it as your Bakong app shows it. English, max 25 (KHQR tag 59).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium text-foreground text-xs mb-1">Account Type *</label>
            <select
              disabled={!canWrite}
              value={formData.accountType}
              onChange={(e) => setFormData({ ...formData, accountType: e.target.value as 'INDIVIDUAL' | 'MERCHANT' })}
              className="input w-full text-xs"
            >
              <option value="INDIVIDUAL">Individual (personal Bakong account)</option>
              <option value="MERCHANT">Merchant (has a Merchant ID)</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-foreground text-xs mb-1">
              Merchant ID {formData.accountType === 'MERCHANT' ? '*' : <span className="text-muted-foreground font-normal">(merchant accounts)</span>}
            </label>
            <input
              type="text"
              disabled={!canWrite || formData.accountType !== 'MERCHANT'}
              value={formData.merchantId || ''}
              onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
              className="input w-full text-xs font-mono"
              placeholder="From your Bakong merchant profile"
              maxLength={32}
            />
          </div>
          <div>
            <label className="block font-medium text-foreground text-xs mb-1">
              Acquiring Bank {formData.accountType === 'MERCHANT' ? '*' : <span className="text-muted-foreground font-normal">(optional)</span>}
            </label>
            <input
              type="text"
              disabled={!canWrite}
              value={formData.acquiringBank || ''}
              onChange={(e) => setFormData({ ...formData, acquiringBank: e.target.value })}
              className="input w-full text-xs"
              placeholder="e.g. ACLEDA Bank"
              maxLength={32}
            />
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
              maxLength={15}
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
            Bakong Open API Token {bakongData?.hasToken ? <span className="text-muted-foreground font-normal">(saved)</span> : '*'}
          </label>
          <input
            type="password"
            disabled={!canWrite}
            value={formData.token}
            onChange={(e) => setFormData({ ...formData, token: e.target.value })}
            className="input w-full text-xs font-mono"
            placeholder={bakongData?.tokenMasked ? `${bakongData.tokenMasked} — leave blank to keep` : 'Paste the Bearer token issued to your organization'}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            From NBC Open API (register → verify email → token; renew when it expires). Needed to check the account and confirm payments.
            Stored encrypted (AES-256-GCM) and never shown again.
          </p>
        </div>

        <div className="pt-2">
          <label className="block font-medium text-foreground text-xs mb-1">
            Payment Webhook Signing Secret <span className="text-muted-foreground font-normal">(Optional)</span>
          </label>
          <input
            type="password"
            disabled={!canWrite}
            value={formData.webhookSecret}
            onChange={(e) => setFormData({ ...formData, webhookSecret: e.target.value })}
            className="input w-full text-xs font-mono"
            placeholder={bakongData?.webhookSecretMasked ? `${bakongData.webhookSecretMasked} — leave blank to keep` : 'Shared secret from your bank partner for signed payment callbacks'}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Enables instant confirmation via <span className="font-mono">POST /api/v1/sales/bakong-webhook</span> (HMAC-SHA256). Without it, payments are confirmed by polling.
          </p>
        </div>

        {canWrite && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              <span>Strict validation ensures no invalid account can be configured or generate broken QR codes.</span>
            </div>
            <div className="flex items-center gap-3">
              {savedSuccess && (
                <div className="flex items-center gap-1.5 text-success text-xs font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Verified & Saved
                </div>
              )}
              <button
                type="submit"
                disabled={mutation.isPending || verifyMutation.isPending}
                className="btn px-4 py-2 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {mutation.isPending ? 'Verifying with NBC...' : 'Save & Bind Bakong Account'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
