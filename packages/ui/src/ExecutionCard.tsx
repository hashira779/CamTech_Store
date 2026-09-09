import type { LucideIcon } from 'lucide-react';
import { Ring } from './Ring';

export interface ExecutionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onTime: number;
  watch: number;
  issue: number;
  color: string;
}

export function ExecutionCard({ icon: Icon, title, subtitle, onTime, watch, issue, color }: ExecutionCardProps) {
  const total = onTime + watch + issue;
  const rate = total > 0 ? Math.round((onTime / total) * 100) : 0;

  return (
    <div className="ds-card ds-card-hover p-4 sm:p-5 animate-fade-up">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="ds-icon w-8 h-8" style={{ background: `${color}1a`, color }}>
          <Icon style={{ width: 16, height: 16 }} />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold ds-text leading-none truncate">{title}</h4>
          <p className="text-[11px] text-slate-500 mt-1 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Ring
          size={104}
          thickness={10}
          segments={[
            { value: onTime, color },
            { value: watch, color: '#f59e0b' },
            { value: issue, color: '#fb7185' }
          ]}
          center={
            <>
              <span className="ds-figure text-xl ds-text leading-none">{rate}%</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">on&nbsp;time</span>
            </>
          }
        />
        <div className="flex-1 space-y-2.5 min-w-0">
          {[
            { label: 'On time', v: onTime, c: color },
            { label: 'Watch', v: watch, c: '#f59e0b' },
            { label: 'Exception', v: issue, c: '#fb7185' }
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.c }} />
                {row.label}
              </span>
              <span className="ds-figure ds-text-dim">{row.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
