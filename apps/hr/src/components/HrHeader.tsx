import { Users, RefreshCw, DollarSign } from 'lucide-react';
import { compactMoney } from '../lib/format';

interface HrHeaderProps {
  totalPayroll: number;
  payrollRunning: boolean;
  onRefresh: () => void;
  onRunPayroll: () => void;
}

export function HrHeader({ totalPayroll, payrollRunning, onRefresh, onRunPayroll }: HrHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink-950/70 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-[15px] font-bold text-white tracking-tight flex items-center gap-2">
              <span className="truncate">Human Resources</span>
              <span className="ds-chip bg-brand-500/15 text-brand-300 font-mono hidden sm:inline-flex">HR</span>
            </h1>
            <p className="text-[11px] text-slate-500 truncate">Workforce &amp; payroll operations · Central Data Center</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onRefresh} className="ds-btn ds-btn-ghost" title="Sync employee records">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Sync</span>
          </button>
          <button
            onClick={onRunPayroll}
            disabled={payrollRunning}
            className="ds-btn ds-btn-brand disabled:opacity-50"
            title="Run monthly payroll"
          >
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">
              {payrollRunning ? 'Processing…' : `Run payroll ${compactMoney(totalPayroll)}`}
            </span>
            <span className="sm:hidden">{payrollRunning ? '…' : 'Payroll'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
