'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  FolderTree,
  Table as TableIcon,
  Trash2,
  Edit2,
  Store,
  Layers,
  MapPin,
  Compass,
  Laptop,
  CheckCircle2,
} from 'lucide-react';
import type { LocationType, LocationTreeNodeDto, CreateLocationInput } from '@mystore/contracts';

const TYPE_ICONS: Record<LocationType, any> = {
  COMPANY: Building2,
  BUSINESS_UNIT: Layers,
  REGION: Compass,
  BRANCH: Store,
  DEPARTMENT: FolderTree,
  WAREHOUSE: MapPin,
  POS: Laptop,
};

const TYPE_COLORS: Record<LocationType, string> = {
  COMPANY: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  BUSINESS_UNIT: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  REGION: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  BRANCH: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  DEPARTMENT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  WAREHOUSE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  POS: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export function LocationsPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateLocationInput>({
    name: '',
    type: 'BRANCH',
    code: '',
    parentId: null,
  });

  const canWrite = hasPermission('locations.write');

  // Queries
  const { data: treeData = [], isLoading: isTreeLoading } = useQuery({
    queryKey: ['location-tree'],
    queryFn: () => api.getLocationTree(token!),
    enabled: Boolean(token),
  });

  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ['locations-list', search, typeFilter],
    queryFn: () =>
      api.listLocations(token!, {
        search: search || undefined,
        type: typeFilter || undefined,
        limit: 100,
      }),
    enabled: Boolean(token),
  });

  const locations = listData?.items ?? [];

  // Summary KPIs
  const totalLocations = locations.length;
  const branchCount = locations.filter((l) => l.type === 'BRANCH').length;
  const warehouseCount = locations.filter((l) => l.type === 'WAREHOUSE').length;
  const posCount = locations.filter((l) => l.type === 'POS').length;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (input: CreateLocationInput) => api.createLocation(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-list'] });
      closeModal();
    },
    onError: (err: any) => {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create location');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateLocationInput> }) =>
      api.updateLocation(token!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-list'] });
      closeModal();
    },
    onError: (err: any) => {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update location');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLocation(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-list'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Cannot delete this location');
    },
  });

  const openCreateModal = (presetParentId?: string | null) => {
    setEditingId(null);
    setFormData({
      name: '',
      type: 'BRANCH',
      code: '',
      parentId: presetParentId ?? null,
    });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (loc: { id: string; name: string; type: LocationType; code: string | null; parentId: string | null }) => {
    setEditingId(loc.id);
    setFormData({
      name: loc.name,
      type: loc.type,
      code: loc.code ?? '',
      parentId: loc.parentId ?? null,
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, input: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Locations & Organization Hierarchy"
          description="Configure multi-level organizational divisions, retail branches, central warehouses, and POS terminals."
          badge={
            <Badge variant="secondary" className="font-mono text-xs">
              {totalLocations} Registered Nodes
            </Badge>
          }
        >
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
            <Button
              variant={viewMode === 'tree' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('tree')}
              className="h-7 text-xs px-2.5 gap-1.5"
            >
              <FolderTree className="h-3.5 w-3.5" />
              Hierarchy Tree
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-7 text-xs px-2.5 gap-1.5"
            >
              <TableIcon className="h-3.5 w-3.5" />
              Tabular List
            </Button>
          </div>

          {canWrite && (
            <Button size="sm" onClick={() => openCreateModal()} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Add Location Node
            </Button>
          )}
        </PageHeader>

        {/* 4-Column Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Nodes"
            value={totalLocations}
            icon={Building2}
            iconColor="text-blue-500"
            isLoading={isListLoading}
          />
          <KpiCard
            title="Retail Stores & Branches"
            value={branchCount}
            icon={Store}
            iconColor="text-emerald-500"
            isLoading={isListLoading}
          />
          <KpiCard
            title="Warehouses & Hubs"
            value={warehouseCount}
            icon={MapPin}
            iconColor="text-amber-500"
            isLoading={isListLoading}
          />
          <KpiCard
            title="POS Stations"
            value={posCount}
            icon={Laptop}
            iconColor="text-purple-500"
            isLoading={isListLoading}
          />
        </div>

        {/* View Mode: Tree */}
        {viewMode === 'tree' && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Organizational Structure
              </h2>
              <span className="text-xs text-muted-foreground">
                Click (+) on any branch to attach a child unit or station
              </span>
            </div>

            {isTreeLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Loading organizational tree...
              </div>
            ) : treeData.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No locations configured yet. Click "Add Location Node" to create your root organization.
              </div>
            ) : (
              <div className="space-y-2">
                {treeData.map((node) => (
                  <TreeNodeView
                    key={node.id}
                    node={node}
                    canWrite={canWrite}
                    onAddChild={(parentId) => openCreateModal(parentId)}
                    onEdit={(node) => openEditModal(node)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* View Mode: Table */}
        {viewMode === 'table' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter by location name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input text-xs w-full sm:w-48"
              >
                <option value="">All Classification Types</option>
                <option value="COMPANY">Company</option>
                <option value="BUSINESS_UNIT">Business Unit</option>
                <option value="REGION">Region</option>
                <option value="BRANCH">Branch</option>
                <option value="DEPARTMENT">Department</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="POS">POS Terminal</option>
              </select>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Name</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Code</th>
                    <th className="p-3.5">Parent Location</th>
                    <th className="p-3.5">Sub-Units</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isListLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Loading locations...
                      </td>
                    </tr>
                  ) : listData?.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No matching locations found.
                      </td>
                    </tr>
                  ) : (
                    listData?.items.map((loc) => {
                      const Icon = TYPE_ICONS[loc.type];
                      return (
                        <tr key={loc.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3.5 font-medium text-foreground flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            {loc.name}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${TYPE_COLORS[loc.type]}`}
                            >
                              {loc.type}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-muted-foreground">{loc.code ?? '—'}</td>
                          <td className="p-3.5 text-muted-foreground">
                            {loc.parent ? loc.parent.name : <span className="italic text-muted-foreground/60">Root</span>}
                          </td>
                          <td className="p-3.5 text-muted-foreground font-mono">{loc.childrenCount ?? 0}</td>
                          <td className="p-3.5 text-right">
                            {canWrite && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditModal(loc)}
                                  className="h-7 w-7"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm(`Delete location "${loc.name}"?`)) {
                                      deleteMutation.mutate(loc.id);
                                    }
                                  }}
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Create / Edit Location */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Location Node' : 'New Location Node'}
              </DialogTitle>
              <DialogDescription>
                Define the identity, hierarchy classification, and parent location.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Location Name *</label>
                <Input
                  required
                  placeholder="e.g. Central Warehouse or Airport Branch"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as LocationType })}
                    className="input w-full text-xs"
                  >
                    <option value="COMPANY">Company</option>
                    <option value="BUSINESS_UNIT">Business Unit</option>
                    <option value="REGION">Region</option>
                    <option value="BRANCH">Branch</option>
                    <option value="DEPARTMENT">Department</option>
                    <option value="WAREHOUSE">Warehouse</option>
                    <option value="POS">POS Terminal</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Code</label>
                  <Input
                    placeholder="e.g. BR-001"
                    value={formData.code ?? ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Parent Location</label>
                <select
                  value={formData.parentId ?? ''}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value ? e.target.value : null })}
                  className="input w-full text-xs"
                >
                  <option value="">(None - Top-level Root)</option>
                  {listData?.items
                    .filter((l) => l.id !== editingId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.type} {l.code ? `- ${l.code}` : ''})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Defines the parent in the enterprise hierarchy. Circular references are automatically blocked.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Update Node' : 'Create Location'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </EnterpriseShell>
  );
}

function TreeNodeView({
  node,
  canWrite,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: LocationTreeNodeDto;
  canWrite: boolean;
  onAddChild: (id: string) => void;
  onEdit: (node: LocationTreeNodeDto) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = TYPE_ICONS[node.type] || Building2;

  return (
    <div className="border border-border/80 rounded-lg p-2.5 bg-card/60 transition-all hover:border-border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-muted/40 rounded text-muted-foreground transition-transform"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div className={`p-1.5 rounded-md border ${TYPE_COLORS[node.type]}`}>
            <Icon className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground">{node.name}</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${TYPE_COLORS[node.type]}`}>
                {node.type}
              </span>
              {node.code && (
                <span className="font-mono text-[10px] text-muted-foreground bg-muted/30 px-1 py-0.2 rounded">
                  {node.code}
                </span>
              )}
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="flex items-center gap-1 opacity-80 hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAddChild(node.id)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Add child node"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(node)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm(`Delete "${node.name}" and any child locations?`)) {
                  onDelete(node.id);
                }
              }}
              className="h-6 w-6 text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="pl-6 border-l border-border/80 ml-3 mt-2 space-y-2">
          {node.children.map((child) => (
            <TreeNodeView
              key={child.id}
              node={child}
              canWrite={canWrite}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default LocationsPage;
