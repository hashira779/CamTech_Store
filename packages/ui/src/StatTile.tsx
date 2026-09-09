import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Sparkline } from './Sparkline';

export interface StatTileProps {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string;
  loading?: boolean;
  delta?: string;
  deltaUp?: boolean;
  spark?: number[];
  note?: string;
}

export function StatTile({ icon: Icon, tint, label, value, loading, delta, deltaUp = true, spark, note }: StatTileProps) {
  return (
    <div className="ds-card ds-card-hover p-4 sm:p-5 overflow-hidden animate-fade-up">
      <div className="flex items-start justify-between">
        <div className="ds-icon w-9 h-9" style={{ background: `${tint}1a`, color: tint }}>
          <Icon style={{ width: 18, height: 18 }} />
        </div>
        {delta && (
          <span
            className="ds-chip"
            style={{
              background: deltaUp ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)',
              color: deltaUp ? '#34d399' : '#fb7185'
            }}
          >
            {deltaUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {delta}
          </span>
        )}
      </div>
      <p className="ds-eyebrow mt-4">{label}</p>
      {loading ? (
        <div className="h-8 w-28 rounded-lg bg-ink-700 animate-pulse mt-1.5" />
      ) : (
        <p className="ds-figure text-2xl sm:text-[26px] ds-text mt-1 leading-tight truncate">{value}</p>
      )}
      {spark ? (
        <div className="mt-2 -mx-1">
          <Sparkline points={spark} color={tint} />
        </div>
      ) : (
        note && <p className="text-[11px] text-slate-500 mt-2">{note}</p>
      )}
    </div>
  );
}
