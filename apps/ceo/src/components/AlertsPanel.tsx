import { Bell } from 'lucide-react';

export interface AlertItem {
  tone: 'ok' | 'info' | 'warn';
  title: string;
  body: string;
  time: string;
}

const toneMap: Record<AlertItem['tone'], { dot: string; bg: string }> = {
  ok: { dot: '#34d399', bg: 'rgba(52,211,153,0.10)' },
  info: { dot: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },
  warn: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.10)' }
};

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  return (
    <section className="ds-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-brand-400" />
          Executive alerts
        </h3>
        <span className="ds-chip bg-brand-500/12 text-brand-300">{alerts.length}</span>
      </div>
      <div className="space-y-2.5">
        {alerts.map((a, i) => {
          const tone = toneMap[a.tone];
          return (
            <div
              key={i}
              className="rounded-xl border border-line p-3 hover:border-line-strong transition"
              style={{ background: tone.bg }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-white min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone.dot }} />
                  <span className="truncate">{a.title}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">{a.time}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed pl-3.5">{a.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
