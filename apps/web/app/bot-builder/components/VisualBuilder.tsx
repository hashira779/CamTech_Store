import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState, addEdge,
  Connection, Node, Edge, MarkerType,
  ReactFlowProvider, Handle, Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Save, Upload, Undo2, Redo2, CheckCircle2,
  AlertTriangle, Play, Eye,
} from 'lucide-react';
import type { BotWorkflowDto } from '@mystore/contracts';
import { NodeLibrary } from './NodeLibrary';
import { NodeConfigPanel } from './NodeConfigPanel';
import { TelegramPreview } from './TelegramPreview';

const token = () => localStorage.getItem('token') || '';
const API = 'http://localhost:4000/api/v1';

// ─── Custom Node Component ──────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  start: '#22c55e', command_received: '#22c55e', message_received: '#22c55e',
  callback_query: '#22c55e', webhook_received: '#22c55e',
  send_message: '#3b82f6', edit_message: '#3b82f6', delete_message: '#3b82f6',
  show_inline_keyboard: '#8b5cf6', show_reply_keyboard: '#8b5cf6',
  remove_keyboard: '#8b5cf6', answer_callback: '#8b5cf6',
  send_photo: '#0ea5e9', send_document: '#0ea5e9', send_location: '#0ea5e9',
  wait_input: '#f59e0b', wait_choice: '#f59e0b',
  condition: '#ef4444', switch: '#ef4444',
  set_variable: '#06b6d4', api_call: '#06b6d4',
  delay: '#a855f7',
};

const NODE_ICONS: Record<string, string> = {
  start: '🚀', command_received: '⌘', message_received: '💬',
  callback_query: '👆', webhook_received: '🔗',
  send_message: '📤', edit_message: '✏️', delete_message: '🗑️',
  show_inline_keyboard: '⌨️', show_reply_keyboard: '🎹',
  remove_keyboard: '🚫', answer_callback: '✅',
  send_photo: '📸', send_document: '📄', send_location: '📍',
  wait_input: '⏳', wait_choice: '☝️',
  condition: '🔀', switch: '🔃',
  set_variable: '📝', api_call: '🌐', delay: '⏱️',
};

function BotNode({ data, selected }: { data: any; selected: boolean }) {
  const color = NODE_COLORS[data.nodeType] || '#818cf8';
  const icon = NODE_ICONS[data.nodeType] || '⚡';
  const isTrigger = ['start', 'command_received', 'message_received', 'callback_query', 'webhook_received'].includes(data.nodeType);
  const isCondition = data.nodeType === 'condition';

  return (
    <div style={{
      background: '#1e293b',
      border: `2px solid ${selected ? color : 'rgba(148,163,184,0.15)'}`,
      borderRadius: 12, minWidth: 180, overflow: 'visible', position: 'relative',
      boxShadow: selected ? `0 0 20px ${color}40` : '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: '#818cf8', width: 10, height: 10, border: '2px solid #0f172a' }}
        />
      )}

      <div style={{
        padding: '8px 12px', background: `${color}20`,
        borderBottom: `1px solid ${color}30`,
        borderTopLeftRadius: 10, borderTopRightRadius: 10,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {(data.nodeType || '').replace(/_/g, ' ')}
        </span>
      </div>

      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
          {data.label || 'Untitled'}
        </div>
        {data.config?.message && (
          <div style={{
            fontSize: 11, color: '#94a3b8', marginTop: 4,
            maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data.config.message.substring(0, 40)}
          </div>
        )}
        {data.config?.command && (
          <div style={{ fontSize: 11, color: '#818cf8', marginTop: 4, fontFamily: 'monospace' }}>
            {data.config.command}
          </div>
        )}
      </div>

      {isCondition ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 14px 8px', fontSize: 10, fontWeight: 700 }}>
          <span style={{ color: '#22c55e', position: 'relative' }}>
            TRUE
            <Handle
              type="source"
              position={Position.Bottom}
              id="true"
              style={{ left: 14, background: '#22c55e', width: 10, height: 10, border: '2px solid #0f172a' }}
            />
          </span>
          <span style={{ color: '#ef4444', position: 'relative' }}>
            FALSE
            <Handle
              type="source"
              position={Position.Bottom}
              id="false"
              style={{ left: 14, background: '#ef4444', width: 10, height: 10, border: '2px solid #0f172a' }}
            />
          </span>
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: color, width: 10, height: 10, border: '2px solid #0f172a' }}
        />
      )}
    </div>
  );
}

const nodeTypes = { botNode: BotNode };

// ─── Convert stored nodes ↔ React Flow nodes ─────────────────────────────────

function toFlowNodes(stored: any[]): Node[] {
  return (stored || []).map(n => ({
    id: n.id,
    type: 'botNode',
    position: n.position || { x: 0, y: 0 },
    data: {
      label: n.data?.label || n.type || '',
      nodeType: n.type,
      config: n.data?.config || {},
    },
  }));
}

function toFlowEdges(stored: any[]): Edge[] {
  return (stored || []).map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || undefined,
    targetHandle: e.targetHandle || undefined,
    animated: true,
    style: { stroke: '#818cf8', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
  }));
}

