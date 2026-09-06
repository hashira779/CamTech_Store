import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState, addEdge,
  Connection, Node, Edge, MarkerType,
  ReactFlowProvider, Handle, Position, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Save, Upload, Eye, Wand2, Trash2, BookOpen,
  CheckCircle2, AlertCircle, X, Sparkles,
} from 'lucide-react';
import { BotWorkflowDto, WORKFLOW_TEMPLATES, WorkflowTemplate } from '@mystore/contracts';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { NodeLibrary } from './NodeLibrary';
import { NodeConfigPanel } from './NodeConfigPanel';
import { TelegramPreview } from './TelegramPreview';

// ─── Custom Node Styling & Icons for 40+ Nodes ──────────────────────────────

const NODE_COLORS: Record<string, string> = {
  // Triggers
  start: '#22c55e', command_received: '#22c55e', message_received: '#22c55e',
  callback_query: '#22c55e', webhook_received: '#22c55e',
  order_created_trigger: '#22c55e', payment_received_trigger: '#22c55e', delivery_update_trigger: '#22c55e',
  // Telegram UX
  send_message: '#3b82f6', edit_message: '#3b82f6', delete_message: '#3b82f6',
  show_inline_keyboard: '#8b5cf6', show_reply_keyboard: '#8b5cf6',
  remove_keyboard: '#8b5cf6', answer_callback: '#8b5cf6',
  send_photo: '#0ea5e9', send_document: '#0ea5e9', send_location: '#0ea5e9',
  chat_action: '#38bdf8', pin_message: '#38bdf8', request_contact: '#38bdf8',
  // Store & Catalog
  search_products: '#06b6d4', get_product: '#06b6d4', list_categories: '#06b6d4',
  check_stock: '#06b6d4', get_promotions: '#06b6d4',
  // Orders & Checkout
  get_order_status: '#f59e0b', list_recent_orders: '#f59e0b', create_order: '#f59e0b',
  cancel_order: '#f59e0b', generate_invoice: '#f59e0b',
  // Payments & KHQR
  generate_khqr: '#10b981', check_payment: '#10b981', confirm_cod: '#10b981', request_refund: '#10b981',
  // Delivery & Courier
  track_delivery: '#a855f7', estimate_delivery: '#a855f7', dispatch_courier: '#a855f7', confirm_delivery: '#a855f7',
  // CRM & Customers
  lookup_customer: '#ec4899', register_customer: '#ec4899', update_loyalty_points: '#ec4899', add_customer_note: '#ec4899',
  // Support & Team
  alert_admin: '#ef4444', agent_handoff: '#ef4444', create_support_ticket: '#ef4444',
  // Input
  wait_input: '#eab308', wait_choice: '#eab308',
  // Logic
  condition: '#6366f1', switch: '#6366f1', business_hours: '#6366f1', random_split: '#6366f1', delay: '#818cf8',
  // Data & APIs
  set_variable: '#14b8a6', api_call: '#14b8a6', format_currency: '#14b8a6',
};

const NODE_ICONS: Record<string, string> = {
  start: '🚀', command_received: '⌘', message_received: '💬',
  callback_query: '👆', webhook_received: '🔗',
  order_created_trigger: '📦', payment_received_trigger: '💰', delivery_update_trigger: '🚚',
  send_message: '📤', edit_message: '✏️', delete_message: '🗑️',
  show_inline_keyboard: '⌨️', show_reply_keyboard: '🎹',
  remove_keyboard: '🚫', answer_callback: '✅',
  send_photo: '📸', send_document: '📄', send_location: '📍',
  chat_action: '💬', pin_message: '📌', request_contact: '📞',
  search_products: '🔍', get_product: '🏷️', list_categories: '📑',
  check_stock: '📊', get_promotions: '🎁',
  get_order_status: '📋', list_recent_orders: '🧾', create_order: '🛒',
  cancel_order: '❌', generate_invoice: '📄',
  generate_khqr: '🇰🇭', check_payment: '💳', confirm_cod: '💵', request_refund: '🔄',
  track_delivery: '🗺️', estimate_delivery: '🛵', dispatch_courier: '📦', confirm_delivery: '🏁',
  lookup_customer: '👤', register_customer: '📝', update_loyalty_points: '⭐', add_customer_note: '🗒️',
  alert_admin: '🚨', agent_handoff: '🧑‍💼', create_support_ticket: '🎫',
  wait_input: '⏳', wait_choice: '☝️',
  condition: '🔀', switch: '🔃', business_hours: '🕒', random_split: '🎲', delay: '⏱️',
  set_variable: '📝', api_call: '🌐', format_currency: '💲',
};

