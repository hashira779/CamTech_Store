import { useMemo, useState } from 'react';
import { Users, DollarSign, Building2, Shield } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { StatTile } from '@mystore/ui';

import { useEmployees, type Employee } from './hooks/useEmployees';
import { money } from './lib/format';
import { HrHeader } from './components/HrHeader';
import { DirectoryControls } from './components/DirectoryControls';
import { EmployeeDirectory } from './components/EmployeeDirectory';

const DEPARTMENTS = ['ALL', 'Engineering', 'Retail', 'Finance', 'Supply Chain'];

export function App() {
  const { employees, stats, isLoading, refetch } = useEmployees();
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('ALL');
  const [payrollRunning, setPayrollRunning] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const matchesSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q);
      const matchesDept = dept === 'ALL' || e.department.includes(dept);
      return matchesSearch && matchesDept;
    });
  }, [employees, search, dept]);

  const runPayroll = () => {
    setPayrollRunning(true);
    setTimeout(() => {
      setPayrollRunning(false);
      toast.success(`Monthly payroll of ${money(stats.totalPayroll)} disbursed via Bakong corporate batch`);
    }, 1500);
  };

  const viewProfile = (e: Employee) => toast.info(`Opening profile for ${e.name}`);

  return (
    <div className="min-h-screen text-slate-100 font-sans selection:bg-brand-500/30">
      <Toaster position="top-right" richColors theme="dark" />

      <HrHeader
        totalPayroll={stats.totalPayroll}
        payrollRunning={payrollRunning}
        onRefresh={() => {
          refetch();
          toast.info('Refreshed employee records from Data Center');
        }}
        onRunPayroll={runPayroll}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-7 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="ds-eyebrow">Workforce overview</p>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">People &amp; payroll operations</h2>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            Ministry of Labour compliant
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            icon={Users}
            tint="#a78bfa"
            label="Active headcount"
            value={String(stats.active)}
            loading={isLoading}
            note={`${stats.onLeave} on leave`}
          />
          <StatTile
            icon={DollarSign}
            tint="#34d399"
            label="Monthly base payroll"
            value={money(stats.totalPayroll)}
            loading={isLoading}
            note="Due 28th each month"
          />
          <StatTile
            icon={Building2}
            tint="#38bdf8"
            label="Business units"
            value={String(stats.departmentCount || 4)}
            loading={isLoading}
            note="Across the enterprise"
          />
          <StatTile
            icon={Shield}
            tint="#fbbf24"
            label="Compliance status"
            value="100%"
            note="Statutory filings current"
          />
        </div>

        <DirectoryControls
          search={search}
          onSearch={setSearch}
          departments={DEPARTMENTS}
          selected={dept}
          onSelect={setDept}
        />

        <div className="flex items-center justify-between px-1">
          <p className="ds-eyebrow">Employee directory</p>
          <span className="text-[11px] text-slate-500 font-mono">
            {filtered.length} of {employees.length}
          </span>
        </div>

        <EmployeeDirectory employees={filtered} loading={isLoading} onView={viewProfile} />
      </main>

      <footer className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex items-center justify-between text-[11px] text-slate-600 border-t border-line mt-4 gap-2">
        <span className="truncate">CamTech Human Resources · hr.camtech.cam</span>
        <span className="font-mono shrink-0">unified design system</span>
      </footer>
    </div>
  );
}

export default App;
