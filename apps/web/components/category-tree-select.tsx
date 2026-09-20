'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { CategoryTreeNodeDto } from '@mystore/contracts';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  ChevronDown,
  FolderTree,
  Check,
  ChevronsUpDown,
} from 'lucide-react';

// ─── Common category icon map ──────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  coffee: '☕', tea: '🍵', food: '🍔', drink: '🥤', bakery: '🥐',
  electronics: '📱', clothing: '👕', shoes: '👟', accessories: '💍',
  grocery: '🛒', beauty: '💄', health: '💊', sports: '⚽',
  toys: '🧸', books: '📚', music: '🎵', home: '🏠', garden: '🌿',
  automotive: '🚗', tools: '🔧', office: '📎', pet: '🐾',
  jewelry: '💎', furniture: '🪑', kitchen: '🍳', baby: '👶',
};

export function getCategoryIcon(icon?: string | null): string {
  if (!icon) return '📁';
  // Check our built-in map first
  if (CATEGORY_ICONS[icon.toLowerCase()]) return CATEGORY_ICONS[icon.toLowerCase()];
  // If icon is already an emoji (starts with non-ASCII), use it directly
  if (icon.codePointAt(0)! > 255) return icon;
  return '📁';
}

// ─── Breadcrumb builder from flat tree ─────────────────────────
function buildBreadcrumbFromTree(
  nodes: CategoryTreeNodeDto[],
  targetId: string,
  path: Array<{ id: string; name: string }> = []
): Array<{ id: string; name: string }> | null {
  for (const node of nodes) {
    const currentPath = [...path, { id: node.id, name: node.name }];
    if (node.id === targetId) return currentPath;
    if (node.children?.length) {
      const found = buildBreadcrumbFromTree(node.children, targetId, currentPath);
      if (found) return found;
    }
  }
  return null;
}

// Find a node by ID in a tree
function findNodeInTree(nodes: CategoryTreeNodeDto[], id: string): CategoryTreeNodeDto | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNodeInTree(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ─── Tree Node ─────────────────────────────────────────────────
function TreeNode({
  node,
  depth,
  selectedId,
  expandedIds,
  onToggleExpand,
  onSelect,
}: {
  node: CategoryTreeNodeDto;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        type="button"
        className={`
          w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-all duration-150
          ${isSelected
            ? 'bg-primary/10 text-primary font-semibold ring-1 ring-primary/20'
            : 'hover:bg-muted/60 text-foreground'
          }
          ${!node.isActive ? 'opacity-50' : ''}
        `}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <span
            className="shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Icon */}
        <span className="text-sm shrink-0">{getCategoryIcon(node.icon)}</span>

        {/* Name */}
        <span className="truncate flex-1">{node.name}</span>

        {/* Product count */}
        {node.productCount > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono shrink-0">
            {node.productCount}
          </Badge>
        )}

        {/* Selection check */}
        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-150">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export function CategoryTreeSelect({
  value,
  onChange,
  treeData,
  placeholder = 'Select category...',
  disabled = false,
}: {
  value: string | null | undefined;
  onChange: (categoryId: string | null) => void;
  treeData: CategoryTreeNodeDto[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Auto-expand path to selected value
    if (!value) return new Set<string>();
    const breadcrumb = buildBreadcrumbFromTree(treeData, value);
    return new Set(breadcrumb?.map((b) => b.id) || []);
  });

  const selectedNode = useMemo(
    () => (value ? findNodeInTree(treeData, value) : null),
    [value, treeData]
  );

  const breadcrumb = useMemo(
    () => (value ? buildBreadcrumbFromTree(treeData, value) : null),
    [value, treeData]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id === value ? null : id);
      setOpen(false);
    },
    [onChange, value]
  );

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-sm font-normal h-9"
            disabled={disabled}
          >
            <span className="flex items-center gap-2 truncate">
              {selectedNode ? (
                <>
                  <span>{getCategoryIcon(selectedNode.icon)}</span>
                  <span>{selectedNode.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="max-h-[280px] overflow-y-auto p-1">
            {/* Clear option */}
            <button
              type="button"
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                !value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-muted-foreground'
              }`}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>(No Category / General)</span>
              {!value && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
            </button>

            <div className="h-px bg-border my-1" />

            {treeData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No categories defined yet.
              </p>
            ) : (
              treeData.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={value || null}
                  expandedIds={expandedIds}
                  onToggleExpand={toggleExpand}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Breadcrumb trail */}
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground overflow-x-auto">
          {breadcrumb.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <span className="text-muted-foreground/50">›</span>}
              <span
                className={
                  idx === breadcrumb.length - 1
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground'
                }
              >
                {item.name}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export { CATEGORY_ICONS, buildBreadcrumbFromTree, findNodeInTree };
