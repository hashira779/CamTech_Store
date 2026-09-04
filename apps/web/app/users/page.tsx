'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type { UserDetailDto, CreateUserInput, UpdateUserInput, Role } from '@mystore/contracts';
import { ROLES } from '@mystore/contracts';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  KeyRound,
  Search,
  RefreshCw,
  Edit2,
  UserX,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Lock,
  Building,
  Sparkles,
  Info
} from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    desc: 'Unrestricted system-wide authority across all branches, databases, and platform features.'
  },
  PLATFORM_ADMIN: {
    label: 'Platform Admin',
    color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    desc: 'Full platform administration, integrations, webhooks, and cloud infrastructure.'
  },
  ORG_ADMIN: {
    label: 'Organization Admin',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    desc: 'Enterprise owner: manage company locations, pricing, finance, HR, and staff.'
  },
  COMPANY_ADMIN: {
    label: 'Company Admin',
    color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    desc: 'Division administrator for multi-entity corporate structures.'
  },
  BRANCH_MANAGER: {
    label: 'Branch / Store Manager',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    desc: 'Manage store inventory, cashiers, shifts, discounts, and daily reconciliation.'
  },
  FINANCE_MANAGER: {
    label: 'Finance Manager',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    desc: 'General ledger, charts of accounts, tax reporting, and payment reconciliations.'
  },
  SALES_MANAGER: {
    label: 'Sales Manager',
    color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    desc: 'Price lists, customer tiers, bulk orders, wholesale accounts, and sales pipelines.'
  },
  WAREHOUSE_MANAGER: {
    label: 'Warehouse Manager',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    desc: 'WMS inventory control, inter-branch transfers, bin locations, and procurement receipts.'
  },
  CASHIER: {
    label: 'Cashier',
    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    desc: 'Front-counter POS checkout, Bakong KHQR, cash sessions, and receipt printing.'
  },
  ACCOUNTANT: {
    label: 'Accountant',
    color: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    desc: 'Journal entries, bank reconciliation, invoices, and asset depreciation.'
  },
  STAFF: {
    label: 'General Staff',
    color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
    desc: 'Standard employee access: task execution, stock lookup, and self-service.'
  },
  CUSTOMER: {
    label: 'Customer',
    color: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    desc: 'Online storefront customer portal: orders, tracking, and loyalty rewards.'
  }
};

