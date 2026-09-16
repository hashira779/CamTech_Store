'use client';

/**
 * Per-user passkey management.
 *
 * Self-contained so the other staff apps can drop it in unchanged — they share
 * the same relying party (camtech.cam), so a passkey registered here already
 * works on pos, delivery, hr and ceo.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import {
  createPasskeyCredential,
  isPasskeySupported,
  isPlatformAuthenticatorAvailable,
  PasskeyCancelledError,
} from '@/lib/passkey';
import { Fingerprint, Plus, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
}

export function PasskeyManager() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [supported, setSupported] = useState(false);
  const [hasPlatformAuthenticator, setHasPlatformAuthenticator] = useState(false);

  useEffect(() => {
    setSupported(isPasskeySupported());
    isPlatformAuthenticatorAvailable().then(setHasPlatformAuthenticator);
  }, []);

  const { data: passkeys = [], isLoading } = useQuery({
    queryKey: ['myPasskeys'],
    queryFn: () => api.listPasskeys(token!),
    enabled: Boolean(token),
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const suggested =
        hasPlatformAuthenticator && typeof navigator !== 'undefined'
          ? 'This device'
          : 'Security key';
      const { handle, options } = await api.passkeyRegisterOptions(token!, suggested);
      const credential = await createPasskeyCredential(options);
      return api.passkeyRegisterVerify(token!, { handle, credential, name: suggested });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['myPasskeys'] });
      toast.success('Passkey added', {
        description: `'${created.name}' can now sign you in without a password.`,
      });
    },
    onError: (err: unknown) => {
      if (err instanceof PasskeyCancelledError) return;
      toast.error('Could not add passkey', {
        description: err instanceof ApiClientError ? err.message : 'Registration failed.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePasskey(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPasskeys'] });
      toast.success('Passkey removed');
    },
    onError: (err: unknown) =>
      toast.error('Could not remove passkey', {
        description: err instanceof ApiClientError ? err.message : 'Deletion failed.',
      }),
  });

  return (
    <div className="card p-5 border-border">
      <div className="flex items-center justify-between gap-2.5 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Fingerprint className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-foreground text-sm">Passkeys</h2>
        </div>
        {supported && (
          <button
            type="button"
            onClick={() => registerMutation.mutate()}
            disabled={registerMutation.isPending}
            className="btn btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1.5 disabled:opacity-60"
          >
            {registerMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            Add passkey
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Sign in with your fingerprint, face or security key instead of a password. Your password
        still works, so you will not be locked out if you lose a device. A passkey added here also
        signs you in to the cashier, delivery, HR and CEO apps.
      </p>

      {!supported ? (
        <div className="text-xs text-muted-foreground rounded-md border border-border bg-accent/20 p-3">
          This browser does not support passkeys.
        </div>
      ) : isLoading ? (
        <div className="text-xs text-muted-foreground">Loading passkeys…</div>
      ) : passkeys.length === 0 ? (
        <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-4 text-center">
          No passkeys yet. Add one to sign in without typing a password.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {passkeys.map((pk) => (
            <div key={pk.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-xs truncate">{pk.name}</span>
                  {pk.backedUp && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      Synced
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  Added {formatDate(pk.createdAt)} · Last used {formatDate(pk.lastUsedAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Remove passkey '${pk.name}'? That device will no longer be able to sign in.`,
                    )
                  ) {
                    deleteMutation.mutate(pk.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="btn btn-secondary py-1 px-2 text-[11px] text-destructive hover:bg-destructive/10 shrink-0 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
