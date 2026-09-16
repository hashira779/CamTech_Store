import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Activity, 
  ShieldAlert, 
  Server, 
  Network, 
  Flame, 
  Radio, 
  Terminal, 
  AlertOctagon, 
  CheckCircle2, 
  WifiOff,
} from 'lucide-react';
import { 
  InfraOverviewDTO, 
  InfraServiceNodeDTO, 
  InfraTopologyGraphDTO, 
  ApiTrafficRequestDTO, 
  SecurityEventDTO, 
  ActiveBanDTO, 
  IncidentDTO, 
  IncidentSeverity 
} from '@mystore/contracts';
import { apiClient } from '../../../lib/api-client';
import { OverviewView } from './views/OverviewView';
import { ServicesView } from './views/ServicesView';
import { ApiTrafficView } from './views/ApiTrafficView';
import { SecurityThreatView } from './views/SecurityThreatView';
import { IncidentsView } from './views/IncidentsView';
import { AuditView } from './views/AuditView';
import { TopologyGraph } from './components/TopologyGraph';

type ActiveTab = 'overview' | 'services' | 'topology' | 'traffic' | 'threats' | 'incidents' | 'audit';

export function InfraControlApp() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [breakGlassConfirmation, setBreakGlassConfirmation] = useState('');
  const [breakGlassError, setBreakGlassError] = useState('');
  const [isActivatingBreakGlass, setIsActivatingBreakGlass] = useState(false);
  const [activeBreakGlassSession, setActiveBreakGlassSession] = useState<{ active: boolean; expiresAt?: string } | null>(null);

  // Clocks
  const [utcTime, setUtcTime] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + ' UTC');
      setLocalTime(now.toLocaleTimeString());
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  // Data Queries
  const { data: overview } = useQuery<InfraOverviewDTO>({
    queryKey: ['infra-overview'],
    queryFn: () => apiClient.get<InfraOverviewDTO>('/api/v1/infra/overview'),
    refetchInterval: 10000,
  });

  const { data: services = [] } = useQuery<InfraServiceNodeDTO[]>({
    queryKey: ['infra-services'],
    queryFn: () => apiClient.get<InfraServiceNodeDTO[]>('/api/v1/infra/services'),
    refetchInterval: 10000,
  });

  const { data: topology } = useQuery<InfraTopologyGraphDTO>({
    queryKey: ['infra-topology'],
    queryFn: () => apiClient.get<InfraTopologyGraphDTO>('/api/v1/infra/topology'),
    refetchInterval: 30000,
  });

  const { data: traffic = [] } = useQuery<ApiTrafficRequestDTO[]>({
    queryKey: ['infra-traffic'],
    queryFn: () => apiClient.get<ApiTrafficRequestDTO[]>('/api/v1/infra/traffic'),
    refetchInterval: 5000,
  });

  const { data: securityEvents = [] } = useQuery<SecurityEventDTO[]>({
    queryKey: ['infra-security-events'],
    queryFn: () => apiClient.get<SecurityEventDTO[]>('/api/v1/infra/security/events'),
    refetchInterval: 10000,
  });

  const { data: bansData } = useQuery<{ total: number; bans: ActiveBanDTO[] }>({
    queryKey: ['infra-bans'],
    queryFn: () => apiClient.get<{ total: number; bans: ActiveBanDTO[] }>('/api/v1/infra/security/bans'),
    refetchInterval: 10000,
  });

  const { data: incidents = [] } = useQuery<IncidentDTO[]>({
    queryKey: ['infra-incidents'],
    queryFn: () => apiClient.get<IncidentDTO[]>('/api/v1/infra/incidents'),
    refetchInterval: 10000,
  });

  // Action Handlers
  const handleBanIp = async (ip: string, reason: string, durationHours?: number) => {
    await apiClient.post('/api/v1/infra/security/bans', { ip, reason, durationHours });
    queryClient.invalidateQueries({ queryKey: ['infra-bans'] });
    queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
  };

  const handleUnbanIp = async (ip: string) => {
    await apiClient.delete(`/api/v1/infra/security/bans/${encodeURIComponent(ip)}`);
    queryClient.invalidateQueries({ queryKey: ['infra-bans'] });
    queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
  };

  const handleCreateIncident = async (title: string, severity: IncidentSeverity, description: string, affectedServices: string[]) => {
    await apiClient.post('/api/v1/infra/incidents', {
      title,
      severity,
      description,
      affectedServices,
    });
    queryClient.invalidateQueries({ queryKey: ['infra-incidents'] });
    queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
  };

  // Real-time SSE Stream Listener
  useEffect(() => {
    const baseUrl = apiClient.baseUrl || '';
    const sseUrl = `${baseUrl}/api/v1/infra/events/stream`;
    
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'SECURITY_EVENT') {
            queryClient.invalidateQueries({ queryKey: ['infra-security-events'] });
            queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
          } else if (payload.event === 'INCIDENT') {
            queryClient.invalidateQueries({ queryKey: ['infra-incidents'] });
            queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
          } else if (payload.event === 'API_TRAFFIC') {
            queryClient.invalidateQueries({ queryKey: ['infra-traffic'] });
          }
        } catch {
          // heartbeat keepalive
        }
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [queryClient]);

  const handleBreakGlassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBreakGlassError('');
    if (breakGlassConfirmation !== 'I CONFIRM BREAK GLASS') {
      setBreakGlassError("Must type exactly: 'I CONFIRM BREAK GLASS'");
      return;
    }
    if (!breakGlassReason.trim()) {
      setBreakGlassError('Reason for emergency activation is required.');
      return;
    }

    try {
      setIsActivatingBreakGlass(true);
      const res = await apiClient.post<{ message: string; session: any }>('/api/v1/infra/break-glass', {
        reason: breakGlassReason.trim(),
        confirmation: breakGlassConfirmation,
      });

      setActiveBreakGlassSession({
        active: true,
        expiresAt: res.session?.expires_at,
      });
      setBreakGlassOpen(false);
      setBreakGlassReason('');
      setBreakGlassConfirmation('');
      queryClient.invalidateQueries({ queryKey: ['infra-audit'] });
      queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
    } catch (err: any) {
      setBreakGlassError(err.message || 'Failed to activate break glass protocol.');
    } finally {
      setIsActivatingBreakGlass(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Break-Glass Global Banner */}
      {activeBreakGlassSession?.active && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-lg shadow-rose-950 animate-pulse sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-300" />
            <span>CRITICAL EMERGENCY: Active Break-Glass Session Engaged. All system guardrails bypassed. Full immutable logging active.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-rose-100">EXPIRATION: 20 MINUTES FROM ACTIVATION</span>
            <button 
              onClick={() => setActiveBreakGlassSession(null)}
              className="px-2 py-0.5 bg-rose-800 hover:bg-rose-900 rounded text-rose-100 transition-colors"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-wider uppercase text-slate-100">
                CamTech Infra & Security Control
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                NOC/SOC v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Enterprise Mission Control · infra.camtech.cam
            </p>
          </div>
        </div>

        {/* Center Indicators */}
        <div className="hidden md:flex items-center gap-6 font-mono text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">UTC:</span>
            <span className="text-slate-200 font-semibold">{utcTime || '--:--:-- UTC'}</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className="text-slate-500">LOCAL:</span>
            <span className="text-slate-200 font-semibold">{localTime || '--:--:--'}</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            {sseConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                TELEMETRY LIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <WifiOff className="w-3 h-3 text-amber-400" />
                POLLING (SSE RETRY)
              </span>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBreakGlassOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:border-rose-500 transition-all shadow-sm shadow-rose-950/50"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
            Break-Glass
          </button>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-slate-800/80 bg-slate-950 flex flex-col justify-between p-4 shrink-0">
          <nav className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Operations & Observability
            </div>

            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Command Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'services'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Microservices Mesh</span>
            </button>

            <button
              onClick={() => setActiveTab('topology')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'topology'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Network className="w-4 h-4" />
              <span>Interactive Topology</span>
            </button>

            <button
              onClick={() => setActiveTab('traffic')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'traffic'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Live Edge Traffic</span>
            </button>

            <div className="pt-4 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Security & Compliance
            </div>

            <button
              onClick={() => setActiveTab('threats')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'threats'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Security Threat Center</span>
            </button>

            <button
              onClick={() => setActiveTab('incidents')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'incidents'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Incidents & Deploys</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'audit'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Immutable Audit Logs</span>
            </button>
          </nav>

          {/* System Environment Badge */}
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-mono">NODE:</span>
              <span className="text-slate-300 font-mono font-medium">CAMTECH-EDGE-01</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-mono">GATEWAY:</span>
              <span className="text-cyan-400 font-mono font-medium">PORT 4000</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-mono">ENCRYPT:</span>
              <span className="text-emerald-400 font-mono font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> TLS 1.3 / mTLS
              </span>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'overview' && (
              <OverviewView 
                overview={overview}
                topology={topology}
                traffic={traffic}
                incidents={incidents}
                onSelectService={(id) => setActiveTab('services')}
                onNavigateTab={(tab) => setActiveTab(tab as ActiveTab)}
              />
            )}
            {activeTab === 'services' && (
              <ServicesView 
                services={services}
              />
            )}
            {activeTab === 'topology' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">Live Service Mesh & Topology</h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Interactive real-time node dependency graph powered by React XYFlow
                    </p>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-400">
                    Auto-Discovered Architecture
                  </span>
                </div>
                <div className="h-[650px] bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
                  <TopologyGraph />
                </div>
              </div>
            )}
            {activeTab === 'traffic' && (
              <ApiTrafficView 
                requests={traffic}
              />
            )}
            {activeTab === 'threats' && (
              <SecurityThreatView 
                events={securityEvents}
                bans={bansData?.bans || []}
                onBanIp={handleBanIp}
                onUnbanIp={handleUnbanIp}
              />
            )}
            {activeTab === 'incidents' && (
              <IncidentsView 
                incidents={incidents}
                onCreateIncident={handleCreateIncident}
              />
            )}
            {activeTab === 'audit' && (
              <AuditView />
            )}
          </div>
        </main>
      </div>

      {/* Break-Glass Emergency Modal */}
      {breakGlassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-950 border-2 border-rose-600 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl shadow-rose-950/60 relative">
            <div className="flex items-center gap-3 border-b border-rose-900/60 pb-4">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/40">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">
                  Emergency Break-Glass Protocol
                </h3>
                <p className="text-xs text-rose-300 font-medium">
                  20-Minute Elevated System Access (§248 Defensive Compliance)
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-950/40 border border-rose-700/50 rounded-xl text-xs text-rose-200 space-y-2">
              <p className="font-bold text-rose-100 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                CRITICAL WARNING: UNRESTRICTED ACCESS
              </p>
              <p>
                Activating break-glass grants emergency elevated control across all platform services for <strong>20 minutes</strong>. 
                Every single request, query, and configuration modification will be recorded into the immutable SHA-256 audit ledger.
              </p>
              <p className="text-slate-400">
                Security administrators and engineering leads will receive instant incident notices.
              </p>
            </div>

            <form onSubmit={handleBreakGlassSubmit} className="space-y-4">
              {breakGlassError && (
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-lg text-xs font-semibold text-rose-300">
                  {breakGlassError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Incident Justification / Operational Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  placeholder="e.g. Sev-1 outage on Gateway reverse proxy requiring live hot-patching..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Confirmation Phrase
                </label>
                <p className="text-[11px] text-slate-400">
                  Type <span className="font-mono text-rose-400 font-bold">I CONFIRM BREAK GLASS</span> below to proceed:
                </p>
                <input
                  type="text"
                  required
                  value={breakGlassConfirmation}
                  onChange={(e) => setBreakGlassConfirmation(e.target.value)}
                  placeholder="I CONFIRM BREAK GLASS"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBreakGlassOpen(false)}
                  disabled={isActivatingBreakGlass}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActivatingBreakGlass || breakGlassConfirmation !== 'I CONFIRM BREAK GLASS'}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-rose-950/80"
                >
                  {isActivatingBreakGlass ? 'Activating Protocol...' : 'Authorize Break-Glass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InfraControlApp;