export default function UsersPage() {
  const { token, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'ROLES_MATRIX'>('DIRECTORY');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDetailDto | null>(null);

  // Form State - Create
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRoles, setCreateRoles] = useState<Role[]>(['STAFF']);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form State - Edit
  const [editName, setEditName] = useState('');
  const [editRoles, setEditRoles] = useState<Role[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Query: Users List
  const { data: users = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['usersList'],
    queryFn: () => api.listUsers(token!),
    enabled: Boolean(token),
  });

  // Mutation: Create User
  const createMutation = useMutation({
    mutationFn: (input: CreateUserInput) => api.createUser(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      setIsCreateOpen(false);
      setCreateName('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateRoles(['STAFF']);
      setCreateError(null);
    },
    onError: (err: any) => {
      setCreateError(err instanceof ApiClientError ? err.message : 'Failed to create user');
    }
  });

  // Mutation: Update User
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      api.updateUser(token!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      setIsEditOpen(false);
      setEditingUser(null);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err instanceof ApiClientError ? err.message : 'Failed to update user');
    }
  });

  // Mutation: Deactivate User
  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => api.deactivateUser(token!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
    }
  });

  const handleOpenEdit = (user: UserDetailDto) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRoles([...user.roles]);
    setEditIsActive(user.isActive);
    setEditNewPassword('');
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleToggleCreateRole = (role: Role) => {
    if (createRoles.includes(role)) {
      if (createRoles.length > 1) {
        setCreateRoles(createRoles.filter(r => r !== role));
      }
    } else {
      setCreateRoles([...createRoles, role]);
    }
  };

  const handleToggleEditRole = (role: Role) => {
    if (editRoles.includes(role)) {
      if (editRoles.length > 1) {
        setEditRoles(editRoles.filter(r => r !== role));
      }
    } else {
      setEditRoles([...editRoles, role]);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createName || !createEmail || !createPassword) {
      setCreateError('Please fill in all required fields');
      return;
    }
    createMutation.mutate({
      name: createName,
      email: createEmail,
      password: createPassword,
      roles: createRoles
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    const payload: UpdateUserInput = {
      name: editName,
      roles: editRoles,
      isActive: editIsActive
    };
    if (editNewPassword.trim()) {
      payload.password = editNewPassword;
    }
    updateMutation.mutate({ id: editingUser.id, input: payload });
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.roles.includes(roleFilter as Role);
    return matchesSearch && matchesRole;
  });

  const isSuperAdmin = currentUser?.roles?.includes('SUPER_ADMIN');

  return (
    <EnterpriseShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Users & Access Control</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                Live RBAC
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage administrators, managers, cashiers, and fine-grained role permissions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              New User / Admin
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <button
            onClick={() => setActiveTab('DIRECTORY')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'DIRECTORY'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Staff & User Directory ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('ROLES_MATRIX')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'ROLES_MATRIX'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Roles & Capabilities Matrix
          </button>
        </div>

        {activeTab === 'DIRECTORY' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border rounded-xl p-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9 text-xs w-full bg-background"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground font-medium">Role Filter:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="input text-xs bg-background py-1 px-2.5 h-8 rounded-lg"
                >
                  <option value="ALL">All Roles</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_CONFIG[r]?.label || r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email / Login</th>
                      <th className="py-3 px-4">Assigned Roles</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                          Loading organization users...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground">
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase border border-primary/30">
                                  {u.name ? u.name[0] : 'U'}
                                </div>
                                <div>
                                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                                    {u.name}
                                    {isSelf && (
                                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-normal">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    ID: {u.id.substring(0, 14)}...
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-foreground font-medium">
                              {u.email}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1.5">
                                {u.roles.map((r) => {
                                  const cfg = ROLE_CONFIG[r] || {
                                    label: r,
                                    color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                                  };
                                  return (
                                    <span
                                      key={r}
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${cfg.color}`}
                                    >
                                      {cfg.label}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              {u.isActive ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium">
                                  <XCircle className="w-3.5 h-3.5" /> Inactive
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(u)}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title="Edit User & Roles"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {!isSelf && u.isActive && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Deactivate access for ${u.email}?`)) {
                                        deactivateMutation.mutate(u.id);
                                      }
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Deactivate Account"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ROLES_MATRIX' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Enterprise Role Hierarchy & Scopes
              </h2>
              <p className="text-xs text-muted-foreground mb-6">
                Each role inherits precise operational domains. A user can hold multiple roles simultaneously.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ROLES.map((r) => {
                  const cfg = ROLE_CONFIG[r] || {
                    label: r,
                    color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                    desc: 'Standard enterprise access profile.'
                  };
                  return (
                    <div
                      key={r}
                      className="border border-border rounded-xl p-4 bg-background/50 hover:bg-background transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">{r}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {cfg.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: CREATE USER */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-foreground">Create New Admin / Staff User</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                  {createError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sreymom Keo"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="input text-xs w-full bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email / Username (Login)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cashier01@camtechstore or name@camtech.cam"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="input text-xs w-full bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="input text-xs w-full bg-background"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Assign Roles</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Select one or more</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-border rounded-xl bg-background/50">
                  {ROLES.filter(r => r !== 'SUPER_ADMIN' || isSuperAdmin).map((r) => {
                    const isSelected = createRoles.includes(r);
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => handleToggleCreateRole(r)}
                        className={`text-left p-2 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-foreground font-semibold'
                            : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{ROLE_CONFIG[r]?.label || r}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                >
                  {createMutation.isPending ? 'Provisioning...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {isEditOpen && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-foreground">Edit User Profile & Roles</h3>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                  {editError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email / Username</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="input text-xs w-full bg-muted/50 text-muted-foreground cursor-not-allowed font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input text-xs w-full bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Reset Password (optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep existing password"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  className="input text-xs w-full bg-background"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background/50">
                <div>
                  <span className="text-xs font-semibold text-foreground block">Account Status</span>
                  <span className="text-[11px] text-muted-foreground">
                    {editIsActive ? 'Active: can authenticate & perform actions' : 'Suspended: access blocked'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    editIsActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {editIsActive ? 'ACTIVE' : 'SUSPENDED'}
                </button>
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Assigned Roles</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Select one or more</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-border rounded-xl bg-background/50">
                  {ROLES.filter(r => r !== 'SUPER_ADMIN' || isSuperAdmin).map((r) => {
                    const isSelected = editRoles.includes(r);
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => handleToggleEditRole(r)}
                        className={`text-left p-2 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-foreground font-semibold'
                            : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{ROLE_CONFIG[r]?.label || r}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </EnterpriseShell>
  );
}