function BotNode({ data, selected }: { data: any; selected: boolean }) {
  const color = NODE_COLORS[data.nodeType] || '#818cf8';
  const icon = NODE_ICONS[data.nodeType] || '⚡';
  const isCondition = data.nodeType === 'condition';

  return (
    <div style={{
      background: '#1e293b',
      border: `2px solid ${selected ? color : 'rgba(148,163,184,0.18)'}`,
      borderRadius: 12, minWidth: 190, overflow: 'visible', position: 'relative',
      boxShadow: selected ? `0 0 22px ${color}50` : '0 4px 14px rgba(0,0,0,0.35)',
      transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
    }}>
      {/* Top Input Handle — enabled on all nodes */}
      <Handle
        type="target"
        position={Position.Top}
        title="Input: Connect previous step here"
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
        borderBottom: `1px solid ${color}35`,
        borderTopLeftRadius: 10, borderTopRightRadius: 10,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {(data.nodeType || '').replace(/_/g, ' ')}
        </span>
      </div>

      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
          {data.label || 'Untitled'}
        </div>
        {data.config?.message && (
          <div style={{
            fontSize: 11, color: '#94a3b8', marginTop: 4,
            maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data.config.message.substring(0, 45)}
          </div>
        )}
        {data.config?.command && (
          <div style={{ fontSize: 11, color: '#818cf8', marginTop: 4, fontFamily: 'monospace' }}>
            {data.config.command}
          </div>
        )}
        {data.config?.buttons && data.config.buttons.length > 0 && (
          <div style={{ fontSize: 10, color: '#a5b4fc', marginTop: 4 }}>
            🔘 {data.config.buttons.length} button{data.config.buttons.length > 1 ? 's' : ''} configured
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
          title="Output: Drag to connect next step"
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
  const [showTemplates, setShowTemplates] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

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
      x: event.clientX - bounds.left - 95,
      y: event.clientY - bounds.top - 35,
    };

    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: 'botNode',
      position,
      data: { label: label || nodeType, nodeType, config: {} },
    };
    setNodes(nds => [...nds, newNode]);
  }, [setNodes]);

  // Auto-Organize Nodes into a clean vertical tree layout
  const handleAutoOrganize = useCallback(() => {
    if (nodes.length === 0) return;

    // Build adjacency and in-degree maps
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    nodes.forEach(n => {
      inDegree[n.id] = 0;
      adj[n.id] = [];
    });

    edges.forEach(e => {
      if (adj[e.source]) adj[e.source].push(e.target);
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    // Roots have 0 in-degree
    const roots = nodes.filter(n => (inDegree[n.id] || 0) === 0).map(n => n.id);
    if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0].id);

    // BFS to assign levels
    const levels: Record<number, string[]> = {};
    const visited = new Set<string>();
    const queue: { id: string; level: number }[] = roots.map(id => ({ id, level: 0 }));

    queue.forEach(item => visited.add(item.id));

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (!levels[level]) levels[level] = [];
      levels[level].push(id);

      const neighbors = adj[id] || [];
      neighbors.forEach(nbr => {
        if (!visited.has(nbr)) {
          visited.add(nbr);
          queue.push({ id: nbr, level: level + 1 });
        }
      });
    }

    // Assign any unvisited nodes to the last level
    nodes.forEach(n => {
      if (!visited.has(n.id)) {
        const lastLvl = Object.keys(levels).length;
        if (!levels[lastLvl]) levels[lastLvl] = [];
        levels[lastLvl].push(n.id);
      }
    });

    // Compute neat positions
    const posMap: Record<string, { x: number; y: number }> = {};
    Object.entries(levels).forEach(([lvlStr, nodeIds]) => {
      const lvl = parseInt(lvlStr);
      const totalWidth = nodeIds.length * 240;
      const startX = 350 - totalWidth / 2;
      const y = 60 + lvl * 160;

      nodeIds.forEach((id, idx) => {
        posMap[id] = {
          x: startX + idx * 240,
          y,
        };
      });
    });

    setNodes(nds => nds.map(n => ({
      ...n,
      position: posMap[n.id] || n.position,
    })));

    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
  }, [nodes, edges, setNodes, fitView]);

  // Clear Canvas
  const handleClearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setShowClearConfirm(false);
  }, [setNodes, setEdges]);

  // Load Template
  const handleLoadTemplate = useCallback((template: WorkflowTemplate) => {
    setNodes(toFlowNodes(template.nodes));
    setEdges(toFlowEdges(template.edges));
    setSelectedNode(null);
    setShowTemplates(false);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
  }, [setNodes, setEdges, fitView]);

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
    } catch {
      setSaveStatus('error');
    }
    setSaving(false);
  };

  // Publish
  const handlePublish = async () => {
    await handleSave();
    setPublishing(true);
    try {
      const activeToken = token || useAuth.getState().token || '';
      await api.publishBotWorkflow(activeToken, workflow.id, { notes: 'Published from Visual Builder' });
      onUpdate();
    } catch (e) {
      console.error(e);
    }
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
    const yOffset = nodes.length * 110;
    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: 'botNode',
      position: { x: 220, y: 70 + (yOffset % 450) },
      data: { label: label || nodeType, nodeType, config: {} },
    };
    setNodes(nds => [...nds, newNode]);
  }, [nodes.length, setNodes]);

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden' }}>
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
          style={{ background: '#0a0f1d' }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#818cf8', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
          }}
        >
          <Background color="#1e293b" gap={22} size={1} />
          <Controls
            style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10 }}
          />
          <MiniMap
            nodeColor="#818cf8"
            maskColor="rgba(10,15,29,0.85)"
            style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10 }}
          />

          {/* Empty Canvas Guide */}
          {nodes.length === 0 && (
            <Panel position="top-center">
              <div style={{
                marginTop: 90,
                textAlign: 'center',
                padding: '28px 36px',
                background: 'rgba(30,41,59,0.95)',
                borderRadius: 20,
                border: '1px dashed rgba(129,140,248,0.5)',
                backdropFilter: 'blur(16px)',
                maxWidth: 480,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🚀</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>
                  Your Flowchart is Ready
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 16 }}>
                  Start by clicking <strong>+ Add</strong> on any node from the left library, or load one of our ready-to-use business templates below!
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplates(true)}
                  style={{
                    padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                    border: 'none', color: '#fff', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  }}
                >
                  <Sparkles size={15} /> Load a Business Template
                </button>
              </div>
            </Panel>
          )}

          {/* Bottom Connection Guide */}
          <Panel position="bottom-center">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(15,23,42,0.95)', padding: '7px 18px', borderRadius: 24,
              border: '1px solid rgba(129,140,248,0.3)', backdropFilter: 'blur(12px)',
              fontSize: 12, color: '#cbd5e1', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              pointerEvents: 'none', userSelect: 'none',
            }}>
              <span style={{ fontSize: 14 }}>💡</span>
              <span>
                <strong>How to Connect:</strong> Drag from bottom dot (<span style={{ color: '#22c55e', fontWeight: 700 }}>● Output</span>) to top dot (<span style={{ color: '#818cf8', fontWeight: 700 }}>● Input</span>)
              </span>
            </div>
          </Panel>

          {/* Top-Right Super Action Toolbar */}
          <Panel position="top-right">
            <div style={{
              display: 'flex', gap: 6, background: 'rgba(30,41,59,0.95)',
              padding: '6px 10px', borderRadius: 12,
              border: '1px solid rgba(148,163,184,0.18)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              {/* Templates */}
              <button
                onClick={() => setShowTemplates(true)}
                title="Choose a ready-to-use business template"
                style={toolbarBtn(false)}
              >
                <BookOpen size={14} color="#818cf8" /> Templates
              </button>

              {/* Auto Organize */}
              <button
                onClick={handleAutoOrganize}
                title="Automatically organize nodes into a clean flowchart"
                style={toolbarBtn(false)}
              >
                <Wand2 size={14} color="#10b981" /> Tidy Flow
              </button>

              {/* Clear Canvas */}
              {nodes.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  title="Clear all nodes and start fresh"
                  style={toolbarBtn(false)}
                >
                  <Trash2 size={14} color="#ef4444" /> Clear
                </button>
              )}

              <div style={{ width: 1, height: 24, background: 'rgba(148,163,184,0.15)', alignSelf: 'center', margin: '0 2px' }} />

              {/* Toggle Telegram Live Preview */}
              <button
                onClick={() => setShowPreview(p => !p)}
                style={toolbarBtn(showPreview)}
                title="Toggle real-time Telegram preview"
              >
                <Eye size={14} /> Preview
              </button>

              {/* Save Draft */}
              <button
                onClick={handleSave}
                disabled={saving}
                style={toolbarBtn(false)}
              >
                <Save size={14} />
                {saving ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save Draft'}
              </button>

              {/* Publish to Production */}
              <button
                onClick={handlePublish}
                disabled={publishing}
                style={{
                  ...toolbarBtn(false),
                  background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                  color: '#fff', fontWeight: 600,
                  boxShadow: '0 2px 10px rgba(99,102,241,0.4)',
                }}
              >
                <Upload size={14} /> {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </Panel>
        </ReactFlow>

        <style>{`
          .react-flow__handle {
            transition: transform 0.15s ease, box-shadow 0.15s ease !important;
          }
          .react-flow__handle:hover {
            transform: scale(1.4) !important;
          }
        `}</style>
      </div>

      {/* Right: Config Panel or Live Telegram Preview */}
      <div style={{
        width: selectedNode ? 330 : (showPreview ? 310 : 0),
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        borderLeft: '1px solid rgba(148,163,184,0.1)',
        background: 'rgba(15,23,42,0.95)',
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

      {/* ─── Templates Modal ────────────────────────────────────────────── */}
      {showTemplates && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(129,140,248,0.3)',
            borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color="#818cf8" />
                  Enterprise Starter Templates
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  1-Click load ready-made business workflows built for e-commerce, tracking, and payments.
                </div>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Template Cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {WORKFLOW_TEMPLATES.map(tpl => (
                <div
                  key={tpl.id}
                  style={{
                    background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(148,163,184,0.14)',
                    borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between', transition: 'border-color 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#818cf8';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(148,163,184,0.14)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{tpl.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                      {tpl.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 12 }}>
                      {tpl.description}
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b' }}>
                      <span>📊 {tpl.nodes.length} Nodes</span>
                      <span>🔗 {tpl.edges.length} Connections</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLoadTemplate(tpl)}
                    style={{
                      marginTop: 14, padding: '8px 14px', borderRadius: 8,
                      background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.3)',
                      color: '#c7d2fe', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    Load This Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Clear Canvas Confirmation Modal ────────────────────────────── */}
      {showClearConfirm && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 14, width: '100%', maxWidth: 420, padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>
              Clear Canvas?
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to remove all {nodes.length} nodes and connections? This draft will start completely empty.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(148,163,184,0.2)',
                  color: '#94a3b8', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearCanvas}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer',
                }}
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toolbarBtn(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    background: active ? 'rgba(129,140,248,0.2)' : 'transparent',
    color: active ? '#c7d2fe' : '#94a3b8',
    transition: 'background 0.15s, color 0.15s',
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
