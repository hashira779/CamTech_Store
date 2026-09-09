import { useEffect, useState } from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';

export function TopHeader({ onRefresh }: { onRefresh: () => void }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink-950/70 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-[15px] font-bold text-white tracking-tight flex items-center gap-2">
              <span className="truncate">Executive Control Tower</span>
              <span className="ds-chip bg-brand-500/15 text-brand-300 font-mono hidden sm:inline-flex">CEO</span>
            </h1>
            <p className="text-[11px] text-slate-500 truncate">CamTech Decision Support · Central Data Center</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="hidden md:flex items-center gap-2 rounded-xl border border-line bg-ink-850/70 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[11px] text-slate-600">·</span>
            <span className="text-[11px] text-slate-400">FY26 · Q3</span>
          </div>
          <button onClick={onRefresh} className="ds-btn ds-btn-ghost" title="Refresh">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
}
