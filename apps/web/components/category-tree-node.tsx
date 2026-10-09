import React from 'react';
import { type CategoryTreeNodeDto } from '@mystore/contracts';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronRight,
  Package,
  Plus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { getCategoryIcon } from '@/components/category-tree-select';

export function CategoryTreeNode({
  node,
  depth,
  selectedId,
  expandedIds,
  onToggleExpand,
  onSelect,
  onAddChild,
  onMoveUp,
  onMoveDown,
  matchingIds,
}: {
  node: CategoryTreeNodeDto;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  matchingIds?: Set<string>;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isMatch = matchingIds?.has(node.id);

  return (
    <div className="animate-in fade-in duration-200">
      <div
        className={`
          group flex items-center gap-1.5 pr-2 py-1 rounded-lg cursor-pointer transition-all duration-150
          ${isSelected
            ? 'bg-primary/10 ring-1 ring-primary/20 shadow-sm'
            : isMatch
            ? 'bg-amber-500/10 ring-1 ring-amber-500/20'
            : 'hover:bg-muted/40'
          }
          ${!node.isActive ? 'opacity-50' : ''}
        `}
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
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

        {/* Quick Context Actions (visible on hover) */}
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          {onAddChild && (
            <button
              type="button"
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-primary/20 hover:text-primary text-muted-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id);
              }}
              title={`Add child under ${node.name}`}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
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
              onAddChild={onAddChild}
              onMoveUp={idx > 0 ? onMoveUp : undefined}
              onMoveDown={idx < node.children.length - 1 ? onMoveDown : undefined}
              matchingIds={matchingIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
