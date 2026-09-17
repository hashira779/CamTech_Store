import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Server,
  Network,
  Radio,
  ShieldAlert,
  AlertOctagon,
  Terminal,
  Flame,
  WifiOff,
  CheckCircle2,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { IncidentSeverity } from '@mystore/contracts';

// ─── Break-Glass state (client-only, global for the infra shell lifetime) ────
interface BreakGlassSession {
  active: boolean;
  expiresAt?: string;
}

// ─── Sidebar navigation items ────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Operations & Observability',
    items: [
      { to: '/infra/overview',  icon: Activity,     label: 'Command Overview' },
      { to: '/infra/services',  icon: Server,        label: 'Microservices Mesh' },
      { to: '/infra/topology',  icon: Network,       label: 'Interactive Topology' },
      { to: '/infra/traffic',   icon: Radio,         label: 'Live Edge Traffic' },
    ],
  },
  {
    label: 'Security & Compliance',
    items: [
      { to: '/infra/threats',   icon: ShieldAlert,   label: 'Security Threat Center' },
      { to: '/infra/incidents', icon: AlertOctagon,  label: 'Incidents & Deploys' },
      { to: '/infra/audit',     icon: Terminal,      label: 'Immutable Audit Logs' },
    ],
  },
];

// ─── Shell ────────────────────────────────────────────────────────────────────
export function InfraShell() {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // NOTE: the unauthenticated redirect deliberately lives at the BOTTOM of this
  // component, after every hook. Returning early here skipped the 13 hooks
  // below, so the moment `user` went from set to null — a 403 cascade, or
  // simply clicking Sign out, which calls clear() — React saw a different
  // number of hooks between renders and threw "Rendered fewer hooks than
  // expected" (#300), white-screening the console instead of navigating.
  // Hooks must run unconditionally; only the render output may branch.

  // ── Clocks ──────────────────────────────────────────────────────────────────
  const [utcTime, setUtcTime] = useState('');
  const [localTime, setLocalTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + ' UTC');
      setLocalTime(now.toLocaleTimeString());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── SSE real-time stream ─────────────────────────────────────────────────────
  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    // Hook runs unconditionally (see the note above); the body is what skips
    // work when there is nobody signed in to stream to.
    if (!user) {
      setSseConnected(false);
      return;
    }
    const baseUrl = (apiClient as any).baseUrl ?? '';
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${baseUrl}/api/v1/infra/events/stream`);
      es.onopen = () => setSseConnected(true);
      es.onerror = () => setSseConnected(false);
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          const invalidate = (keys: string[][]) =>
            keys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
          if (payload.event === 'SECURITY_EVENT') {
            invalidate([['infra-security-events'], ['infra-overview']]);
          } else if (payload.event === 'INCIDENT') {
            invalidate([['infra-incidents'], ['infra-overview']]);
          } else if (payload.event === 'API_TRAFFIC') {
            invalidate([['infra-traffic']]);
          }
        } catch {
          // heartbeat keepalive — ignore parse errors
        }
      };
    } catch {
      setSseConnected(false);
    }
    return () => es?.close();
    // `user` is a dependency so the stream opens on sign-in and closes on
    // sign-out rather than leaking an EventSource across sessions.
  }, [queryClient, user]);

  // ── Break-Glass modal state ──────────────────────────────────────────────────
  const [bgOpen, setBgOpen] = useState(false);
  const [bgReason, setBgReason] = useState('');
  const [bgConfirm, setBgConfirm] = useState('');
  const [bgError, setBgError] = useState('');
  const [bgLoading, setBgLoading] = useState(false);
  const [bgSession, setBgSession] = useState<BreakGlassSession | null>(null);

  const handleBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    setBgError('');
    if (bgConfirm !== 'I CONFIRM BREAK GLASS') {
      setBgError("Must type exactly: 'I CONFIRM BREAK GLASS'");
      return;
    }
    if (!bgReason.trim()) {
      setBgError('Operational reason is required.');
      return;
    }
    try {
      setBgLoading(true);
      const res = await apiClient.post<{ message: string; session: { expires_at?: string } }>(
        '/api/v1/infra/break-glass',
        { reason: bgReason.trim(), confirmation: bgConfirm },
      );
      setBgSession({ active: true, expiresAt: res.session?.expires_at });
      setBgOpen(false);
      setBgReason('');
      setBgConfirm('');
      queryClient.invalidateQueries({ queryKey: ['infra-audit'] });
      queryClient.invalidateQueries({ queryKey: ['infra-overview'] });
    } catch (err: any) {
      setBgError(err?.message ?? 'Failed to activate break-glass protocol.');
    } finally {
      setBgLoading(false);
    }
  };

  // ── Nav link class helper ────────────────────────────────────────────────────
  const navCls = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
      isActive
        ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-l-2 border-transparent'
    }`;

  // Every hook above has now run, so branching the output here is safe.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* ── Break-Glass Active Banner ─────────────────────────────────────────── */}
      {bgSession?.active && (
        <div className="sticky top-0 z-50 bg-rose-600 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-lg shadow-rose-950 animate-pulse">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              CRITICAL EMERGENCY: Active Break-Glass Session. All guardrails bypassed. Full immutable
              logging active.
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="font-mono text-rose-100">EXPIRES: 20 MIN FROM ACTIVATION</span>
            <button
              onClick={() => setBgSession(null)}
              className="px-2 py-0.5 bg-rose-800 hover:bg-rose-900 rounded text-rose-100 transition-colors text-[11px]"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40 shrink-0">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30 shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-wider uppercase text-slate-100">
                CamTech Infra &amp; Security Control
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

        {/* Center — clocks + SSE status */}
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
          {sseConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              TELEMETRY LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <WifiOff className="w-3 h-3" />
              POLLING (SSE RETRY)
            </span>
          )}
        </div>

        {/* Right — break-glass + sign out */}
        <div className="flex items-center gap-3">
          <button
            id="infra-break-glass-btn"
            onClick={() => setBgOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:border-rose-500 transition-all shadow-sm shadow-rose-950/50"
          >
            <Flame className="w-3.5 h-3.5 animate-bounce" />
            Break-Glass
          </button>
          <div className="h-5 w-px bg-slate-800" />
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>{user.name}</span>
          </div>
          <button
            onClick={() => { clear(); navigate('/login'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Body: sidebar + main ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-slate-800/80 bg-slate-950 flex flex-col justify-between p-4 shrink-0">
          <nav className="space-y-1">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <p className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  {section.label}
                </p>
                {section.items.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} className={navCls} end>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* System environment badge */}
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

        {/* Main content — React Router Outlet renders the active page */}
        <main className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Break-Glass Modal ─────────────────────────────────────────────────── */}
      {bgOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bg-modal-title"
        >
          <div className="bg-slate-950 border-2 border-rose-600 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl shadow-rose-950/60">
            <div className="flex items-center gap-3 border-b border-rose-900/60 pb-4">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/40">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 id="bg-modal-title" className="text-lg font-black text-white uppercase tracking-wider">
                  Emergency Break-Glass Protocol
                </h2>
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
                Activating break-glass grants emergency elevated control across all platform services
                for <strong>20 minutes</strong>. Every request, query, and configuration modification
                will be recorded into the immutable SHA-256 audit ledger.
              </p>
              <p className="text-slate-400">
                Security administrators and engineering leads will receive instant incident notices.
              </p>
            </div>

            <form onSubmit={handleBreakGlass} className="space-y-4">
              {bgError && (
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-lg text-xs font-semibold text-rose-300">
                  {bgError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block" htmlFor="bg-reason">
                  Incident Justification / Operational Reason{' '}
                  <span className="text-rose-400">*</span>
                </label>
                <textarea
                  id="bg-reason"
                  required
                  rows={3}
                  value={bgReason}
                  onChange={(e) => setBgReason(e.target.value)}
                  placeholder="e.g. Sev-1 outage on Gateway reverse proxy requiring live hot-patching..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block" htmlFor="bg-confirm">
                  Confirmation Phrase
                </label>
                <p className="text-[11px] text-slate-400">
                  Type{' '}
                  <span className="font-mono text-rose-400 font-bold">I CONFIRM BREAK GLASS</span>{' '}
                  below to proceed:
                </p>
                <input
                  id="bg-confirm"
                  type="text"
                  required
                  value={bgConfirm}
                  onChange={(e) => setBgConfirm(e.target.value)}
                  placeholder="I CONFIRM BREAK GLASS"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setBgOpen(false); setBgError(''); setBgReason(''); setBgConfirm(''); }}
                  disabled={bgLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bgLoading || bgConfirm !== 'I CONFIRM BREAK GLASS'}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-rose-950/80"
                >
                  {bgLoading ? 'Activating Protocol…' : 'Authorize Break-Glass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InfraShell;
