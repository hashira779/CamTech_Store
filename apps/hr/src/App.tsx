import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Building2,
  Calendar,
  DollarSign,
  UserPlus,
  Search,
  CheckCircle2,
  Clock,
  Briefcase,
  Mail,
  Shield,
  RefreshCw,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  baseSalary: number;
  status: 'ACTIVE' | 'ON_LEAVE';
}

const FALLBACK_EMPLOYEES: Employee[] = [
  { id: 'emp-01', name: 'Kosal Vann', email: 'kosal.v@camtech.cam', department: 'Engineering & IT', position: 'Principal Software Architect', baseSalary: 4500.00, status: 'ACTIVE' },
  { id: 'emp-02', name: 'Sophea Noun', email: 'sophea.n@camtech.cam', department: 'Retail Operations', position: 'Retail Operations Lead', baseSalary: 2200.00, status: 'ACTIVE' },
  { id: 'emp-03', name: 'Rathana Lim', email: 'rathana.l@camtech.cam', department: 'Finance & Accounting', position: 'Senior Financial Controller', baseSalary: 2800.00, status: 'ACTIVE' },
  { id: 'emp-04', name: 'Meng Chhay', email: 'meng.c@camtech.cam', department: 'Supply Chain & Fleet', position: 'Fleet Logistics Coordinator', baseSalary: 1800.00, status: 'ACTIVE' },
];

export function App() {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isPayrollRunning, setIsPayrollRunning] = useState(false);

  // Fetch live employees from Central Data Center API
  const { data: serverEmployees, refetch } = useQuery({
    queryKey: ['hr-live-employees'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:4000/api/v1/hr/employees');
        if (!res.ok) throw new Error('API offline');
        const json = await res.json();
        const items = json.data?.items || json.items || json.data || [];
        if (Array.isArray(items) && items.length > 0) {
          return items.map((e: any) => ({
            id: e.id,
            name: `${e.firstName || e.first_name || ''} ${e.lastName || e.last_name || ''}`.trim() || e.name || 'Staff Member',
            email: e.email || 'staff@camtech.cam',
            department: e.department?.name || e.departmentId || 'Operations',
            position: e.position || 'Specialist',
            baseSalary: Number(e.baseSalary || e.base_salary || 2000),
            status: (e.status === 'ON_LEAVE' ? 'ON_LEAVE' : 'ACTIVE') as 'ACTIVE' | 'ON_LEAVE'
          }));
        }
        return FALLBACK_EMPLOYEES;
      } catch {
        return FALLBACK_EMPLOYEES;
      }
    }
  });

  const employees: Employee[] = serverEmployees || FALLBACK_EMPLOYEES;

  const totalPayroll = employees.reduce((sum, e) => sum + e.baseSalary, 0);

  const filtered = employees.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
                          e.position.toLowerCase().includes(search.toLowerCase()) ||
                          e.email.toLowerCase().includes(search.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || e.department.includes(selectedDept);
    return matchesSearch && matchesDept;
  });

  const runMonthlyPayroll = () => {
    setIsPayrollRunning(true);
    setTimeout(() => {
      setIsPayrollRunning(false);
      toast.success(`🎉 Monthly Payroll of $${totalPayroll.toLocaleString()} Disbursed via Bakong Corporate Batch!`);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none flex flex-col">
      <Toaster position="top-right" richColors />

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white text-xs py-1.5 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono">PORT 5005</span>
          <span>CamTech People & Workforce Operations Console</span>
        </div>
        <span className="text-[11px] text-purple-200">Central Data Center: localhost:4000</span>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">Human Resources Portal</h1>
              <p className="text-xs text-slate-400">hr.camtech.cam (Port 5005)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { refetch(); toast.info('Refreshed employee records from Data Center'); }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Sync Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              disabled={isPayrollRunning}
              onClick={runMonthlyPayroll}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-purple-600/20"
            >
              <DollarSign className="w-4 h-4" />
              {isPayrollRunning ? 'Processing Payroll...' : `Run Payroll ($${totalPayroll.toLocaleString()})`}
            </button>
          </div>
        </div>
      </header>

      {/* Main HR Dashboard */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" /> Total Active Staff
            </span>
            <p className="text-2xl font-extrabold text-white mt-2 font-mono">{employees.length}</p>
            <span className="text-[10px] text-emerald-400 mt-1 block">100% Retained</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Monthly Base Payroll
            </span>
            <p className="text-2xl font-extrabold text-emerald-400 mt-2 font-mono">${totalPayroll.toLocaleString()}</p>
            <span className="text-[10px] text-slate-500 mt-1 block">Due 28th of each month</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-400" /> Business Units
            </span>
            <p className="text-2xl font-extrabold text-white mt-2 font-mono">4</p>
            <span className="text-[10px] text-slate-400 mt-1 block">Engineering, Ops, Finance, Fleet</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-400" /> Compliance Status
            </span>
            <p className="text-2xl font-extrabold text-white mt-2 font-mono">100%</p>
            <span className="text-[10px] text-emerald-400 mt-1 block">Ministry of Labour Compliant</span>
          </div>
        </div>

        {/* Directory Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee by name, role, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {['ALL', 'Engineering', 'Retail', 'Finance', 'Supply Chain'].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDept(d)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                  selectedDept === d
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Employee Table */}
        <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Employee</th>
                <th className="py-3.5 px-6">Role & Department</th>
                <th className="py-3.5 px-6">Base Salary</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold font-mono">
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{emp.name}</p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {emp.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-medium text-slate-200">{emp.position}</p>
                    <p className="text-[11px] text-slate-500">{emp.department}</p>
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-emerald-400 text-sm">
                    ${emp.baseSalary.toFixed(2)}/mo
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {emp.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => toast.info(`Viewing details for ${emp.name}`)}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                    >
                      Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;
