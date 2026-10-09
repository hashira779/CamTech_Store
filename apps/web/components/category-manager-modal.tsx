'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { CategoryForm } from './category-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CategoryDto,
  type CategoryTreeNodeDto,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Plus,
  Trash2,
  Edit2,
  FolderTree,
  Check,
  X,
  Layers,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Search,
  Package,
} from 'lucide-react';
import { getCategoryIcon, CATEGORY_ICONS, findNodeInTree } from '@/components/category-tree-select';

// ─── Icon Picker ───────────────────────────────────────────────
const ICON_OPTIONS = Object.entries(CATEGORY_ICONS);

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-start gap-2 text-sm font-normal"
        >
          <span className="text-lg">{getCategoryIcon(value)}</span>
          <span className="text-muted-foreground truncate">{value || 'Choose icon…'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {ICON_OPTIONS.map(([key, emoji]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={`
                w-10 h-10 flex items-center justify-center rounded-md text-lg
                transition-all duration-100 hover:scale-110
                ${value === key
                  ? 'bg-primary/15 ring-2 ring-primary/40'
                  : 'hover:bg-muted/80'
                }
              `}
              title={key}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            Clear icon
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Tree Node ─────────────────────────────────────────────────
function CategoryTreeNode({
  node,
  depth,
  selectedId,
  expandedIds,
  onToggleExpand,
  onSelect,
  onMoveUp,
  onMoveDown,
}: {
  node: CategoryTreeNodeDto;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div className="animate-in fade-in duration-200">
      <div
        className={`
          group flex items-center gap-1.5 pr-2 py-1 rounded-lg cursor-pointer transition-all duration-150
          ${isSelected
            ? 'bg-primary/10 ring-1 ring-primary/20 shadow-sm'
            : 'hover:bg-muted/40'
          }
          ${!node.isActive ? 'opacity-50' : ''}
        `}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Icon */}
        <span className="text-base shrink-0">{getCategoryIcon(node.icon)}</span>

        {/* Name */}
        <span className={`truncate flex-1 text-sm ${isSelected ? 'font-semibold text-primary' : 'text-foreground'}`}>
          {node.name}
        </span>

        {/* Product count badge */}
        {node.productCount > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono shrink-0 gap-0.5">
            <Package className="w-2.5 h-2.5" />
            {node.productCount}
          </Badge>
        )}

        {/* Inactive indicator */}
        {!node.isActive && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground border-muted-foreground/30 shrink-0">
            Off
          </Badge>
        )}

        {/* Children count */}
        {hasChildren && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground shrink-0">
            {node.children.length}
          </Badge>
        )}

        {/* Reorder buttons (visible on hover) */}
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          {onMoveUp && (
            <button
              type="button"
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp(node.id);
              }}
              title="Move up"
            >
              <ArrowUp className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown(node.id);
              }}
              title="Move down"
            >
              <ArrowDown className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Children (animated) */}
      {hasChildren && isExpanded && (
        <div className="animate-in slide-in-from-top-1 fade-in duration-200">
          {node.children.map((child, idx) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onMoveUp={idx > 0 ? onMoveUp : undefined}
              onMoveDown={idx < node.children.length - 1 ? onMoveDown : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export function CategoryManagerModal({
  token,
  isOpen,
  onClose,
  onChanged,
}: {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();

  // ─── State ──────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // ─── Queries ──────────────────────────────────────────────────
  const { data: treeData, isLoading: isTreeLoading } = useQuery({
    queryKey: ['categories-tree'],
    queryFn: () => api.getCategoryTree(token),
    enabled: isOpen,
  });

  const { data: flatCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.listCategories(token),
    enabled: isOpen,
  });

  // ─── Derived state ──────────────────────────────────────────
  const selectedCategory = useMemo(() => {
    if (!selectedId) return null;
    const fromFlat = flatCategories?.find((c) => c.id === selectedId);
    if (fromFlat) return fromFlat;
    if (treeData) {
      const fromTree = findNodeInTree(treeData, selectedId);
      if (fromTree) {
        return {
          id: fromTree.id,
          organizationId: '',
          parentId: fromTree.parentId,
          name: fromTree.name,
          description: fromTree.description,
          slug: fromTree.slug,
          icon: fromTree.icon,
          imageUrl: fromTree.imageUrl,
          level: fromTree.level,
          sortOrder: fromTree.sortOrder,
          isActive: fromTree.isActive,
          productCount: fromTree.productCount,
          breadcrumb: [],
        } as CategoryDto;
      }
    }
    return null;
  }, [selectedId, flatCategories, treeData]);

  const totalCount = flatCategories?.length ?? 0;

  // ─── Helpers ──────────────────────────────────────────────────


  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['categories-tree'] });
    if (onChanged) onChanged();
  }, [queryClient, onChanged]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────
  const handleSelect = useCallback(
    (id: string) => {
      if (id === selectedId && !isCreating) {
        // Deselect
        setSelectedId(null);
        setIsCreating(false);
        return;
      }
      setSelectedId(id);
      setIsCreating(false);
    },
    [selectedId, isCreating]
  );

  const handleStartCreate = useCallback(
    (parentId?: string) => {
            setSelectedId(null);
      setIsCreating(true);
      if (parentId) { setExpandedIds(prev => new Set([...prev, parentId])); }
    },
    []
  );




  const handleMoveUp = useCallback(
    async (id: string) => {
      if (!flatCategories) return;
      const cat = flatCategories.find((c) => c.id === id);
      if (!cat) return;
      // Find siblings
      const siblings = flatCategories
        .filter((c) => c.parentId === cat.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = siblings.findIndex((c) => c.id === id);
      if (idx <= 0) return;

      // Swap sortOrders
      const items = [
        { id: siblings[idx].id, sortOrder: siblings[idx - 1].sortOrder },
        { id: siblings[idx - 1].id, sortOrder: siblings[idx].sortOrder },
      ];
      try {
        await api.reorderCategories(token, items);
        invalidateAll();
      } catch {
        /* silent */
      }
    },
    [flatCategories, token, invalidateAll]
  );

  const handleMoveDown = useCallback(
    async (id: string) => {
      if (!flatCategories) return;
      const cat = flatCategories.find((c) => c.id === id);
      if (!cat) return;
      const siblings = flatCategories
        .filter((c) => c.parentId === cat.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = siblings.findIndex((c) => c.id === id);
      if (idx < 0 || idx >= siblings.length - 1) return;

      const items = [
        { id: siblings[idx].id, sortOrder: siblings[idx + 1].sortOrder },
        { id: siblings[idx + 1].id, sortOrder: siblings[idx].sortOrder },
      ];
      try {
        await api.reorderCategories(token, items);
        invalidateAll();
      } catch {
        /* silent */
      }
    },
    [flatCategories, token, invalidateAll]
  );

  // Build breadcrumb for selected category
  const breadcrumb = selectedCategory?.breadcrumb ?? [];

  const showForm = isCreating || selectedId;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderTree className="w-5 h-5 text-primary" />
            Category Manager
            <Badge variant="secondary" className="text-[10px] font-mono ml-1">
              {totalCount}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Organize products into a world-class category hierarchy with icons, SEO, and sort ordering.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mx-6 p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden border-t border-border" style={{ minHeight: '400px', maxHeight: 'calc(88vh - 110px)' }}>
          {/* ─── Left: Tree Panel ──────────────────────────── */}
          <div className="w-[340px] border-r border-border flex flex-col shrink-0">
            {/* Tree header */}
            <div className="px-3 py-2 flex items-center justify-between border-b border-border bg-muted/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Hierarchy
              </span>
              <Button
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={() => handleStartCreate()}
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>

            {/* Tree body */}
            <div className="flex-1 overflow-y-auto p-1.5">
              {isTreeLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Loading tree…
                </div>
              ) : !treeData || treeData.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <Layers className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-sm font-semibold text-foreground">No categories yet</p>
                  <p className="text-xs text-muted-foreground">
                    Create your first category to start organizing products.
                  </p>
                  <Button size="sm" onClick={() => handleStartCreate()} className="gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" />
                    Create First Category
                  </Button>
                </div>
              ) : (
                treeData.map((node, idx) => (
                  <CategoryTreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={selectedId}
                    expandedIds={expandedIds}
                    onToggleExpand={toggleExpand}
                    onSelect={handleSelect}
                    onMoveUp={idx > 0 ? handleMoveUp : undefined}
                    onMoveDown={idx < treeData.length - 1 ? handleMoveDown : undefined}
                  />
                ))
              )}
            </div>
          </div>

          {/* ─── Right: Form / Detail Panel ───────────────── */}
          <div className="flex-1 overflow-y-auto">
            {showForm ? (
              <CategoryForm
                  token={token}
                  isCreating={isCreating}
                  selectedCategory={selectedCategory}
                  flatCategories={flatCategories || []}


                  onCancel={() => { setSelectedId(null); setIsCreating(false); }}
                  onSuccess={() => { setSelectedId(null); setIsCreating(false); queryClient.invalidateQueries({ queryKey: ['categories'] }); queryClient.invalidateQueries({ queryKey: ['categories-tree'] }); }}
                  onDelete={async () => { if(confirm('Delete category?')) { await api.deleteCategory(token, selectedId!); setSelectedId(null); setIsCreating(false); queryClient.invalidateQueries({ queryKey: ['categories'] }); queryClient.invalidateQueries({ queryKey: ['categories-tree'] }); } }}
                  onSelectNode={handleSelect}
                  onStartCreateChild={handleStartCreate}
                />
            ) : (
              /* Empty state — no selection */
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                  <FolderTree className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Select a category to edit
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Or click below to create a new category
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleStartCreate()}
                    className="gap-1.5 text-xs mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Category
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
