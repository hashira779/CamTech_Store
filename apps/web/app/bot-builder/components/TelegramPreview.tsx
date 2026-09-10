import React, { useState, useEffect } from 'react';
import { Bot, RotateCcw } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';

interface PreviewButton {
  text: string;
  callbackData?: string;
  url?: string;
}

interface PreviewMessage {
  type: 'bot' | 'user';
  text: string;
  buttons?: PreviewButton[];
  photoUrl?: string;
  nodeId?: string;
}

export function TelegramPreview({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Reset conversation to initial state
  const resetChat = () => {
    const startNode = nodes.find(n =>
      n.data?.nodeType === 'start' || n.data?.nodeType === 'command_received'
    ) || nodes[0];

    if (!startNode) {
      setMessages([]);
      setActiveNodeId(null);
      return;
    }

    const initialHistory: PreviewMessage[] = [];
    walkFlow(startNode.id, initialHistory);
  };

  const walkFlow = (startId: string, currentHistory: PreviewMessage[]) => {
    let curr: string | null = startId;
    let steps = 0;
    const visited = new Set<string>();

    while (curr && steps < 12) {
      if (visited.has(curr)) break;
      visited.add(curr);
      steps++;

      const node = nodes.find(n => n.id === curr);
      if (!node) break;

      const nodeType = (node.data?.nodeType as string) || '';
      const config = (node.data?.config as Record<string, any>) || {};

      if (nodeType === 'start' || nodeType === 'command_received') {
        const cmd = config.command || '/start';
        currentHistory.push({ type: 'user', text: cmd, nodeId: curr });
      } else if (nodeType === 'send_message' || nodeType === 'edit_message') {
        currentHistory.push({ type: 'bot', text: config.message || '...', nodeId: curr });
      } else if (nodeType === 'show_inline_keyboard' || nodeType === 'show_reply_keyboard') {
        const rawBtns = (config.buttons as any[]) || [];
        const btns: PreviewButton[] = rawBtns.map(b => ({
          text: typeof b === 'string' ? b : b.text || 'Button',
          callbackData: typeof b === 'object' ? b.callbackData || b.callback_data : undefined,
          url: typeof b === 'object' ? b.url : undefined,
        }));
        currentHistory.push({
          type: 'bot',
          text: config.message || 'Please choose an option:',
          buttons: btns,
          nodeId: curr,
        });
        // Stop and wait for user button click
        setActiveNodeId(curr);
        setMessages([...currentHistory]);
        return;
      } else if (nodeType === 'search_products') {
        currentHistory.push({
          type: 'bot',
          text: 'Available Products:\n• iPhone 15 Pro — $1,199.00\n• MacBook Air M3 — $1,099.00\n• AirPods Pro 2 — $249.00',
          nodeId: curr,
        });
      } else if (nodeType === 'get_order_status') {
        currentHistory.push({
          type: 'bot',
          text: 'Order #CT-8821\n• Status: 🚚 Out for Delivery\n• Total: $45.00 USD\n• Est. Arrival: 15 mins',
          nodeId: curr,
        });
      } else if (nodeType === 'generate_khqr') {
        currentHistory.push({
          type: 'bot',
          text: 'Bakong KHQR Payment\n• Amount: $15.00 USD\n• Ref: ORD-2026\nScan with Bakong, ABA, or Wing app.',
          photoUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=sample_khqr',
          nodeId: curr,
        });
      } else if (nodeType === 'track_delivery') {
        currentHistory.push({
          type: 'bot',
          text: 'Delivery Tracking\n• Courier: Sokha (012-889-991)\n• Status: Picked up and en route\n• Arrival: ~12 minutes',
          nodeId: curr,
        });
      } else if (nodeType === 'send_photo') {
        currentHistory.push({
          type: 'bot',
          text: config.caption || 'Photo',
          photoUrl: config.photoUrl,
          nodeId: curr,
        });
      }

      // Next node: follow first outgoing edge
      const edge = edges.find(e => e.source === curr);
      curr = edge?.target || null;
    }

    setMessages([...currentHistory]);
  };

  useEffect(() => {
    resetChat();
  }, [nodes, edges]);

  // Handle user clicking an inline button in the preview
  const handleButtonClick = (btn: PreviewButton, fromNodeId?: string) => {
    const newHistory: PreviewMessage[] = [
      ...messages,
      { type: 'user', text: btn.text },
    ];

    if (!fromNodeId) {
      setMessages(newHistory);
      return;
    }

    // Find edge from this node matching callbackData or button text
    const btnKey = btn.callbackData || btn.text;
    let targetEdge = edges.find(
      e => e.source === fromNodeId && (
        e.sourceHandle === btnKey ||
        e.sourceHandle === btn.callbackData ||
        e.label === btn.text
      )
    );

    // Fallback: take first outgoing edge
    if (!targetEdge) {
      targetEdge = edges.find(e => e.source === fromNodeId);
    }

    if (targetEdge && targetEdge.target) {
      walkFlow(targetEdge.target, newHistory);
    } else {
      newHistory.push({
        type: 'bot',
        text: `✓ Option selected: "${btn.text}". (Connect this button to a node on canvas to see next step)`,
      });
      setMessages(newHistory);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--background)' }}>
      {/* Phone Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--brand-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
          }}>
            <Bot size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
              Live Telegram Sim
            </div>
            <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>● Online & Interactive</div>
          </div>
        </div>

        <button
          onClick={resetChat}
          style={{
            background: 'var(--border)', border: 'none', borderRadius: 6,
            padding: '4px 8px', color: 'var(--muted-foreground)', cursor: 'pointer',
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
          }}
          title="Restart conversation"
        >
          <RotateCcw size={12} /> Restart
        </button>
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '50px 20px', color: 'var(--muted-foreground)', fontSize: 12,
            lineHeight: 1.6,
          }}>
            Add and connect nodes on canvas to simulate your bot here!
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.type === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: '10px 14px',
                borderRadius: msg.type === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: msg.type === 'user' ? 'var(--primary)' : 'var(--card)',
                color: 'var(--foreground)', fontSize: 12, lineHeight: 1.5,
                border: msg.type === 'user' ? 'none' : '1px solid var(--border)',
                whiteSpace: 'pre-line',
              }}>
                {msg.photoUrl && (
                  <img
                    src={msg.photoUrl}
                    alt="Preview"
                    style={{ width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 8, marginBottom: 8 }}
                  />
                )}
                {msg.text}
              </div>

              {/* Interactive Telegram Buttons */}
              {msg.buttons && msg.buttons.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6, width: '85%' }}>
                  {msg.buttons.map((btn, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => handleButtonClick(btn, msg.nodeId)}
                      style={{
                        padding: '8px 12px', borderRadius: 8,
                        background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                        color: 'var(--primary)', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', textAlign: 'center',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 30%, transparent)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 15%, transparent)';
                        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 30%, transparent)';
                      }}
                    >
                      {btn.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input Bar */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--muted)',
      }}>
        <input
          disabled
          placeholder="Tap buttons above to interact..."
          style={{
            flex: 1, padding: '7px 12px', background: 'var(--input)',
            border: '1px solid var(--border)', borderRadius: 16,
            color: 'var(--muted-foreground)', fontSize: 11, outline: 'none',
          }}
        />
      </div>
    </div>
  );
}
