'use client';

import React, { useState, useMemo, useCallback } from 'react';
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

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSeoTitle, setFormSeoTitle] = useState('');
  const [formSeoDescription, setFormSeoDescription] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

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
  const resetForm = useCallback(() => {
    setFormName('');
    setFormDescription('');
    setFormSlug('');
    setFormIcon('');
    setFormImageUrl('');
    setFormSeoTitle('');
    setFormSeoDescription('');
    setFormParentId('');
    setFormIsActive(true);
    setError(null);
  }, []);

  const loadCategory = useCallback((cat: CategoryDto) => {
    setFormName(cat.name);
    setFormDescription(cat.description ?? '');
    setFormSlug(cat.slug ?? '');
    setFormIcon(cat.icon ?? '');
    setFormImageUrl(cat.imageUrl ?? '');
    setFormSeoTitle(cat.seoTitle ?? '');
    setFormSeoDescription(cat.seoDescription ?? '');
    setFormParentId(cat.parentId ?? '');
    setFormIsActive(cat.isActive);
    setIsCreating(false);
    setError(null);
  }, []);

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
        resetForm();
        return;
      }
      setSelectedId(id);
      setIsCreating(false);
      const cat = flatCategories?.find((c) => c.id === id);
      if (cat) {
        loadCategory(cat);
      } else if (treeData) {
        const fromTree = findNodeInTree(treeData, id);
        if (fromTree) {
          loadCategory({
            ...fromTree,
            organizationId: '',
            breadcrumb: [],
          } as CategoryDto);
        }
      }
    },
    [selectedId, isCreating, flatCategories, treeData, loadCategory, resetForm]
  );

  const handleStartCreate = useCallback(
    (parentId?: string) => {
      resetForm();
      setSelectedId(null);
      setIsCreating(true);
      if (parentId) setFormParentId(parentId);
    },
    [resetForm]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const input: CreateCategoryInput = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        parentId: formParentId || undefined,
        slug: formSlug.trim() || undefined,
        icon: formIcon || undefined,
        imageUrl: formImageUrl.trim() || undefined,
        seoTitle: formSeoTitle.trim() || undefined,
        seoDescription: formSeoDescription.trim() || undefined,
      };
      const created = await api.createCategory(token, input);
      invalidateAll();
      resetForm();
      setIsCreating(false);
      setSelectedId(created.id);
      // Auto-expand parent
      if (created.parentId) {
        setExpandedIds((prev) => new Set([...prev, created.parentId!]));
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !formName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const input: UpdateCategoryInput = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        parentId: formParentId || undefined,
        slug: formSlug.trim() || undefined,
        icon: formIcon || undefined,
        imageUrl: formImageUrl.trim() || undefined,
        seoTitle: formSeoTitle.trim() || undefined,
        seoDescription: formSeoDescription.trim() || undefined,
        isActive: formIsActive,
      };
      await api.updateCategory(token, selectedId, input);
      invalidateAll();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const catName = selectedCategory?.name ?? '';
    if (!confirm(`Delete "${catName}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await api.deleteCategory(token, selectedId);
      setSelectedId(null);
      setIsCreating(false);
      resetForm();
      invalidateAll();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete category');
    }
  };

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
              <form
                onSubmit={isCreating ? handleCreate : handleUpdate}
                className="p-5 space-y-4 animate-in fade-in slide-in-from-right-2 duration-200"
              >
                {/* Breadcrumb bar */}
                {!isCreating && breadcrumb.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pb-2 border-b border-border">
                    {breadcrumb.map((item, idx) => (
                      <React.Fragment key={item.id}>
                        {idx > 0 && <span className="text-muted-foreground/40">›</span>}
                        <span
                          className={`cursor-pointer hover:text-primary transition-colors ${
                            idx === breadcrumb.length - 1
                              ? 'text-primary font-semibold'
                              : ''
                          }`}
                          onClick={() => handleSelect(item.id)}
                        >
                          {item.name}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {/* Form header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="text-lg">{getCategoryIcon(formIcon)}</span>
                    {isCreating ? 'New Category' : `Edit: ${formName}`}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {!isCreating && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1"
                        onClick={handleDelete}
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setSelectedId(null);
                        setIsCreating(false);
                        resetForm();
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Core fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Category Name *
                    </label>
                    <input
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Specialty Coffee"
                      className="input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      URL Slug
                    </label>
                    <input
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      placeholder="auto-generated from name"
                      className="input w-full text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Icon
                    </label>
                    <IconPicker value={formIcon} onChange={setFormIcon} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Parent Category
                    </label>
                    <select
                      value={formParentId}
                      onChange={(e) => setFormParentId(e.target.value)}
                      className="input w-full text-xs"
                    >
                      <option value="">(Root — Top Level)</option>
                      {(flatCategories ?? [])
                        .filter((c) => c.id !== selectedId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {'  '.repeat(c.level)}{getCategoryIcon(c.icon)} {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Description
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Brief description of this category"
                      className="input w-full text-xs min-h-[60px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Image URL
                    </label>
                    <input
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="input w-full text-xs"
                    />
                  </div>

                  {/* Active toggle */}
                  {!isCreating && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
                      <div>
                        <p className="text-xs font-medium text-foreground">Active</p>
                        <p className="text-[10px] text-muted-foreground">
                          Inactive categories are hidden from storefront
                        </p>
                      </div>
                      <Switch
                        checked={formIsActive}
                        onCheckedChange={setFormIsActive}
                      />
                    </div>
                  )}
                </div>

                {/* SEO section */}
                <div className="pt-2 border-t border-border space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    SEO & Meta
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        SEO Title
                      </label>
                      <input
                        value={formSeoTitle}
                        onChange={(e) => setFormSeoTitle(e.target.value)}
                        placeholder="Page title for search engines"
                        className="input w-full text-xs"
                        maxLength={200}
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formSeoTitle.length}/200
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        SEO Description
                      </label>
                      <textarea
                        value={formSeoDescription}
                        onChange={(e) => setFormSeoDescription(e.target.value)}
                        placeholder="Meta description for search engine results"
                        className="input w-full text-xs min-h-[50px]"
                        maxLength={1000}
                      />
                    </div>
                  </div>
                </div>

                {/* Stats (edit mode only) */}
                {!isCreating && selectedCategory && (
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                    <div className="text-center p-2 rounded-lg bg-muted/20 border border-border">
                      <p className="text-lg font-bold font-mono text-foreground">
                        {selectedCategory.productCount}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Products</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/20 border border-border">
                      <p className="text-lg font-bold font-mono text-foreground">
                        {selectedCategory.level}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Depth Level</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/20 border border-border">
                      <p className="text-lg font-bold font-mono text-foreground">
                        {selectedCategory.childrenCount ?? 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Sub-categories</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  {!isCreating && selectedId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={() => handleStartCreate(selectedId)}
                    >
                      <Plus className="w-3 h-3" />
                      Add Child
                    </Button>
                  )}
                  {isCreating && <div />}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedId(null);
                        setIsCreating(false);
                        resetForm();
                      }}
                      disabled={loading}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={loading} className="text-xs gap-1">
                      <Check className="w-3 h-3" />
                      {loading ? 'Saving…' : isCreating ? 'Create' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </form>
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
