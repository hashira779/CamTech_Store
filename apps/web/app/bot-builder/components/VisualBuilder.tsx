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
  CheckCircle2, AlertCircle, X, Sparkles, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { BotWorkflowDto, WORKFLOW_TEMPLATES, WorkflowTemplate } from '@mystore/contracts';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { NodeLibrary } from './NodeLibrary';
import { NodeConfigPanel } from './NodeConfigPanel';
import { TelegramPreview } from './TelegramPreview';

// ─── Custom Node Styling & Icons for 40+ Nodes ──────────────────────────────

const NODE_COLORS: Record<string, string> = {
  // Triggers
  start: 'var(--success)', command_received: 'var(--success)', message_received: 'var(--success)',
  callback_query: 'var(--success)', webhook_received: 'var(--success)',
  order_created_trigger: 'var(--success)', payment_received_trigger: 'var(--success)', delivery_update_trigger: 'var(--success)',
  // Telegram UX
  send_message: 'var(--info)', edit_message: 'var(--info)', delete_message: 'var(--info)',
  show_inline_keyboard: '#8b5cf6', show_reply_keyboard: '#8b5cf6',
  remove_keyboard: '#8b5cf6', answer_callback: '#8b5cf6',
  send_photo: '#0ea5e9', send_document: '#0ea5e9', send_location: '#0ea5e9',
  chat_action: 'var(--info)', pin_message: 'var(--info)', request_contact: 'var(--info)',
  // Store & Catalog
  search_products: 'var(--info)', get_product: 'var(--info)', list_categories: 'var(--info)',
  check_stock: 'var(--info)', get_promotions: 'var(--info)',
  // Orders & Checkout
  get_order_status: 'var(--warning)', list_recent_orders: 'var(--warning)', create_order: 'var(--warning)',
  cancel_order: 'var(--warning)', generate_invoice: 'var(--warning)',
  // Payments & KHQR
  generate_khqr: 'var(--success)', check_payment: 'var(--success)', confirm_cod: 'var(--success)', request_refund: 'var(--success)',
  // Delivery & Courier
  track_delivery: '#a855f7', estimate_delivery: '#a855f7', dispatch_courier: '#a855f7', confirm_delivery: '#a855f7',
  // CRM & Customers
  lookup_customer: '#ec4899', register_customer: '#ec4899', update_loyalty_points: '#ec4899', add_customer_note: '#ec4899',
  // Support & Team
  alert_admin: 'var(--destructive)', agent_handoff: 'var(--destructive)', create_support_ticket: 'var(--destructive)',
  // Input
  wait_input: 'var(--warning)', wait_choice: 'var(--warning)',
  // Logic
  condition: 'var(--primary)', switch: 'var(--primary)', business_hours: 'var(--primary)', random_split: 'var(--primary)', delay: 'var(--primary)',
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
  const color = NODE_COLORS[data.nodeType] || 'var(--primary)';
  const icon = NODE_ICONS[data.nodeType] || '⚡';
  const isCondition = data.nodeType === 'condition';
  const isInlineKeyboard = data.nodeType === 'show_inline_keyboard';
  const buttons = (data.config?.buttons as any[]) || [];

  return (
    <div style={{
      background: 'var(--card)',
      border: `2px solid ${selected ? color : 'var(--border)'}`,
      borderRadius: 12, minWidth: 200, overflow: 'visible', position: 'relative',
      boxShadow: selected ? `0 0 22px ${color}50` : '0 4px 14px rgba(0,0,0,0.35)',
      transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
    }}>
      {/* Top Input Handle — enabled on all nodes */}
      <Handle
        type="target"
        position={Position.Top}
        title="Input: Connect previous step here"
        style={{
          background: 'var(--primary)',
          width: 14,
          height: 14,
          border: '2px solid var(--background)',
          cursor: 'crosshair',
          zIndex: 10,
          boxShadow: '0 0 8px color-mix(in srgb, var(--primary) 70%, transparent)',
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
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
          {data.label || 'Untitled'}
        </div>
        {data.config?.message && (
          <div style={{
            fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4,
            maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data.config.message.substring(0, 45)}
          </div>
        )}
        {data.config?.command && (
          <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4, fontFamily: 'monospace' }}>
            {data.config.command}
          </div>
        )}
        {isInlineKeyboard && buttons.length === 0 && (
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4, fontStyle: 'italic' }}>
            No buttons configured yet. Click to configure.
          </div>
        )}
      </div>

      {/* Button Branches for show_inline_keyboard */}
      {isInlineKeyboard && buttons.length > 0 ? (
        <div style={{
          padding: '8px 12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          borderTop: '1px solid var(--border)',
          background: 'var(--muted)',
        }}>
          <div style={{
            fontSize: 9,
            fontWeight: 800,
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 2,
          }}>
            Button Branches (Drag dot to connect):
          </div>
          {buttons.map((btn: any, idx: number) => {
            const btnKey = btn.callbackData || btn.text || `btn_${idx}`;
            const isBack = (btn.text || '').toLowerCase().includes('back') || btnKey === 'back';
            const btnColor = isBack ? 'var(--muted-foreground)' : 'var(--primary)';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: isBack ? 'var(--border)' : 'color-mix(in srgb, var(--primary) 12%, transparent)',
                  border: `1px solid ${isBack ? 'var(--border)' : 'color-mix(in srgb, var(--primary) 25%, transparent)'}`,
                  position: 'relative',
                }}
              >
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isBack ? 'var(--foreground)' : 'var(--foreground)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 130,
                }}>
                  {btn.text || 'Button'}
                </span>
                <span style={{ fontSize: 9, color: btnColor, fontWeight: 700, paddingRight: 4 }}>
                  ●
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={btnKey}
                  title={`Connect: When user clicks "${btn.text}"`}
                  style={{
                    right: -7,
                    background: btnColor,
                    width: 14,
                    height: 14,
                    border: '2px solid var(--background)',
                    cursor: 'crosshair',
                    zIndex: 10,
                    boxShadow: `0 0 8px ${btnColor}90`,
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : isCondition ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 14px 8px', fontSize: 10, fontWeight: 700 }}>
          <span style={{ color: 'var(--success)', position: 'relative' }}>
            TRUE
            <Handle
              type="source"
              position={Position.Bottom}
              id="true"
              title="True branch (drag to connect)"
              style={{
                left: 14,
                background: 'var(--success)',
                width: 14,
                height: 14,
                border: '2px solid var(--background)',
                cursor: 'crosshair',
                zIndex: 10,
                boxShadow: '0 0 8px color-mix(in srgb, var(--success) 70%, transparent)',
              }}
            />
          </span>
          <span style={{ color: 'var(--destructive)', position: 'relative' }}>
            FALSE
            <Handle
              type="source"
              position={Position.Bottom}
              id="false"
              title="False branch (drag to connect)"
              style={{
                left: 14,
                background: 'var(--destructive)',
                width: 14,
                height: 14,
                border: '2px solid var(--background)',
                cursor: 'crosshair',
                zIndex: 10,
                boxShadow: '0 0 8px color-mix(in srgb, var(--destructive) 70%, transparent)',
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
            border: '2px solid var(--background)',
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
    label: e.label || undefined,
    animated: true,
    style: { stroke: 'var(--primary)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
    labelStyle: { fill: 'var(--foreground)', fontWeight: 600, fontSize: 10 },
    labelBgStyle: { fill: 'var(--card)', fillOpacity: 0.9, rx: 6, ry: 6 },
    labelBgPadding: [6, 4] as [number, number],
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
    label: (e.label as string) || null,
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

    // Detect if this connection came from a condition branch or a button branch
    const sourceNode = nodes.find(n => n.id === connection.source);
    let edgeLabel: string | undefined = undefined;

    if (sourceNode?.data?.nodeType === 'condition') {
      edgeLabel = connection.sourceHandle === 'true' ? 'TRUE' : 'FALSE';
    } else if (sourceNode?.data?.nodeType === 'show_inline_keyboard') {
      const btns = (sourceNode.data?.config as any)?.buttons || [];
      const matchedBtn = btns.find((b: any) => (b.callbackData || b.text) === connection.sourceHandle);
      if (matchedBtn) {
        edgeLabel = matchedBtn.text || matchedBtn.callbackData;
      }
    }

    setEdges(eds => addEdge({
      ...connection,
      label: edgeLabel,
      animated: true,
      style: { stroke: 'var(--primary)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
      labelStyle: { fill: 'var(--foreground)', fontWeight: 600, fontSize: 10 },
      labelBgStyle: { fill: 'var(--card)', fillOpacity: 0.9, rx: 6, ry: 6 },
      labelBgPadding: [6, 4] as [number, number],
    }, eds));
  }, [nodes, setEdges]);

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
  const handleSave = async (silent = false) => {
    setSaving(true);
    try {
      const activeToken = token || useAuth.getState().token || '';
      await api.updateBotWorkflow(activeToken, workflow.id, {
        draftNodes: toStoredNodes(nodes),
        draftEdges: toStoredEdges(edges),
      });
      setSaveStatus('saved');
      if (!silent) toast.success('Draft saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return true;
    } catch (e: any) {
      setSaveStatus('error');
      if (!silent) toast.error(e?.message || 'Failed to save draft');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Publish
  const handlePublish = async () => {
    if (nodes.length === 0) {
      toast.error('Cannot publish an empty workflow — please add at least one node or load a template.');
      return;
    }
    setPublishing(true);
    try {
      const activeToken = token || useAuth.getState().token || '';
      const storedNodes = toStoredNodes(nodes);
      const storedEdges = toStoredEdges(edges);

      // Save draft first
      await api.updateBotWorkflow(activeToken, workflow.id, {
        draftNodes: storedNodes,
        draftEdges: storedEdges,
      });

      // Atomically publish with current nodes and edges
      await api.publishBotWorkflow(activeToken, workflow.id, {
        notes: 'Published from Visual Builder',
        draftNodes: storedNodes,
        draftEdges: storedEdges,
      });

      toast.success('Workflow published successfully! Bot is now live on Telegram.');
      onUpdate();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to publish workflow');
    } finally {
      setPublishing(false);
    }
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
          connectionLineStyle={{ stroke: 'var(--primary)', strokeWidth: 2 }}
          style={{ background: '#0a0f1d' }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: 'var(--primary)', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
          }}
        >
          <Background color="var(--card)" gap={22} size={1} />
          <Controls
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}
          />
          <MiniMap
            nodeColor="var(--primary)"
            maskColor="rgba(10,15,29,0.85)"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}
          />

          {/* Empty Canvas Guide */}
          {nodes.length === 0 && (
            <Panel position="top-center">
              <div style={{
                marginTop: 90,
                textAlign: 'center',
                padding: '28px 36px',
                background: 'var(--card)',
                borderRadius: 20,
                border: '1px dashed color-mix(in srgb, var(--primary) 50%, transparent)',
                backdropFilter: 'blur(16px)',
                maxWidth: 480,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🚀</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', marginBottom: 8 }}>
                  Your Flowchart is Ready
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6, marginBottom: 16 }}>
                  Start by clicking <strong>+ Add</strong> on any node from the left library, or load one of our ready-to-use business templates below!
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleAddNode('command_received', '/start')}
                    style={{
                      padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', color: 'var(--primary)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Plus size={15} /> Add /start Command
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(true)}
                    style={{
                      padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      background: 'linear-gradient(135deg, var(--primary), var(--primary))',
                      border: 'none', color: 'var(--primary-foreground)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 4px 14px color-mix(in srgb, var(--primary) 40%, transparent)',
                    }}
                  >
                    <Sparkles size={15} /> Load a Business Template
                  </button>
                </div>
              </div>
            </Panel>
          )}

          {/* Bottom Connection Guide */}
          <Panel position="bottom-center">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--muted)', padding: '7px 18px', borderRadius: 24,
              border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', backdropFilter: 'blur(12px)',
              fontSize: 12, color: 'var(--foreground)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              pointerEvents: 'none', userSelect: 'none',
            }}>
              <span style={{ fontSize: 14 }}>💡</span>
              <span>
                <strong>How to Connect:</strong> Drag from bottom dot (<span style={{ color: 'var(--success)', fontWeight: 700 }}>● Output</span>) to top dot (<span style={{ color: 'var(--primary)', fontWeight: 700 }}>● Input</span>)
              </span>
            </div>
          </Panel>

          {/* Top-Right Super Action Toolbar */}
          <Panel position="top-right">
            <div style={{
              display: 'flex', gap: 6, background: 'var(--card)',
              padding: '6px 10px', borderRadius: 12,
              border: '1px solid var(--border)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              {/* Templates */}
              <button
                onClick={() => setShowTemplates(true)}
                title="Choose a ready-to-use business template"
                style={toolbarBtn(false)}
              >
                <BookOpen size={14} color="var(--primary)" /> Templates
              </button>

              {/* Auto Organize */}
              <button
                onClick={handleAutoOrganize}
                title="Automatically organize nodes into a clean flowchart"
                style={toolbarBtn(false)}
              >
                <Wand2 size={14} color="var(--success)" /> Tidy Flow
              </button>

              {/* Clear Canvas */}
              {nodes.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  title="Clear all nodes and start fresh"
                  style={toolbarBtn(false)}
                >
                  <Trash2 size={14} color="var(--destructive)" /> Clear
                </button>
              )}

              <div style={{ width: 1, height: 24, background: 'var(--border)', alignSelf: 'center', margin: '0 2px' }} />

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
                onClick={() => handleSave(false)}
                disabled={saving}
                style={toolbarBtn(false)}
              >
                <Save size={14} />
                {saving ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save Draft'}
              </button>

              {/* Publish to Production */}
              <button
                onClick={handlePublish}
                disabled={publishing || nodes.length === 0}
                style={{
                  ...toolbarBtn(false),
                  background: nodes.length === 0 ? 'var(--border)' : 'linear-gradient(135deg, var(--primary), var(--primary))',
                  color: nodes.length === 0 ? 'var(--muted-foreground)' : '#fff',
                  cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  boxShadow: nodes.length === 0 ? 'none' : '0 2px 10px color-mix(in srgb, var(--primary) 40%, transparent)',
                }}
                title={nodes.length === 0 ? 'Cannot publish an empty workflow — add at least one node or load a template' : 'Publish workflow to live Telegram bot'}
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
        borderLeft: '1px solid var(--border)',
        background: 'var(--muted)',
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
            background: 'var(--background)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
            borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color="var(--primary)" />
                  Enterprise Starter Templates
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                  1-Click load ready-made business workflows built for e-commerce, tracking, and payments.
                </div>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}
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
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between', transition: 'border-color 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{tpl.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
                      {tpl.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 12 }}>
                      {tpl.description}
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>
                      <span>📊 {tpl.nodes.length} Nodes</span>
                      <span>🔗 {tpl.edges.length} Connections</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLoadTemplate(tpl)}
                    style={{
                      marginTop: 14, padding: '8px 14px', borderRadius: 8,
                      background: 'color-mix(in srgb, var(--primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                      color: 'var(--foreground)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
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
            background: 'var(--background)', border: '1px solid color-mix(in srgb, var(--destructive) 30%, transparent)',
            borderRadius: 14, width: '100%', maxWidth: 420, padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 8 }}>
              Clear Canvas?
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to remove all {nodes.length} nodes and connections? This draft will start completely empty.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  color: 'var(--muted-foreground)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearCanvas}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: 'var(--destructive)', border: 'none', color: 'var(--primary-foreground)', cursor: 'pointer',
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
    background: active ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'transparent',
    color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
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
