import { ChevronRight } from 'lucide-react';

export function EcosystemPanel({ apps, loading }: { apps: any[]; loading: boolean }) {
  return (
    <section className="ds-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">Multi-domain ecosystem</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Micro-frontend registry</p>
        </div>
        <span className="ds-chip bg-sky-500/12 text-sky-400 font-mono shrink-0">{apps.length > 0 ? apps.length : '—'}</span>
      </div>
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-2.5 rounded-xl bg-ink-800 animate-pulse h-12" />)
        ) : apps.length > 0 ? (
          apps.slice(0, 6).map((app: any) => (
            <div
              key={app.id}
              className="p-2.5 rounded-xl border border-line hover:border-line-strong hover:bg-ink-800/60 transition flex items-center justify-between group gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-300 flex items-center justify-center font-bold text-[10px] font-mono shrink-0">
                  {app.subdomain?.slice(0, 3).toUpperCase() || 'APP'}
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-semibold text-white leading-none truncate">{app.name}</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">{app.subdomain}</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition" />
              </span>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">Connecting to registry…</div>
        )}
      </div>
    </section>
  );
}
