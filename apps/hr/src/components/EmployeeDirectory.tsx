import { Mail, Users } from 'lucide-react';
import type { Employee } from '../hooks/useEmployees';
import { initials, money } from '../lib/format';

function StatusBadge({ status }: { status: Employee['status'] }) {
  const active = status === 'ACTIVE';
  return (
    <span
      className="ds-chip"
      style={{
        background: active ? 'rgba(52,211,153,0.14)' : 'rgba(245,158,11,0.14)',
        color: active ? '#34d399' : '#fbbf24'
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: active ? '#34d399' : '#fbbf24' }}
      />
      {active ? 'Active' : 'On leave'}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/25 text-brand-300 flex items-center justify-center font-bold font-mono text-xs shrink-0">
      {initials(name)}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-14 text-center">
      <Users className="w-8 h-8 mx-auto mb-3 text-slate-600" />
      <p className="font-semibold text-slate-300 text-sm">No personnel records found</p>
      <p className="text-[11px] text-slate-500 mt-1">
        Records appear as employees are onboarded from the Central HR database.
      </p>
    </div>
  );
}

interface Props {
  employees: Employee[];
  loading: boolean;
  onView: (e: Employee) => void;
}

export function EmployeeDirectory({ employees, loading, onView }: Props) {
  if (loading) {
    return (
      <div className="ds-card p-4 sm:p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-9 h-9 rounded-xl bg-ink-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 bg-ink-700 rounded" />
              <div className="h-3 w-56 bg-ink-700/60 rounded" />
            </div>
            <div className="h-5 w-16 bg-ink-700 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="ds-card">
        <EmptyState />
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="ds-card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500 border-b border-line uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5 font-semibold">Employee</th>
                <th className="py-3.5 px-5 font-semibold">Role &amp; department</th>
                <th className="py-3.5 px-5 font-semibold">Base salary</th>
                <th className="py-3.5 px-5 font-semibold">Status</th>
                <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="ds-divide">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-ink-800/40 transition">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} />
                      <div className="min-w-0">
                        <p className="font-bold text-white text-[13px] truncate">{e.name}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          {e.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-5">
                    <p className="font-medium text-slate-200">{e.position}</p>
                    <p className="text-[11px] text-slate-500">{e.department}</p>
                  </td>
                  <td className="py-3.5 px-5 ds-figure text-emerald-400 text-[13px]">{money(e.baseSalary)}/mo</td>
                  <td className="py-3.5 px-5">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={() => onView(e)}
                      className="px-3 py-1.5 rounded-lg bg-ink-800 hover:bg-ink-700 text-slate-300 text-xs font-medium transition"
                    >
                      Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {employees.map((e) => (
          <div key={e.id} className="ds-card p-4">
            <div className="flex items-center gap-3">
              <Avatar name={e.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-white text-sm truncate">{e.name}</p>
                  <StatusBadge status={e.status} />
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate mt-0.5">
                  <Mail className="w-3 h-3 shrink-0" />
                  {e.email}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-200 truncate">{e.position}</p>
                <p className="text-[11px] text-slate-500">{e.department}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="ds-figure text-emerald-400 text-sm">{money(e.baseSalary)}</p>
                <button
                  onClick={() => onView(e)}
                  className="mt-1 px-3 py-1 rounded-lg bg-ink-800 hover:bg-ink-700 text-slate-300 text-[11px] font-medium transition"
                >
                  Profile
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
