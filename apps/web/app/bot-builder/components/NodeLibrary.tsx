import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { NODE_LIBRARY } from '@mystore/contracts';

const categories = ['Triggers', 'Telegram', 'Input', 'Logic', 'Data'];

const CATEGORY_COLORS: Record<string, string> = {
  Triggers: '#22c55e',
  Telegram: '#3b82f6',
  Input: '#f59e0b',
  Logic: '#ef4444',
  Data: '#06b6d4',
};

export function NodeLibrary() {
  const [search, setSearch] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>('Triggers');

  const filtered = NODE_LIBRARY.filter(n =>
    !search || n.label.toLowerCase().includes(search.toLowerCase()) ||
    n.description.toLowerCase().includes(search.toLowerCase())
  );

  const onDragStart = (event: React.DragEvent, type: string, label: string) => {
    event.dataTransfer.setData('application/bot-node-type', type);
    event.dataTransfer.setData('application/bot-node-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{
      width: 240, borderRight: '1px solid rgba(148,163,184,0.08)',
      background: 'rgba(15,23,42,0.6)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Node Library
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: '#475569' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes..."
            style={{
              width: '100%', padding: '8px 10px 8px 30px',
              background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: 8, color: '#e2e8f0', fontSize: 12, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Categories */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {categories.map(cat => {
          const items = filtered.filter(n => n.category === cat);
          if (items.length === 0) return null;
          const isExpanded = expandedCat === cat || !!search;
          const color = CATEGORY_COLORS[cat] || '#818cf8';

          return (
            <div key={cat} style={{ marginBottom: 4 }}>
              <button
                onClick={() => setExpandedCat(isExpanded && !search ? null : cat)}
                style={{
                  width: '100%', padding: '8px 16px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  color: '#94a3b8', fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 0.8,
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  {cat}
                </span>
                <span style={{ fontSize: 10, color: '#475569' }}>{items.length}</span>
              </button>

              {isExpanded && (
                <div style={{ padding: '0 10px 4px' }}>
                  {items.map(node => (
                    <div
                      key={node.type}
                      draggable
                      onDragStart={e => onDragStart(e, node.type, node.label)}
                      style={{
                        padding: '8px 10px', marginBottom: 3, borderRadius: 8,
                        background: 'rgba(30,41,59,0.5)',
                        border: '1px solid transparent',
                        cursor: 'grab', fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = `${color}40`;
                        e.currentTarget.style.background = 'rgba(30,41,59,0.8)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.background = 'rgba(30,41,59,0.5)';
                      }}
                    >
                      <span style={{ fontSize: 14, width: 22, textAlign: 'center' }}>{node.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 12 }}>{node.label}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{node.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid rgba(148,163,184,0.06)',
        fontSize: 11, color: '#64748b', textAlign: 'center', lineHeight: 1.4,
      }}>
        💡 Drag nodes to canvas, then connect bottom dot to top dot
      </div>
    </div>
  );
}
