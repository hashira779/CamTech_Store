'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { TableSkeletonRows } from '@/components/page-skeleton';
import { HardDrive, Plus, Server, Cloud, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProvidersPage() {
  const { token } = useAuth();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['storageProviders'],
    queryFn: () => api.listStorageProviders(token!),
    enabled: Boolean(token),
  });

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <HardDrive className="w-6 h-6 text-primary" />
              Storage Providers
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manage connected storage backends and routing defaults
            </p>
          </div>
          <Link
            to="/storage/providers/add"
            className="btn flex items-center gap-2 text-sm shadow-md"
          >
            <Plus className="w-4 h-4" />
            Connect Provider
          </Link>
        </div>

        <div className="card border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Default Routing</th>
                  <th className="py-3 px-4">Added On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <TableSkeletonRows rows={3} cols={5} />
                ) : providers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No storage providers configured. Connect one to start storing files.
                    </td>
                  </tr>
                ) : (
                  providers.map((provider: any) => (
                    <tr key={provider.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded bg-muted/30 border border-border">
                            {provider.type === 'GOOGLE_DRIVE' ? (
                              <Cloud className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Server className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                          <p className="font-semibold text-foreground">{provider.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-muted-foreground">
                        {provider.type}
                      </td>
                      <td className="py-3 px-4">
                        {provider.status === 'CONNECTED' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-max">
                            <CheckCircle2 className="w-3 h-3" /> Connected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-max">
                            <AlertCircle className="w-3 h-3" /> {provider.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {provider.isDefault ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            DEFAULT
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(provider.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </EnterpriseShell>
  );
}
