'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import type { UserDetailDto, CreateUserInput, UpdateUserInput, RoleDto, CreateRoleInput, UpdateRoleInput } from '@mystore/contracts';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Search,
  RefreshCw,
  Edit2,
  UserX,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Eye,
  EyeOff,
  PlusCircle,
  Trash2
} from 'lucide-react';

const SYSTEM_PERMISSIONS = [
  "sales:read", "sales:write", "sales:refund",
  "catalog:read", "catalog:write",
  "inventory:read", "inventory:write",
  "users:read", "users:write",
  "reports:read",
  "delivery:read", "delivery:manage", "delivery:update_own",
  "apps:read", "apps:write", "apps:delete",
  "telegram:read", "telegram:write"
];

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

  // Form State - Create User
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createRoles, setCreateRoles] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form State - Edit User
  const [editName, setEditName] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Form State - Roles
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Query: Users List
  const { data: users = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['usersList'],
    queryFn: () => api.listUsers(token!),
    enabled: Boolean(token),
  });

  // Query: Roles List
  const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['rolesList'],
    queryFn: () => api.listRoles(token!),
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
      setCreateRoles([]);
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

  // Mutation: Create/Update Role
  const saveRoleMutation = useMutation({
    mutationFn: (input: { id?: string; data: any }) => 
      input.id 
        ? api.updateRole(token!, input.id, input.data) 
        : api.createRole(token!, input.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolesList'] });
      setIsRoleModalOpen(false);
      setEditingRole(null);
    },
    onError: (err: any) => {
      setRoleError(err instanceof ApiClientError ? err.message : 'Failed to save role');
    }
  });

  // Mutation: Delete Role
  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => api.deleteRole(token!, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolesList'] });
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

  const handleOpenRoleModal = (role?: RoleDto) => {
    setRoleError(null);
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRoleDescription(role.description || '');
      setRolePermissions(role.permissions.includes('*') ? [...SYSTEM_PERMISSIONS] : [...role.permissions]);
    } else {
      setEditingRole(null);
      setRoleName('');
      setRoleDescription('');
      setRolePermissions([]);
    }
    setIsRoleModalOpen(true);
  };

  const handleTogglePermission = (perm: string) => {
    if (rolePermissions.includes(perm)) {
      setRolePermissions(rolePermissions.filter(p => p !== perm));
    } else {
      setRolePermissions([...rolePermissions, perm]);
    }
  };

  const handleToggleCreateRole = (roleName: string) => {
    if (createRoles.includes(roleName)) {
      if (createRoles.length > 1) {
        setCreateRoles(createRoles.filter(r => r !== roleName));
      }
    } else {
      setCreateRoles([...createRoles, roleName]);
    }
  };

  const handleToggleEditRole = (roleName: string) => {
    if (editRoles.includes(roleName)) {
      if (editRoles.length > 1) {
        setEditRoles(editRoles.filter(r => r !== roleName));
      }
    } else {
      setEditRoles([...editRoles, roleName]);
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
      roles: createRoles.length > 0 ? createRoles : ['CASHIER']
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    const payload: UpdateUserInput = {
      name: editName,
      roles: editRoles.length > 0 ? editRoles : undefined,
      isActive: editIsActive
    };
    if (editNewPassword.trim()) {
      payload.password = editNewPassword;
    }
    updateMutation.mutate({ id: editingUser.id, input: payload });
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName) {
      setRoleError('Role name is required');
      return;
    }
    saveRoleMutation.mutate({
      id: editingRole?.id,
      data: {
        name: roleName,
        description: roleDescription,
        permissions: rolePermissions
      }
    });
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.roles.includes(roleFilter);
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
                Dynamic RBAC
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage administrators, staff, and fine-grained custom roles and permissions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ['rolesList'] }); }}
              disabled={isFetching || isLoadingRoles}
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
            Roles & Capabilities Matrix ({roles.length})
          </button>
        </div>

        {activeTab === 'DIRECTORY' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border rounded-lg p-3">
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
                  {roles.map((r: RoleDto) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs">
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
                                {u.roles.map((rName) => {
                                  const rObj = roles.find((r: RoleDto) => r.name === rName);
                                  return (
                                    <span
                                      key={rName}
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                        rObj?.isSystem ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-primary/10 text-primary border-primary/30'
                                      }`}
                                    >
                                      {rName}
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
            <div className="flex justify-between items-center bg-card border border-border rounded-lg p-5">
              <div>
                <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Dynamic Role Management
                </h2>
                <p className="text-xs text-muted-foreground">
                  Create custom roles with specific permissions, or view system roles.
                </p>
              </div>
              <button
                onClick={() => handleOpenRoleModal()}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                Create Role
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoadingRoles ? (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                  Loading roles...
                </div>
              ) : roles.map((r: RoleDto) => (
                <div
                  key={r.id}
                  className="border border-border rounded-lg p-4 bg-background/50 hover:bg-background transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                        r.isSystem ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-primary/10 text-primary border-primary/30'
                      }`}>
                        {r.name}
                      </span>
                      {r.isSystem && <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-1 rounded">SYSTEM</span>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                      {r.description || 'No description provided.'}
                    </p>
                    
                    <div className="flex flex-wrap gap-1 mb-4">
                      {r.permissions.includes('*') ? (
                        <span className="text-[9px] font-mono bg-amber-500/20 text-amber-400 px-1 rounded">ALL PERMISSIONS (*)</span>
                      ) : (
                        r.permissions.map(p => (
                          <span key={p} className="text-[9px] font-mono bg-muted text-muted-foreground px-1 rounded">{p}</span>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {!r.isSystem && (
                    <div className="flex items-center gap-2 pt-3 border-t border-border mt-auto">
                      <button
                        onClick={() => handleOpenRoleModal(r)}
                        className="flex-1 btn btn-secondary btn-sm h-7 text-[10px]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete role ${r.name}?`)) {
                            deleteRoleMutation.mutate(r.id);
                          }
                        }}
                        className="p-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: CREATE / EDIT USER */}
      {(isCreateOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 bg-black/80  flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-lg shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  {isEditOpen ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <h3 className="font-bold text-base text-foreground">
                  {isEditOpen ? 'Edit User Profile' : 'Create New User'}
                </h3>
              </div>
              <button
                onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={isEditOpen ? handleEditSubmit : handleCreateSubmit} className="p-5 space-y-4">
              {(createError || editError) && (
                <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                  {createError || editError}
                </div>
              )}

              {isEditOpen && editingUser && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Email / Username</label>
                  <input
                    type="text"
                    disabled
                    value={editingUser.email}
                    className="input text-xs w-full bg-muted/50 text-muted-foreground cursor-not-allowed font-mono"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sreymom Keo"
                  value={isEditOpen ? editName : createName}
                  onChange={(e) => isEditOpen ? setEditName(e.target.value) : setCreateName(e.target.value)}
                  className="input text-xs w-full bg-background"
                />
              </div>

              {!isEditOpen && (
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
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  {isEditOpen ? 'Reset Password (optional)' : 'Initial Password'}
                </label>
                <div className="relative">
                  <input
                    type={isEditOpen ? (showEditPassword ? 'text' : 'password') : (showCreatePassword ? 'text' : 'password')}
                    required={!isEditOpen}
                    placeholder={isEditOpen ? 'Leave blank to keep existing password' : '••••••••'}
                    value={isEditOpen ? editNewPassword : createPassword}
                    onChange={(e) => isEditOpen ? setEditNewPassword(e.target.value) : setCreatePassword(e.target.value)}
                    className="input text-xs w-full bg-background pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => isEditOpen ? setShowEditPassword(!showEditPassword) : setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {(isEditOpen ? showEditPassword : showCreatePassword) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {isEditOpen && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">Account Status</span>
                    <span className="text-[11px] text-muted-foreground">
                      {editIsActive ? 'Active: can authenticate' : 'Suspended: access blocked'}
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
              )}

              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Assign Roles</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Select one or more</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-border rounded-lg bg-background/50">
                  {roles.filter((r: RoleDto) => r.name !== 'SUPER_ADMIN' || isSuperAdmin).map((r: RoleDto) => {
                    const isSelected = (isEditOpen ? editRoles : createRoles).includes(r.name);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => isEditOpen ? handleToggleEditRole(r.name) : handleToggleCreateRole(r.name)}
                        className={`text-left p-2 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-foreground font-semibold'
                            : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{r.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                >
                  {isEditOpen ? <Save className="w-3.5 h-3.5" /> : null}
                  {isEditOpen ? (updateMutation.isPending ? 'Saving...' : 'Save Changes') : (createMutation.isPending ? 'Provisioning...' : 'Provision User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT ROLE */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-2xl shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-foreground">
                  {editingRole ? 'Edit Custom Role' : 'Create Custom Role'}
                </h3>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRoleSubmit} className="p-5 space-y-4">
              {roleError && (
                <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                  {roleError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Role Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INVENTORY_MANAGER"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    className="input text-xs w-full bg-background uppercase font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Description</label>
                  <input
                    type="text"
                    placeholder="Brief description of this role"
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    className="input text-xs w-full bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-foreground">Select Permissions</label>
                <div className="bg-background/50 border border-border rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {SYSTEM_PERMISSIONS.map(perm => {
                    const isSelected = rolePermissions.includes(perm);
                    return (
                      <button
                        type="button"
                        key={perm}
                        onClick={() => handleTogglePermission(perm)}
                        className={`text-left text-[11px] px-2 py-1.5 rounded border transition-colors flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-primary/20 border-primary text-primary font-medium' 
                            : 'bg-card border-border hover:border-primary/50 text-muted-foreground'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'}`}>
                          {isSelected && <CheckCircle2 className="w-2.5 h-2.5" />}
                        </div>
                        {perm}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveRoleMutation.isPending}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveRoleMutation.isPending ? 'Saving...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </EnterpriseShell>
  );
}
