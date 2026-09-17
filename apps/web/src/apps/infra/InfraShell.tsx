import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
  Menu,
  X,
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

  // ── Mobile navigation drawer ────────────────────────────────────────────────
  // The sidebar was a hard w-64 with no responsive class: on a 375px phone it
  // took 68% of the viewport and left main content 55px wide after padding.
  // Below lg it is now an off-canvas drawer.
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Tapping a destination should reveal it, not leave the drawer covering it.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Escape closes, and body scroll is locked while the overlay is up so the
  // page behind does not scroll under the user's finger.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

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
    `w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
    }`;

  // Shared by the static sidebar and the mobile drawer so the two can never
  // drift apart.
  const navContent = (
    <>
      <nav className="space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="space-y-0.5">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              {section.label}
            </p>
            {section.items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={navCls} end>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="rounded-lg border border-border bg-accent/30 p-3 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Node</span>
          <span className="font-mono text-foreground truncate">CAMTECH-EDGE-01</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Gateway</span>
          <span className="font-mono text-primary">:4000</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Transport</span>
          <span className="font-mono text-emerald-500 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> TLS 1.3
          </span>
        </div>
      </div>
    </>
  );

  // Every hook above has now run, so branching the output here is safe.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Break-Glass banner ──────────────────────────────────────────────────
          Stays on screen at every width: §36 requires critical alerts to survive
          the mobile layout. Wraps instead of forcing horizontal overflow. */}
      {bgSession?.active && (
        <div className="sticky top-0 z-50 bg-destructive text-destructive-foreground px-3 sm:px-4 py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Flame className="w-4 h-4 shrink-0 mt-px" />
            <span className="font-semibold">
              Break-glass session active — guardrails bypassed, all actions logged.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0 pl-6 sm:pl-0">
            <span className="font-mono opacity-80">expires in 20 min</span>
            <button
              onClick={() => setBgSession(null)}
              className="px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 transition-colors"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur px-3 sm:px-5 flex items-center gap-3 sticky top-0 z-40 shrink-0">
        {/* Drawer trigger — the only way to reach navigation below lg. */}
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={navOpen}
          className="lg:hidden -ml-1 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-foreground truncate leading-tight">
              Infra &amp; Security
            </h1>
            {/* Secondary context is the first thing to go on a narrow screen. */}
            <p className="hidden sm:block text-[11px] text-muted-foreground font-mono leading-tight">
              infra.camtech.cam
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Clocks are desk furniture — dropped below xl rather than crowding. */}
        <div className="hidden xl:flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
          <span>{utcTime || '--:--:-- UTC'}</span>
          <span className="h-3 w-px bg-border" />
          <span>{localTime || '--:--:--'}</span>
        </div>

        {/* Live/degraded state must survive to phone width: it tells the
            operator whether what they are reading is current. */}
        {sseConnected ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-500 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="hidden sm:inline">Live</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-500 shrink-0">
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">Reconnecting</span>
          </span>
        )}

        <button
          id="infra-break-glass-btn"
          onClick={() => setBgOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-destructive hover:bg-destructive/10 border border-destructive/30 transition-colors shrink-0"
        >
          <Flame className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Break-glass</span>
        </button>

        <span className="hidden lg:inline text-[12px] text-muted-foreground truncate max-w-[12ch]">
          {user.name}
        </span>

        <button
          onClick={() => { clear(); navigate('/login'); }}
          aria-label="Sign out"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Static sidebar, desktop only. */}
        <aside className="hidden lg:flex w-60 shrink-0 border-r border-border bg-card/40 flex-col justify-between gap-4 p-3 overflow-y-auto">
          {navContent}
        </aside>

        {/* Mobile drawer. Rendered only while open so it cannot trap focus or
            intercept taps when closed. */}
        {navOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setNavOpen(false)}
              aria-hidden="true"
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="relative w-[17rem] max-w-[85vw] h-full bg-card border-r border-border flex flex-col justify-between gap-4 p-3 overflow-y-auto shadow-xl animate-in slide-in-from-left duration-200"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Navigation
                  </span>
                  <button
                    type="button"
                    onClick={() => setNavOpen(false)}
                    aria-label="Close navigation menu"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {navContent}
              </div>
            </aside>
          </div>
        )}

        {/* Padding scales with the viewport — 32px on a phone wasted a quarter
            of the usable width. min-w-0 lets wide tables scroll inside instead
            of stretching the page. */}
        <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-5 lg:p-7">
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
