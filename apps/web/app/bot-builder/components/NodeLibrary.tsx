import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { NODE_LIBRARY } from '@mystore/contracts';

const ALL_CATEGORIES = [
  'All',
  'Triggers',
  'Telegram',
  'Catalog',
  'Orders',
  'Payments',
  'Delivery',
  'CRM',
  'Support',
  'Input',
  'Logic',
  'Data',
];

const CATEGORY_COLORS: Record<string, string> = {
  Triggers: '#22c55e',
  Telegram: '#3b82f6',
  Catalog: '#06b6d4',
  Orders: '#f59e0b',
  Payments: '#10b981',
  Delivery: '#8b5cf6',
  CRM: '#ec4899',
  Support: '#ef4444',
  Input: '#eab308',
  Logic: '#6366f1',
  Data: '#14b8a6',
};

interface NodeLibraryProps {
  onAddNode?: (nodeType: string, label: string) => void;
}

export function NodeLibrary({ onAddNode }: NodeLibraryProps = {}) {
  const [search, setSearch] = useState('');
  const [selectedPill, setSelectedPill] = useState('All');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    Triggers: true,
    Telegram: true,
    Catalog: true,
    Orders: true,
  });

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const filtered = NODE_LIBRARY.filter(n => {
    const matchesSearch = !search ||
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase()) ||
      n.category.toLowerCase().includes(search.toLowerCase());
    const matchesPill = selectedPill === 'All' || n.category === selectedPill;
    return matchesSearch && matchesPill;
  });

  // Group filtered nodes by category
  const categoriesPresent = Array.from(new Set(filtered.map(n => n.category)));

  const onDragStart = (event: React.DragEvent, type: string, label: string) => {
    event.dataTransfer.setData('application/bot-node-type', type);
    event.dataTransfer.setData('application/bot-node-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{
      width: 270, borderRight: '1px solid rgba(148,163,184,0.1)',
      background: 'rgba(15,23,42,0.95)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={14} color="#818cf8" />
            Node Library
          </div>
          <span style={{ fontSize: 10, color: '#818cf8', fontWeight: 700, background: 'rgba(129,140,248,0.12)', padding: '2px 8px', borderRadius: 10 }}>
            {NODE_LIBRARY.length} Nodes
          </span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search 40+ business nodes..."
            style={{
              width: '100%', padding: '7px 10px 7px 30px',
              background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: 8, color: '#f1f5f9', fontSize: 12, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter Pills (Scrollable) */}
        <div style={{
          display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4,
          scrollbarWidth: 'none',
        }}>
          {ALL_CATEGORIES.map(pill => {
            const isSelected = selectedPill === pill;
            return (
              <button
                key={pill}
                type="button"
                onClick={() => setSelectedPill(pill)}
                style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                  whiteSpace: 'nowrap', border: 'none', cursor: 'pointer',
                  background: isSelected ? '#818cf8' : 'rgba(30,41,59,0.6)',
                  color: isSelected ? '#ffffff' : '#94a3b8',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {pill}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nodes list by Category */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {categoriesPresent.map(cat => {
          const items = filtered.filter(n => n.category === cat);
          if (items.length === 0) return null;
          const isExpanded = (expandedCats[cat] ?? true) || !!search;
          const color = CATEGORY_COLORS[cat] || '#818cf8';

          return (
            <div key={cat} style={{ marginBottom: 6 }}>
              <button
                onClick={() => toggleCat(cat)}
                style={{
                  width: '100%', padding: '6px 10px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  color: '#cbd5e1', fontSize: 11, fontWeight: 700,
                  textAlign: 'left', borderRadius: 6,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  {cat}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>{items.length}</span>
                  {isExpanded ? <ChevronDown size={12} color="#64748b" /> : <ChevronRight size={12} color="#64748b" />}
                </div>
              </button>

              {isExpanded && (
                <div style={{ padding: '2px 4px 4px' }}>
                  {items.map(node => (
                    <div
                      key={node.type}
                      draggable
                      onDragStart={e => onDragStart(e, node.type, node.label)}
                      onClick={() => onAddNode?.(node.type, node.label)}
                      title="Click to add to canvas (or drag & drop)"
                      style={{
                        padding: '7px 9px', marginBottom: 3, borderRadius: 8,
                        background: 'rgba(30,41,59,0.5)',
                        border: '1px solid transparent',
                        cursor: 'pointer', fontSize: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = `${color}80`;
                        e.currentTarget.style.background = 'rgba(30,41,59,0.9)';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.background = 'rgba(30,41,59,0.5)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{node.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.label}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.description}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color,
                        padding: '2px 6px', borderRadius: 4, background: `${color}15`,
                        marginLeft: 6, flexShrink: 0,
                      }}>
                        + Add
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid rgba(148,163,184,0.08)',
        fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 1.4,
        background: 'rgba(30,41,59,0.3)',
      }}>
        💡 <strong>Click</strong> or <strong>drag</strong> any node to canvas
      </div>
    </div>
  );
}
