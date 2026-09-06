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
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { NodeLibrary } from './NodeLibrary';
import { NodeConfigPanel } from './NodeConfigPanel';
import { TelegramPreview } from './TelegramPreview';

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
  const isCondition = data.nodeType === 'condition';

  return (
    <div style={{
      background: '#1e293b',
      border: `2px solid ${selected ? color : 'rgba(148,163,184,0.15)'}`,
      borderRadius: 12, minWidth: 180, overflow: 'visible', position: 'relative',
      boxShadow: selected ? `0 0 20px ${color}40` : '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {/* Top Input Handle — enabled on all nodes so any node can receive connections */}
      <Handle
        type="target"
        position={Position.Top}
        title="Input (connect previous step here)"
        style={{
          background: '#818cf8',
          width: 14,
          height: 14,
          border: '2px solid #0f172a',
          cursor: 'crosshair',
          zIndex: 10,
          boxShadow: '0 0 8px rgba(129, 140, 248, 0.7)',
        }}
      />

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
              title="True branch (drag to connect)"
              style={{
                left: 14,
                background: '#22c55e',
                width: 14,
                height: 14,
                border: '2px solid #0f172a',
                cursor: 'crosshair',
                zIndex: 10,
                boxShadow: '0 0 8px rgba(34, 197, 94, 0.7)',
              }}
            />
          </span>
          <span style={{ color: '#ef4444', position: 'relative' }}>
            FALSE
            <Handle
              type="source"
              position={Position.Bottom}
              id="false"
              title="False branch (drag to connect)"
              style={{
                left: 14,
                background: '#ef4444',
                width: 14,
                height: 14,
                border: '2px solid #0f172a',
                cursor: 'crosshair',
                zIndex: 10,
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.7)',
              }}
            />
          </span>
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          title="Output (drag to connect next step)"
          style={{
            background: color,
            width: 14,
            height: 14,
            border: '2px solid #0f172a',
            cursor: 'crosshair',
            zIndex: 10,
            boxShadow: `0 0 8px ${color}80`,
          }}
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
  const { token } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(workflow.draftNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(workflow.draftEdges));
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setEdges(eds => addEdge({
      ...connection,
      animated: true,
      style: { stroke: '#818cf8', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
    }, eds));
  }, [setEdges]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

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
      const activeToken = token || useAuth.getState().token || '';
      await api.updateBotWorkflow(activeToken, workflow.id, {
        draftNodes: toStoredNodes(nodes),
        draftEdges: toStoredEdges(edges),
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
      const activeToken = token || useAuth.getState().token || '';
      await api.publishBotWorkflow(activeToken, workflow.id, { notes: '' });
      onUpdate();
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

  const handleAddNode = useCallback((nodeType: string, label: string) => {
    const yOffset = nodes.length * 100;
    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: 'botNode',
      position: { x: 200, y: 80 + (yOffset % 400) },
      data: { label: label || nodeType, nodeType, config: {} },
    };
    setNodes(nds => [...nds, newNode]);
  }, [nodes.length, setNodes]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: Node Library */}
      <NodeLibrary onAddNode={handleAddNode} />

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
          snapGrid={[15, 15]}
          deleteKeyCode={['Backspace', 'Delete']}
          connectionLineStyle={{ stroke: '#818cf8', strokeWidth: 2 }}
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

          {/* Empty Canvas Guide */}
          {nodes.length === 0 && (
            <Panel position="top-center">
              <div style={{
                marginTop: 80,
                textAlign: 'center',
                padding: '24px 32px',
                background: 'rgba(30,41,59,0.92)',
                borderRadius: 16,
                border: '1px dashed rgba(129,140,248,0.4)',
                backdropFilter: 'blur(12px)',
                maxWidth: 440,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
                  Your Canvas is Empty
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                  1. Click <strong>+ Add</strong> on <strong>Bot Started</strong> (left panel).<br />
                  2. Open <strong>Telegram</strong> tab and click <strong>Show Inline Keyboard</strong>.<br />
                  3. Drag from bottom dot of <em>Bot Started</em> to top dot of <em>Show Inline Keyboard</em>!
                </div>
              </div>
            </Panel>
          )}

          {/* Helpful connection guide */}
          <Panel position="bottom-center">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(15,23,42,0.92)', padding: '7px 16px', borderRadius: 20,
              border: '1px solid rgba(129,140,248,0.25)', backdropFilter: 'blur(8px)',
              fontSize: 12, color: '#cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              pointerEvents: 'none', userSelect: 'none',
            }}>
              <span style={{ fontSize: 14 }}>💡</span>
              <span>
                <strong>Connecting:</strong> Drag from bottom dot (<span style={{ color: '#22c55e', fontWeight: 700 }}>●</span> Output) to top dot (<span style={{ color: '#818cf8', fontWeight: 700 }}>●</span> Input)
              </span>
            </div>
          </Panel>

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

        <style>{`
          .react-flow__handle {
            transition: transform 0.15s ease, box-shadow 0.15s ease !important;
          }
          .react-flow__handle:hover {
            transform: scale(1.35) !important;
          }
        `}</style>
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
            onDelete={handleDeleteNode}
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