function toStoredNodes(flowNodes: Node[]): any[] {
  return flowNodes.map(n => ({
    id: n.id,
    type: n.data?.nodeType || n.type,
    position: n.position,
    data: {
      label: n.data?.label || '',
      config: n.data?.config || {},
    },
  }));
}

function toStoredEdges(flowEdges: Edge[]): any[] {
  return flowEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || null,
    targetHandle: e.targetHandle || null,
  }));
}

// ─── Visual Builder ─────────────────────────────────────────────────────────

function BuilderInner({ workflow, onUpdate }: { workflow: BotWorkflowDto; onUpdate: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(workflow.draftNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(workflow.draftEdges));
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({
      ...connection,
      animated: true,
      style: { stroke: '#818cf8', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
    }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Drag & drop from library
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData('application/bot-node-type');
    const label = event.dataTransfer.getData('application/bot-node-label');
    if (!nodeType) return;

    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;

    const position = {
      x: event.clientX - bounds.left - 90,
      y: event.clientY - bounds.top - 30,
    };

    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: 'botNode',
      position,
      data: { label: label || nodeType, nodeType, config: {} },
    };
    setNodes(nds => [...nds, newNode]);
  }, [setNodes]);

  // Save draft
  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/bot-builder/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftNodes: toStoredNodes(nodes),
          draftEdges: toStoredEdges(edges),
        }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('error'); }
    setSaving(false);
  };

  // Publish
  const handlePublish = async () => {
    // Save first
    await handleSave();
    setPublishing(true);
    try {
      const res = await fetch(`${API}/bot-builder/workflows/${workflow.id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' }),
      });
      const body = await res.json();
      if (body.success !== false) {
        onUpdate();
      }
    } catch (e) { console.error(e); }
    setPublishing(false);
  };

  // Update node config
  const handleNodeConfigChange = useCallback((nodeId: string, config: any, label?: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const d = (n.data || {}) as Record<string, any>;
        return {
          ...n,
          data: {
            ...d,
            config: { ...(d.config || {}), ...config },
            label: label || d.label,
          },
        };
      }
      return n;
    }));
    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode(prev => {
        if (!prev) return null;
        const d = (prev.data || {}) as Record<string, any>;
        return {
          ...prev,
          data: {
            ...d,
            config: { ...(d.config || {}), ...config },
            label: label || d.label,
          },
        };
      });
    }
  }, [setNodes, selectedNode]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: Node Library */}
      <NodeLibrary />

      {/* Center: Canvas */}
      <div ref={reactFlowWrapper} style={{ flex: 1 }} onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[20, 20]}
          style={{ background: '#0c1222' }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#818cf8', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
          }}
        >
          <Background color="#1e293b" gap={20} size={1} />
          <Controls
            style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10 }}
          />
          <MiniMap
            nodeColor="#818cf8"
            maskColor="rgba(15,23,42,0.8)"
            style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10 }}
          />

          {/* Toolbar */}
          <Panel position="top-right">
            <div style={{
              display: 'flex', gap: 8, background: 'rgba(30,41,59,0.9)',
              padding: '8px 12px', borderRadius: 12,
              border: '1px solid rgba(148,163,184,0.12)',
              backdropFilter: 'blur(8px)',
            }}>
              <button onClick={() => setShowPreview(p => !p)} style={toolbarBtn(showPreview)}>
                <Eye size={15} /> Preview
              </button>
              <div style={{ width: 1, background: 'rgba(148,163,184,0.15)' }} />
              <button onClick={handleSave} disabled={saving} style={toolbarBtn(false)}>
                <Save size={15} />
                {saving ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save Draft'}
              </button>
              <button onClick={handlePublish} disabled={publishing}
                style={{
                  ...toolbarBtn(false),
                  background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                  color: '#fff',
                }}
              >
                <Upload size={15} /> {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right: Config Panel or Preview */}
      <div style={{
        width: selectedNode ? 320 : (showPreview ? 300 : 0),
        transition: 'width 0.2s',
        overflow: 'hidden',
        borderLeft: '1px solid rgba(148,163,184,0.08)',
        background: 'rgba(15,23,42,0.5)',
      }}>
        {selectedNode ? (
          <NodeConfigPanel
            node={selectedNode}
            onChange={handleNodeConfigChange}
            onClose={() => setSelectedNode(null)}
          />
        ) : showPreview ? (
          <TelegramPreview nodes={nodes} edges={edges} />
        ) : null}
      </div>
    </div>
  );
}

function toolbarBtn(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    background: active ? 'rgba(129,140,248,0.15)' : 'transparent',
    color: active ? '#818cf8' : '#94a3b8',
    transition: 'background 0.15s',
  };
}

// ─── Exported Component ─────────────────────────────────────────────────────

export function VisualBuilder({ workflow, onUpdate }: { workflow: BotWorkflowDto; onUpdate: () => void }) {
  return (
    <ReactFlowProvider>
      <BuilderInner workflow={workflow} onUpdate={onUpdate} />
    </ReactFlowProvider>
  );
}
