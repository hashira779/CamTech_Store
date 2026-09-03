'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type {
  EmployeeDto,
  DepartmentDto,
  LeaveRequestDto,
  PayrollRunDto,
  CreateEmployeeInput,
  CreateDepartmentInput,
  CreateLeaveRequestInput,
  CreatePayrollRunInput,
  LeaveType,
} from '@mystore/contracts';
import {
  Users,
  Building2,
  Calendar,
  DollarSign,
  Plus,
  RefreshCw,
  Check,
  X,
  UserCheck,
  Clock,
  Briefcase,
} from 'lucide-react';

export default function HrPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'DEPARTMENTS' | 'LEAVE' | 'PAYROLL'>('EMPLOYEES');

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);

  // Forms
  const [empFirst, setEmpFirst] = useState('');
  const [empLast, setEmpLast] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPos, setEmpPos] = useState('');
  const [empSalary, setEmpSalary] = useState('2500');
  const [empDeptId, setEmpDeptId] = useState('');

  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');

  const [leaveEmpId, setLeaveEmpId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('ANNUAL');
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().split('T')[0]);
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().split('T')[0]);
  const [leaveDays, setLeaveDays] = useState('1');
  const [leaveReason, setLeaveReason] = useState('');

  const [payrollName, setPayrollName] = useState(`Payroll - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);

  // Queries
  const { data: employees = [], refetch: refetchEmployees } = useQuery({
    queryKey: ['employeesList'],
    queryFn: () => api.listEmployees(token!),
    enabled: Boolean(token),
  });

  const { data: departments = [], refetch: refetchDepts } = useQuery({
    queryKey: ['departmentsList'],
    queryFn: () => api.listDepartments(token!),
    enabled: Boolean(token),
  });

  const { data: leaveRequests = [], refetch: refetchLeaves } = useQuery({
    queryKey: ['leavesList'],
    queryFn: () => api.listLeaveRequests(token!),
    enabled: Boolean(token) && activeTab === 'LEAVE',
  });

  const { data: payrollRuns = [], refetch: refetchPayroll } = useQuery({
    queryKey: ['payrollList'],
    queryFn: () => api.listPayrollRuns(token!),
    enabled: Boolean(token) && activeTab === 'PAYROLL',
  });

  // Mutations
  const createEmployeeMutation = useMutation({
    mutationFn: (input: CreateEmployeeInput) => api.createEmployee(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeesList'] });
      setIsEmployeeModalOpen(false);
      setEmpFirst('');
      setEmpLast('');
      setEmpEmail('');
      setEmpPos('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to register employee'),
  });

  const createDeptMutation = useMutation({
    mutationFn: (input: CreateDepartmentInput) => api.createDepartment(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departmentsList'] });
      setIsDeptModalOpen(false);
      setDeptName('');
      setDeptCode('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to create department'),
  });

  const createLeaveMutation = useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => api.createLeaveRequest(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leavesList'] });
      setIsLeaveModalOpen(false);
      setLeaveReason('');
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to submit leave'),
  });

  const approveLeaveMutation = useMutation({
    mutationFn: (id: string) => api.approveLeaveRequest(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leavesList'] }),
  });

  const rejectLeaveMutation = useMutation({
    mutationFn: (id: string) => api.rejectLeaveRequest(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leavesList'] }),
  });

  const createPayrollMutation = useMutation({
    mutationFn: (input: CreatePayrollRunInput) => api.createPayrollRun(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollList'] });
      setIsPayrollModalOpen(false);
    },
    onError: (err: any) => alert(err instanceof ApiClientError ? err.message : 'Failed to execute payroll'),
  });

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Users className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Human Resources & Workforce
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Employee profiles, organizational departments, leave balances, and payroll runs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refetchEmployees();
                refetchDepts();
                refetchLeaves();
                refetchPayroll();
              }}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {activeTab === 'EMPLOYEES' && (
              <button
                onClick={() => setIsEmployeeModalOpen(true)}
                className="btn flex items-center gap-1.5 text-sm shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Employee
              </button>
            )}
            {activeTab === 'DEPARTMENTS' && (
              <button
                onClick={() => setIsDeptModalOpen(true)}
                className="btn flex items-center gap-1.5 text-sm shadow-sm"
              >
                <Plus className="w-4 h-4" /> New Department
              </button>
            )}
            {activeTab === 'LEAVE' && (
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="btn flex items-center gap-1.5 text-sm shadow-sm"
              >
                <Plus className="w-4 h-4" /> Request Leave
              </button>
            )}
            {activeTab === 'PAYROLL' && (
              <button
                onClick={() => setIsPayrollModalOpen(true)}
                className="btn flex items-center gap-1.5 text-sm shadow-sm"
              >
                <Plus className="w-4 h-4" /> Run Payroll
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'EMPLOYEES'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Employee Directory ({employees.length})
          </button>
          <button
            onClick={() => setActiveTab('DEPARTMENTS')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'DEPARTMENTS'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Departments ({departments.length})
          </button>
          <button
            onClick={() => setActiveTab('LEAVE')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'LEAVE'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Leave Requests
          </button>
          <button
            onClick={() => setActiveTab('PAYROLL')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'PAYROLL'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Payroll Runs
          </button>
        </div>

        {/* TAB 1: EMPLOYEES */}
        {activeTab === 'EMPLOYEES' && (
          <div className="card border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-accent/40 text-muted-foreground border-b border-border">
                    <th className="p-3 font-semibold uppercase tracking-wider">Employee Name</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Position</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Department</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Status</th>
                    <th className="p-3 font-semibold uppercase tracking-wider text-right">Base Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-accent/20 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-foreground text-sm">{emp.fullName}</div>
                        <div className="text-[11px] text-muted-foreground">{emp.email || 'No email registered'}</div>
                      </td>
                      <td className="p-3 font-medium text-foreground">{emp.position}</td>
                      <td className="p-3 text-muted-foreground font-mono">{emp.departmentName || '—'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {emp.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-foreground text-sm">
                        ${emp.baseSalary.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: DEPARTMENTS */}
        {activeTab === 'DEPARTMENTS' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div key={dept.id} className="card p-5 border-border shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary">{dept.code || 'DEPT'}</span>
                  <div className="p-2 rounded-lg bg-accent text-foreground">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-base font-bold text-foreground">{dept.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{dept.description || 'General department operations'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: LEAVE */}
        {activeTab === 'LEAVE' && (
          <div className="card border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-accent/40 text-muted-foreground border-b border-border">
                    <th className="p-3 font-semibold uppercase tracking-wider">Employee</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Leave Type</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Duration</th>
                    <th className="p-3 font-semibold uppercase tracking-wider">Status</th>
                    <th className="p-3 font-semibold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leaveRequests.map((l) => (
                    <tr key={l.id} className="hover:bg-accent/20 transition-colors">
                      <td className="p-3 font-bold text-foreground">{l.employeeName}</td>
                      <td className="p-3 font-mono text-primary">{l.type}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(l.startDate).toLocaleDateString()} to {new Date(l.endDate).toLocaleDateString()} ({l.daysCount} days)
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${l.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : l.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {l.status === 'PENDING' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => approveLeaveMutation.mutate(l.id)}
                              className="btn py-1 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rejectLeaveMutation.mutate(l.id)}
                              className="btn btn-secondary py-1 px-2.5 text-[11px] text-destructive hover:bg-destructive/10"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PAYROLL */}
        {activeTab === 'PAYROLL' && (
          <div className="space-y-4">
            {payrollRuns.map((run) => (
              <div key={run.id} className="card p-5 border-border shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-foreground">{run.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      {new Date(run.periodStart).toLocaleDateString()} — {new Date(run.periodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider block">Total Net Disbursement</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">${run.totalNet.toFixed(2)}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-accent/40 text-muted-foreground">
                        <th className="p-2 font-semibold">Employee</th>
                        <th className="p-2 font-semibold text-right">Base Salary</th>
                        <th className="p-2 font-semibold text-right">Allowances</th>
                        <th className="p-2 font-semibold text-right">Deductions</th>
                        <th className="p-2 font-semibold text-right">Net Payable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {run.items.map((it) => (
                        <tr key={it.id}>
                          <td className="p-2 font-bold text-foreground">{it.employeeName}</td>
                          <td className="p-2 text-right font-mono">${it.baseSalary.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-emerald-400">+${it.allowances.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-rose-400">-${it.deductions.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold text-foreground">${it.netPay.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL: NEW EMPLOYEE */}
        {isEmployeeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Add New Employee</h3>
                <button onClick={() => setIsEmployeeModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createEmployeeMutation.mutate({
                  firstName: empFirst,
                  lastName: empLast,
                  email: empEmail || undefined,
                  position: empPos,
                  baseSalary: parseFloat(empSalary) || 0,
                  departmentId: empDeptId || undefined,
                });
              }} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block uppercase font-bold text-muted-foreground mb-1">First Name</label>
                    <input required value={empFirst} onChange={(e) => setEmpFirst(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                  </div>
                  <div>
                    <label className="block uppercase font-bold text-muted-foreground mb-1">Last Name</label>
                    <input required value={empLast} onChange={(e) => setEmpLast(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                  </div>
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Position / Job Title</label>
                  <input required value={empPos} onChange={(e) => setEmpPos(e.target.value)} placeholder="e.g. Sales Associate, Accountant" className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Base Monthly Salary ($)</label>
                  <input type="number" step="0.01" min="0" required value={empSalary} onChange={(e) => setEmpSalary(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Department</label>
                  <select value={empDeptId} onChange={(e) => setEmpDeptId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background">
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createEmployeeMutation.isPending} className="btn">{createEmployeeMutation.isPending ? 'Saving...' : 'Save Employee'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: NEW DEPARTMENT */}
        {isDeptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-sm p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Create Department</h3>
                <button onClick={() => setIsDeptModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createDeptMutation.mutate({ name: deptName, code: deptCode || undefined });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Department Name</label>
                  <input required value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Finance & Accounting" className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Code</label>
                  <input value={deptCode} onChange={(e) => setDeptCode(e.target.value)} placeholder="e.g. FIN" className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsDeptModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createDeptMutation.isPending} className="btn">{createDeptMutation.isPending ? 'Creating...' : 'Create Department'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RUN PAYROLL */}
        {isPayrollModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 border-border shadow-xl bg-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground">Execute Payroll Run</h3>
                <button onClick={() => setIsPayrollModalOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const now = new Date();
                const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
                createPayrollMutation.mutate({ name: payrollName, periodStart, periodEnd });
              }} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-bold text-muted-foreground mb-1">Run Name</label>
                  <input required value={payrollName} onChange={(e) => setPayrollName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <p className="text-muted-foreground text-[11px]">
                  This run will automatically calculate net disbursements for all {employees.length} active employees based on current salary agreements.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsPayrollModalOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={createPayrollMutation.isPending} className="btn">{createPayrollMutation.isPending ? 'Calculating...' : 'Run Payroll'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
