import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Save, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PlatformSetting {
  key: string;
  secret: boolean;
  source: 'console' | 'environment' | 'unset';
  configured: boolean;
  value?: string;
  updatedAt?: string | null;
}

interface PlatformSettings {
  vaultReady: boolean;
  settings: PlatformSetting[];
}

const FIELD_GROUPS: { title: string; description: string; fields: { key: string; label: string }[] }[] = [
  {
    title: 'Firebase (main sign-in)',
    description: 'From Firebase console, Project settings, Your apps. The store picks these up without a rebuild.',
    fields: [
      { key: 'FIREBASE_API_KEY', label: 'API key' },
      { key: 'FIREBASE_AUTH_DOMAIN', label: 'Auth domain' },
      { key: 'FIREBASE_PROJECT_ID', label: 'Project ID' },
      { key: 'FIREBASE_STORAGE_BUCKET', label: 'Storage bucket' },
      { key: 'FIREBASE_MESSAGING_SENDER_ID', label: 'Messaging sender ID' },
      { key: 'FIREBASE_APP_ID', label: 'App ID' },
      { key: 'FIREBASE_MEASUREMENT_ID', label: 'Measurement ID' },
    ],
  },
  {
    title: 'Supabase (fallback)',
    description: 'Used only if Firebase is unavailable. Needed for the backend to verify Supabase sign-ins.',
    fields: [
      { key: 'SUPABASE_URL', label: 'Project URL' },
      { key: 'SUPABASE_JWT_SECRET', label: 'JWT secret' },
    ],
  },
];

const SOURCE_LABELS: Record<PlatformSetting['source'], string> = {
  console: 'Saved here',
  environment: 'From server .env',
  unset: 'Not set',
};

const SOURCE_STYLES: Record<PlatformSetting['source'], string> = {
  console: 'bg-success/10 text-success',
  environment: 'bg-info/10 text-info',
  unset: 'bg-warning/10 text-warning',
};

export function SignInSetupView() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['infra-platform-settings'],
    queryFn: () => apiClient.get<PlatformSettings>('/infra/platform-settings'),
  });
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft({});
  }, [data]);

  const byKey = new Map((data?.settings ?? []).map((setting) => [setting.key, setting]));

  const changes = Object.fromEntries(
    Object.entries(draft).filter(([key, value]) => {
      const setting = byKey.get(key);
      const trimmed = value.trim();
      return setting?.secret ? trimmed !== '' : trimmed !== (setting?.value ?? '');
    }).map(([key, value]) => [key, value.trim() === '' ? null : value.trim()])
  );
  const changeCount = Object.keys(changes).length;

  const save = useMutation({
    mutationFn: (values: Record<string, string | null>) =>
      apiClient.put<PlatformSettings>('/infra/platform-settings', { values }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['infra-platform-settings'], updated);
      toast.success('Saved. Sign-in uses the new settings within 30 seconds.');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save the settings.'),
  });

  const clearOverride = useMutation({
    mutationFn: (key: string) =>
      apiClient.put<PlatformSettings>('/infra/platform-settings', { values: { [key]: null } }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['infra-platform-settings'], updated);
      toast.success('Removed. This setting now comes from the server .env.');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not remove the setting.'),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading sign-in settings...</p>;
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-destructive">
        {(error as Error)?.message || 'Sign-in settings could not be loaded.'}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <KeyRound className="h-5 w-5 text-primary" />
          Sign-in Setup
        </h1>
        <p className="text-sm text-muted-foreground">
          Storefront customer sign-in. Each save is recorded in the audit log, without the values.
        </p>
      </header>

      {!data.vaultReady && (
        <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
          The key vault isn't configured on this server, so the JWT secret can't be saved here.
        </div>
      )}

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (changeCount > 0) save.mutate(changes);
        }}
      >
        {FIELD_GROUPS.map((group) => (
          <section key={group.title} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div>
              <h2 className="font-semibold text-foreground">{group.title}</h2>
              <p className="text-xs text-muted-foreground">{group.description}</p>
            </div>

            {group.fields.map(({ key, label }) => {
              const setting = byKey.get(key);
              if (!setting) return null;
              const id = `setting-${key}`;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
                    <span className="flex items-center gap-2">
                      {setting.source === 'console' && (
                        <button
                          type="button"
                          onClick={() => clearOverride.mutate(key)}
                          disabled={clearOverride.isPending}
                          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Remove
                        </button>
                      )}
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${SOURCE_STYLES[setting.source]}`}>
                        {SOURCE_LABELS[setting.source]}
                      </span>
                    </span>
                  </div>
                  <Input
                    id={id}
                    type={setting.secret ? 'password' : 'text'}
                    autoComplete="off"
                    spellCheck={false}
                    className="figure"
                    disabled={setting.secret && !data.vaultReady}
                    placeholder={setting.secret && setting.configured ? 'Saved. Enter a new value to replace it.' : ''}
                    value={draft[key] ?? (setting.secret ? '' : setting.value ?? '')}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </div>
              );
            })}
          </section>
        ))}

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            JWT secret, database passwords and the vault key can only be changed on the server.
          </p>
          <Button type="submit" disabled={changeCount === 0 || save.isPending} className="shrink-0 gap-2">
            <Save className="h-4 w-4" />
            {save.isPending ? 'Saving...' : changeCount > 0 ? `Save ${changeCount} change${changeCount > 1 ? 's' : ''}` : 'Save'}
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground">
        Also add your store's domains under Authorized domains in the Firebase console. That setting lives at Google.
      </p>
    </div>
  );
}
