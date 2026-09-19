'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { TableSkeletonRows } from '@/components/page-skeleton';
import { HardDrive, Plus, Server, Cloud, AlertCircle, CheckCircle2, Network, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DOCUMENT_ENTITY_TYPES, DocumentEntityType } from '@mystore/contracts';
import { useState } from 'react';

export default function ProvidersPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [newPolicyEntityType, setNewPolicyEntityType] = useState<DocumentEntityType>(DOCUMENT_ENTITY_TYPES[0]);
  const [newPolicyProviderId, setNewPolicyProviderId] = useState('');

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['storageProviders'],
    queryFn: () => api.listStorageProviders(token!),
    enabled: Boolean(token),
  });

  const { data: policies = [], isLoading: isLoadingPolicies } = useQuery({
    queryKey: ['storagePolicies'],
    queryFn: () => api.listStoragePolicies(token!),
    enabled: Boolean(token),
  });

  const createPolicyMutation = useMutation({
    mutationFn: () => api.createStoragePolicy(token!, {
      name: `Route ${newPolicyEntityType}`,
      entityType: newPolicyEntityType,
      providerId: newPolicyProviderId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storagePolicies'] });
      setIsPolicyModalOpen(false);
      setNewPolicyProviderId('');
    },
    onError: (err: any) => alert(err.message || 'Failed to create policy')
  });

  const deletePolicyMutation = useMutation({
    mutationFn: (id: string) => api.deleteStoragePolicy(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storagePolicies'] }),
    onError: (err: any) => alert(err.message || 'Failed to delete policy')
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

        {/* --- Storage Routing Policies --- */}
        <div className="flex justify-between items-end mt-8 mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              Entity Routing Policies
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically route specific types of uploads to designated storage providers.
            </p>
          </div>
          <button
            onClick={() => setIsPolicyModalOpen(true)}
            className="btn flex items-center gap-2 text-xs py-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Routing Rule
          </button>
        </div>

        <div className="card border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Destination Provider</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadingPolicies ? (
                  <TableSkeletonRows rows={2} cols={3} />
                ) : policies.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                      No routing rules defined. All uploads will go to the default provider.
                    </td>
                  </tr>
                ) : (
                  policies.map((policy: any) => {
                    const provider = providers.find((p: any) => p.id === policy.providerId);
                    return (
                      <tr key={policy.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            {policy.entityType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {provider ? `${provider.name} (${provider.type})` : <span className="text-rose-400">Unknown Provider</span>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm('Delete this routing policy?')) {
                                deletePolicyMutation.mutate(policy.id);
                              }
                            }}
                            className="p-1.5 hover:bg-rose-500/20 rounded text-rose-400"
                            title="Remove Rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Policy Modal */}
        {isPolicyModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="card max-w-sm w-full p-6 border-border shadow-md bg-card">
              <div className="flex justify-between items-center pb-3 border-b border-border mb-4">
                <h3 className="text-base font-bold text-foreground">New Routing Rule</h3>
                <button
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="p-1 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">When uploading a...</label>
                  <select 
                    className="input w-full"
                    value={newPolicyEntityType}
                    onChange={(e) => setNewPolicyEntityType(e.target.value as DocumentEntityType)}
                  >
                    {DOCUMENT_ENTITY_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Route it to...</label>
                  <select 
                    className="input w-full"
                    value={newPolicyProviderId}
                    onChange={(e) => setNewPolicyProviderId(e.target.value)}
                  >
                    <option value="" disabled>Select Provider</option>
                    {providers.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button onClick={() => setIsPolicyModalOpen(false)} className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground">Cancel</button>
                  <button 
                    onClick={() => createPolicyMutation.mutate()}
                    disabled={!newPolicyProviderId || createPolicyMutation.isPending}
                    className="btn px-4 py-1.5 font-bold"
                  >
                    Save Rule
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
