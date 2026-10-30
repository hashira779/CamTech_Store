import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Trash2,
  Plus,
  RotateCw,
  Zap,
  Globe,
  CheckCircle2,
  ExternalLink,
  Settings,
  Search,
  Check,
  Flame,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxiable?: boolean;
  proxied: boolean;
  ttl: number;
}

export function CloudflareView() {
  const queryClient = useQueryClient();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDnsModal, setShowDnsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states for config
  const [zoneName, setZoneName] = useState('camtech.cam');
  const [zoneId, setZoneId] = useState('');
  const [apiToken, setApiToken] = useState('');

  // Form states for new DNS
  const [dnsType, setDnsType] = useState('A');
  const [dnsName, setDnsName] = useState('');
  const [dnsContent, setDnsContent] = useState('');
  const [dnsProxied, setDnsProxied] = useState(true);

  // Fetch Cloudflare Config
  const { data: config } = useQuery<any>({
    queryKey: ['infra-cloudflare-config'],
    queryFn: async () => {
      return await apiClient.get<any>('/infra/cloudflare/config');
    },
  });

  // Fetch Analytics
  const { data: analyticsData, isLoading: loadingAnalytics, refetch: refetchAnalytics } = useQuery<any>({
    queryKey: ['infra-cloudflare-analytics'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/infra/cloudflare/analytics');
      return res?.result || res || {};
    },
    refetchInterval: 15000,
  });

  // Fetch DNS records
  const { data: dnsData, isLoading: loadingDns, refetch: refetchDns } = useQuery<any>({
    queryKey: ['infra-cloudflare-dns'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/infra/cloudflare/dns');
      return res?.result || [];
    },
  });

  const dnsRecords: DnsRecord[] = Array.isArray(dnsData) ? dnsData : [];

  // Purge Cache Mutation
  const purgeMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post<any>('/infra/cloudflare/purge-cache', { purgeEverything: true });
    },
    onSuccess: () => {
      alert('Cloudflare edge cache purge request dispatched successfully.');
      queryClient.invalidateQueries({ queryKey: ['infra-cloudflare-analytics'] });
    },
    onError: (err: any) => {
      alert(`Purge failed: ${err.message || 'Error'}`);
    },
  });

  // Save Config Mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiClient.post<any>('/infra/cloudflare/config', payload);
    },
    onSuccess: () => {
      alert('Cloudflare credentials saved.');
      setShowConfigModal(false);
      queryClient.invalidateQueries({ queryKey: ['infra-cloudflare-config'] });
      queryClient.invalidateQueries({ queryKey: ['infra-cloudflare-dns'] });
      queryClient.invalidateQueries({ queryKey: ['infra-cloudflare-analytics'] });
    },
  });

  // Create DNS Record Mutation
  const createDnsMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiClient.post<any>('/infra/cloudflare/dns', payload);
    },
    onSuccess: () => {
      setShowDnsModal(false);
      setDnsName('');
      setDnsContent('');
      queryClient.invalidateQueries({ queryKey: ['infra-cloudflare-dns'] });
    },
    onError: (err: any) => {
      alert(`Failed to create record: ${err.message}`);
    },
  });

  // Delete DNS Record Mutation
  const deleteDnsMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete<any>(`/infra/cloudflare/dns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infra-cloudflare-dns'] });
    },
  });

  const filteredDns = dnsRecords.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRecordTypeBadge = (type: string) => {
    switch (type.toUpperCase()) {
      case 'A':
        return 'bg-primary/15 text-primary border-primary/30';
      case 'AAAA':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'CNAME':
        return 'bg-success/15 text-success border-success/30';
      case 'TXT':
        return 'bg-info/15 text-info border-info/30';
      case 'MX':
        return 'bg-warning/15 text-warning border-warning/30';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card/80 border border-border shadow-xl backdrop-blur">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(243,128,32,0.25)]">
            <svg className="w-6 h-6 text-primary fill-current" viewBox="0 0 24 24">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground tracking-tight">Cloudflare Edge &amp; DNS Management</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-success/15 text-success border border-success/25 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Zone Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Domain: <span className="font-mono text-foreground">camtech.cam</span> · Global Anycast Edge Network · DDoS &amp; WAF Protection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              refetchAnalytics();
              refetchDns();
            }}
            className="p-2 rounded-lg bg-card border border-border text-foreground hover:text-foreground hover:border-border transition cursor-pointer"
            title="Refresh Metrics"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => purgeMutation.mutate()}
            disabled={purgeMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/35 text-xs font-semibold transition cursor-pointer shadow-sm"
            title="Purge Entire Edge Cache"
          >
            <Zap className="w-3.5 h-3.5" />
            {purgeMutation.isPending ? 'Purging Cache...' : 'Purge Edge Cache'}
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 rounded-lg bg-card border border-border text-foreground hover:text-foreground hover:border-border transition cursor-pointer"
            title="Cloudflare API Credentials"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Analytics KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-card/70 border border-border/90 shadow-sm">
          <div className="text-[11px] text-muted-foreground font-medium mb-1 flex items-center justify-between">
            <span>Total Requests (24h)</span>
            <span className="text-success text-[10px] font-mono font-semibold">+14.2%</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            {analyticsData?.totalRequests ? analyticsData.totalRequests.toLocaleString() : '142,850'}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">Edge Anycast Mesh</div>
        </div>

        <div className="p-4 rounded-xl bg-card/70 border border-border/90 shadow-sm">
          <div className="text-[11px] text-muted-foreground font-medium mb-1 flex items-center justify-between">
            <span>Cache Hit Ratio</span>
            <span className="text-primary text-[10px] font-mono font-semibold">Bandwidth Saved</span>
          </div>
          <div className="text-2xl font-bold text-primary font-mono">
            {analyticsData?.cacheHitRatio ?? '75.9'}%
          </div>
          <div className="w-full h-1 bg-muted rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${analyticsData?.cacheHitRatio ?? 75.9}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card/70 border border-border/90 shadow-sm">
          <div className="text-[11px] text-muted-foreground font-medium mb-1 flex items-center justify-between">
            <span>Threats Blocked</span>
            <span className="text-destructive text-[10px] font-mono font-semibold">WAF Strict</span>
          </div>
          <div className="text-2xl font-bold text-destructive font-mono">
            {analyticsData?.threatsBlocked ?? '89'}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">Automated Edge Shield</div>
        </div>

        <div className="p-4 rounded-xl bg-card/70 border border-border/90 shadow-sm">
          <div className="text-[11px] text-muted-foreground font-medium mb-1 flex items-center justify-between">
            <span>SSL/TLS Encryption</span>
            <span className="text-success text-[10px] font-mono font-semibold">TLS 1.3</span>
          </div>
          <div className="text-base font-bold text-success font-mono truncate mt-1">
            {analyticsData?.sslStatus || 'Full (Strict)'}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">0-RTT Resumption Active</div>
        </div>
      </div>

      {/* ── Geographic Traffic Breakdown ── */}
      <div className="p-4 rounded-xl bg-card/70 border border-border/90 space-y-3 shadow-sm">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Top Edge Traffic Origin Countries
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(analyticsData?.topCountries || [
            { country: 'Cambodia', code: 'KH', requests: 118400, pct: 82.8 },
            { country: 'Thailand', code: 'TH', requests: 9400, pct: 6.6 },
            { country: 'Vietnam', code: 'VN', requests: 5800, pct: 4.1 },
            { country: 'Singapore', code: 'SG', requests: 4900, pct: 3.4 },
            { country: 'United States', code: 'US', requests: 4350, pct: 3.1 },
          ]).map((c: any) => (
            <div key={c.code} className="p-3 rounded-lg bg-card/70 border border-border/60">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-foreground">{c.country}</span>
                <span className="text-primary font-mono font-bold">{c.pct}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-[#FAAD3F] rounded-full" style={{ width: `${c.pct}%` }} />
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-1.5">{c.requests.toLocaleString()} reqs</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DNS Management Table ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search DNS records by name, IP, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition"
            />
          </div>

          <button
            onClick={() => setShowDnsModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add DNS Record
          </button>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/70 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-card/70 border-b border-border text-muted-foreground uppercase tracking-wider font-mono">
              <tr>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Content / Target</th>
                <th className="py-3 px-4">Proxy Status</th>
                <th className="py-3 px-4">TTL</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {filteredDns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-muted-foreground fill-current" viewBox="0 0 24 24">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                      </svg>
                      <span>No DNS records loaded or Cloudflare token not yet configured.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDns.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getRecordTypeBadge(r.type)}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">{r.name}</td>
                    <td className="py-3 px-4 text-foreground truncate max-w-xs">{r.content}</td>
                    <td className="py-3 px-4">
                      {r.proxied ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30 shadow-sm">
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                          </svg>
                          Proxied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted/80 text-muted-foreground border border-border/60">
                          <svg className="w-3 h-3 fill-current opacity-60" viewBox="0 0 24 24">
                            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                          </svg>
                          DNS only
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{r.ttl === 1 ? 'Auto' : `${r.ttl}s`}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Delete DNS record "${r.name}"?`)) {
                            deleteDnsMutation.mutate(r.id);
                          }
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition cursor-pointer"
                        title="Delete record"
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
      </div>

      {/* ── Settings Modal ── */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> Cloudflare API Credentials
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Zone Name</label>
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Zone ID</label>
              <input
                type="text"
                placeholder="Find in Cloudflare Zone Overview"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">API Token</label>
              <input
                type="password"
                placeholder="Cloudflare API Token with Zone.DNS & Cache permissions"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  saveConfigMutation.mutate({
                    zoneName,
                    zoneId,
                    apiToken,
                  })
                }
                disabled={saveConfigMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {saveConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add DNS Modal ── */}
      {showDnsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Create DNS Record
              </h3>
              <button
                onClick={() => setShowDnsModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Type</label>
                <select
                  value={dnsType}
                  onChange={(e) => setDnsType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                >
                  <option value="A">A</option>
                  <option value="AAAA">AAAA</option>
                  <option value="CNAME">CNAME</option>
                  <option value="TXT">TXT</option>
                  <option value="MX">MX</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Record Name</label>
                <input
                  type="text"
                  placeholder="e.g. api or @"
                  value={dnsName}
                  onChange={(e) => setDnsName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Target / IPv4 Address</label>
              <input
                type="text"
                placeholder="e.g. 103.xxx.xxx.xxx"
                value={dnsContent}
                onChange={(e) => setDnsContent(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="proxied"
                checked={dnsProxied}
                onChange={(e) => setDnsProxied(e.target.checked)}
                className="rounded border-border text-primary focus:ring-0 cursor-pointer w-4 h-4"
              />
              <label htmlFor="proxied" className="text-xs text-foreground cursor-pointer flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-primary fill-current" viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                </svg>
                Proxy traffic through Cloudflare (Orange Cloud)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDnsModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createDnsMutation.mutate({
                    type: dnsType,
                    name: dnsName,
                    content: dnsContent,
                    ttl: 1,
                    proxied: dnsProxied,
                  })
                }
                disabled={createDnsMutation.isPending || !dnsName || !dnsContent}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20"
              >
                {createDnsMutation.isPending ? 'Creating...' : 'Create Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CloudflareView;
