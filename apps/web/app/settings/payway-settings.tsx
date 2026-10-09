'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export function PaywaySettings() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    merchantId: '',
    publicKey: '',
    rsaPublicKey: '',
    rsaPrivateKey: '',
    isProduction: false,
  });

  const canWrite = hasPermission('organizations.write');

  const { data: paywayData, isLoading } = useQuery({
    queryKey: ['org-payway'],
    queryFn: () => api.getCurrentOrgPayway(token!),
    enabled: Boolean(token),
    retry: false, // 404 is expected if not configured yet
  });

  useEffect(() => {
    if (paywayData) {
      setFormData({
        merchantId: paywayData.merchantId || '',
        publicKey: paywayData.publicKey || '',
        rsaPublicKey: paywayData.rsaPublicKey || '',
        rsaPrivateKey: '', // Never populate private key to frontend
        isProduction: paywayData.isProduction || false,
      });
    }
  }, [paywayData]);

  const mutation = useMutation({
    mutationFn: (input: typeof formData) => api.updateOrgPayway(token!, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['org-payway'], updated);
      setSavedSuccess(true);
      setError(null);
      // Clear private key field after save
      setFormData(prev => ({ ...prev, rsaPrivateKey: '' }));
      setTimeout(() => setSavedSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err instanceof ApiClientError ? err.message : 'Failed to save PayWay settings');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="card p-5 border-border space-y-4">
        <Skeleton className="h-5 w-48 rounded" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="card p-5 border-border mt-6">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border">
        <CreditCard className="w-4 h-4 text-blue-500" />
        <div>
          <h2 className="font-bold text-foreground text-sm">ABA PayWay Configuration</h2>
          <p className="text-muted-foreground text-[11px]">
            Configure KHQR payment integration for this organization.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-foreground mb-1">Merchant ID *</label>
            <input
              type="text"
              disabled={!canWrite}
              value={formData.merchantId}
              onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
              className="input w-full text-xs font-mono"
              placeholder="e.g. ec479308"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Public API Key *</label>
            <input
              type="text"
              disabled={!canWrite}
              value={formData.publicKey}
              onChange={(e) => setFormData({ ...formData, publicKey: e.target.value })}
              className="input w-full text-xs font-mono"
              placeholder="e.g. E844DCD..."
              required
            />
          </div>
        </div>

        <div>
          <label className="block font-medium text-foreground mb-1">Environment Mode</label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={formData.isProduction}
              onChange={(e) => setFormData({ ...formData, isProduction: e.target.checked })}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span>Use Production URLs (uncheck for Sandbox)</span>
          </label>
        </div>

        <div className="pt-2">
          <label className="block font-medium text-foreground mb-1">RSA Public Key</label>
          <textarea
            disabled={!canWrite}
            value={formData.rsaPublicKey}
            onChange={(e) => setFormData({ ...formData, rsaPublicKey: e.target.value })}
            className="input w-full text-xs font-mono h-24 resize-none"
            placeholder="-----BEGIN PUBLIC KEY-----..."
          />
        </div>

        <div className="pt-2">
          <label className="block font-medium text-foreground mb-1">
            RSA Private Key 
            {paywayData?.rsaPublicKey && !formData.rsaPrivateKey && (
              <span className="text-emerald-500 ml-2">(Currently configured and encrypted)</span>
            )}
          </label>
          <textarea
            disabled={!canWrite}
            value={formData.rsaPrivateKey}
            onChange={(e) => setFormData({ ...formData, rsaPrivateKey: e.target.value })}
            className="input w-full text-xs font-mono h-24 resize-none"
            placeholder={paywayData?.rsaPublicKey ? "Leave blank to keep existing key..." : "-----BEGIN RSA PRIVATE KEY-----..."}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Private keys are never sent back to the browser. Entering a new key will overwrite the existing one.
          </p>
        </div>

        {canWrite && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="text-[11px] text-muted-foreground">
              A test $1.00 transaction will be simulated to verify keys upon saving.
            </div>
            <div className="flex items-center gap-3">
              {savedSuccess && (
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Verified & Saved
                </div>
              )}
              <button
                type="submit"
                disabled={mutation.isPending}
                className="btn px-4 py-2"
              >
                <Save className="w-4 h-4 mr-2 inline-block" />
                {mutation.isPending ? 'Verifying...' : 'Save PayWay Config'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
