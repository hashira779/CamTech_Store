import React from 'react';
import { Bot, User } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';

/**
 * TelegramPreview — simulates a Telegram chat interface
 * based on the current workflow nodes on the canvas.
 */
export function TelegramPreview({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  // Walk the flow to generate preview messages
  const messages = buildPreviewMessages(nodes, edges);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Phone Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid rgba(148,163,184,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 999,
          background: 'linear-gradient(135deg, #818cf8, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={16} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
            Telegram Preview
          </div>
          <div style={{ fontSize: 10, color: '#22c55e' }}>online</div>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        background: 'rgba(10,15,30,0.5)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 16px', color: '#475569', fontSize: 12,
          }}>
            Add nodes to see the preview
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i}>
              {msg.type === 'user' ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', borderRadius: '16px 16px 4px 16px',
                    background: '#2563eb', color: '#fff', fontSize: 13,
                  }}>
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                    background: '#1e293b', color: '#e2e8f0', fontSize: 13,
                    border: '1px solid rgba(148,163,184,0.08)',
                  }}>
                    {msg.text}
                  </div>
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxWidth: '85%' }}>
                      {msg.buttons.map((btn, j) => (
                        <button key={j} style={{
                          padding: '8px 14px', borderRadius: 8,
                          background: 'rgba(129,140,248,0.12)',
                          border: '1px solid rgba(129,140,248,0.2)',
                          color: '#818cf8', fontSize: 12, fontWeight: 600,
                          cursor: 'default', textAlign: 'center',
                        }}>
                          {btn}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input Bar */}
      <div style={{
        padding: '10px 12px', borderTop: '1px solid rgba(148,163,184,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <input
          disabled
          placeholder="Message..."
          style={{
            flex: 1, padding: '8px 12px', background: 'rgba(30,41,59,0.6)',
            border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20,
            color: '#64748b', fontSize: 12, outline: 'none',
          }}
        />
      </div>
    </div>
  );
}

// ─── Preview Message Builder ─────────────────────────────────────────────────

interface PreviewMessage {
  type: 'bot' | 'user';
  text: string;
  buttons?: string[];
}

function buildPreviewMessages(nodes: Node[], edges: Edge[]): PreviewMessage[] {
  const messages: PreviewMessage[] = [];
  const visited = new Set<string>();

  // Find the start node
  const startNode = nodes.find(n =>
    n.data?.nodeType === 'start' || n.data?.nodeType === 'command_received'
  );
  if (!startNode) return messages;

  let currentId: string | null = startNode.id;
  let steps = 0;

  while (currentId && steps < 15) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    steps++;

    const node = nodes.find(n => n.id === currentId);
    if (!node) break;

    const nodeType = node.data?.nodeType as string;
    const config = node.data?.config as Record<string, any> || {};

    if (nodeType === 'start' || nodeType === 'command_received') {
      const cmd = config.command || '/start';
      messages.push({ type: 'user', text: cmd });
    } else if (nodeType === 'send_message') {
      messages.push({ type: 'bot', text: config.message || config.text || '...' });
    } else if (nodeType === 'show_inline_keyboard' || nodeType === 'show_reply_keyboard') {
      const btns = (config.buttons || []).map((b: any) =>
        typeof b === 'string' ? b : b.text || 'Button'
      );
      messages.push({
        type: 'bot',
        text: config.message || config.text || 'Choose:',
        buttons: btns,
      });
    } else if (nodeType === 'wait_input') {
      messages.push({ type: 'user', text: '(user input)' });
    } else if (nodeType === 'send_photo') {
      messages.push({ type: 'bot', text: `📸 ${config.caption || 'Photo'}` });
    } else if (nodeType === 'send_location') {
      messages.push({ type: 'bot', text: '📍 Location' });
    }

    // Follow first outgoing edge
    const edge = edges.find(e => e.source === currentId);
    currentId = edge?.target || null;
  }

  return messages;
}
