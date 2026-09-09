import React from 'react';
import { X, Plus, Trash2, RotateCcw, Sparkles } from 'lucide-react';
import type { Node } from '@xyflow/react';
import { BUTTON_QUICK_PRESETS } from '@mystore/contracts';

interface Props {
  node: Node;
  onChange: (nodeId: string, config: any, label?: string) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
}

export function NodeConfigPanel({ node, onChange, onClose, onDelete }: Props) {
  const nodeType = (node.data?.nodeType as string) || '';
  const config = (node.data?.config as Record<string, any>) || {};
  const label = (node.data?.label as string) || '';

  const update = (key: string, value: any) => {
    onChange(node.id, { [key]: value });
  };

  const updateLabel = (newLabel: string) => {
    onChange(node.id, {}, newLabel);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid rgba(148,163,184,0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(30,41,59,0.5)',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Configure Node</div>
          <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 }}>
            {nodeType.replace(/_/g, ' ')}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none', color: '#94a3b8',
            cursor: 'pointer', padding: 4, borderRadius: 6,
          }}
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Config Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Label — always shown */}
        <Field label="Node Title / Display Name">
          <input
            value={label}
            onChange={e => updateLabel(e.target.value)}
            placeholder="Step title"
            style={inputStyle}
          />
        </Field>

        {/* ─── Triggers ─── */}
        {nodeType === 'command_received' && (
          <Field label="Bot Command (/start, /menu, /track)">
            <input
              value={config.command || ''}
              onChange={e => update('command', e.target.value)}
              placeholder="/start"
              style={inputStyle}
            />
            <Hint>Command triggered when user sends this slash command</Hint>
          </Field>
        )}

        {/* ─── Telegram UX ─── */}
        {(nodeType === 'send_message' || nodeType === 'edit_message') && (
          <Field label="Message Content (HTML & Variables)">
            <textarea
              value={config.message || ''}
              onChange={e => update('message', e.target.value)}
              placeholder="Hello {{user.first_name}}! Welcome to our store."
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <Hint>Available: {'{{user.first_name}}'}, {'{{user.id}}'}, {'{{input.message}}'}</Hint>
          </Field>
        )}

        {(nodeType === 'show_inline_keyboard' || nodeType === 'show_reply_keyboard') && (
          <>
            <Field label="Message Text">
              <textarea
                value={config.message || ''}
                onChange={e => update('message', e.target.value)}
                placeholder="Choose an option below:"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>
            <Field label="Interactive Buttons">
              <ButtonsEditor
                buttons={config.buttons || []}
                onChange={buttons => update('buttons', buttons)}
                isInline={nodeType === 'show_inline_keyboard'}
              />
            </Field>
            <Field label="Buttons Per Row">
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3, 4].map(col => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => update('columns', col)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: config.columns === col || (!config.columns && col === 1) ? '1px solid #818cf8' : '1px solid rgba(148,163,184,0.15)',
                      background: config.columns === col || (!config.columns && col === 1) ? 'rgba(129,140,248,0.2)' : 'rgba(30,41,59,0.4)',
                      color: config.columns === col || (!config.columns && col === 1) ? '#c7d2fe' : '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {col} {col === 1 ? 'col' : 'cols'}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {nodeType === 'send_photo' && (
          <>
            <Field label="Photo Image URL">
              <input
                value={config.photoUrl || ''}
                onChange={e => update('photoUrl', e.target.value)}
                placeholder="https://example.com/item.jpg"
                style={inputStyle}
              />
            </Field>
            <Field label="Photo Caption">
              <textarea
                value={config.caption || ''}
                onChange={e => update('caption', e.target.value)}
                placeholder="Check out our best seller!"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>
          </>
        )}

        {nodeType === 'send_location' && (
          <>
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                value={config.latitude || ''}
                onChange={e => update('latitude', parseFloat(e.target.value))}
                placeholder="11.5564"
                style={inputStyle}
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                value={config.longitude || ''}
                onChange={e => update('longitude', parseFloat(e.target.value))}
                placeholder="104.9282"
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {/* ─── Store & Catalog ─── */}
        {nodeType === 'search_products' && (
          <>
            <Field label="Search Query Filter (or {{input.message}})">
              <input
                value={config.query || ''}
                onChange={e => update('query', e.target.value)}
                placeholder="{{input.message}}"
                style={inputStyle}
              />
              <Hint>Leave blank to show latest active products</Hint>
            </Field>
            <Field label="Max Products to Display">
              <input
                type="number"
                min={1}
                max={10}
                value={config.limit || 5}
                onChange={e => update('limit', parseInt(e.target.value) || 5)}
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {nodeType === 'get_product' && (
          <Field label="Product ID or Name Variable">
            <input
              value={config.productId || ''}
              onChange={e => update('productId', e.target.value)}
              placeholder="{{input.response}}"
              style={inputStyle}
            />
          </Field>
        )}

        {/* ─── Orders & Checkout ─── */}
        {nodeType === 'get_order_status' && (
          <Field label="Order Number (or {{input.message}})">
            <input
              value={config.orderNumber || ''}
              onChange={e => update('orderNumber', e.target.value)}
              placeholder="{{input.message}}"
              style={inputStyle}
            />
            <Hint>Queries real-time sale status from MyStore database</Hint>
          </Field>
        )}

        {/* ─── Payments & Bakong KHQR ─── */}
        {nodeType === 'generate_khqr' && (
          <>
            <Field label="Payment Amount ($)">
              <input
                value={config.amount || ''}
                onChange={e => update('amount', e.target.value)}
                placeholder="15.00"
                style={inputStyle}
              />
              <Hint>Fixed amount or variable like {'{{order.total}}'}</Hint>
            </Field>
            <Field label="Currency">
              <select
                value={config.currency || 'USD'}
                onChange={e => update('currency', e.target.value)}
                style={inputStyle}
              >
                <option value="USD">USD ($)</option>
                <option value="KHR">KHR (៛)</option>
              </select>
            </Field>
            <Field label="Order Reference Code">
              <input
                value={config.orderId || ''}
                onChange={e => update('orderId', e.target.value)}
                placeholder="ORD-{{timestamp}}"
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {/* ─── Delivery & Courier ─── */}
        {nodeType === 'track_delivery' && (
          <Field label="Tracking Number (or {{input.message}})">
            <input
              value={config.trackingNumber || ''}
              onChange={e => update('trackingNumber', e.target.value)}
              placeholder="{{input.message}}"
              style={inputStyle}
            />
            <Hint>Resolves courier assignment, ETA, and live delivery status</Hint>
          </Field>
        )}

        {/* ─── CRM & Customers ─── */}
        {nodeType === 'lookup_customer' && (
          <Field label="Customer Phone (or {{input.message}})">
            <input
              value={config.phone || ''}
              onChange={e => update('phone', e.target.value)}
              placeholder="{{input.message}}"
              style={inputStyle}
            />
            <Hint>Looks up loyalty tier, reward points, and profile</Hint>
          </Field>
        )}

        {/* ─── Support & Admin Alert ─── */}
        {nodeType === 'alert_admin' && (
          <>
            <Field label="Admin Telegram Chat ID">
              <input
                value={config.adminChatId || ''}
                onChange={e => update('adminChatId', e.target.value)}
                placeholder="7673456476"
                style={inputStyle}
              />
              <Hint>User or group chat ID to receive instant alerts</Hint>
            </Field>
            <Field label="Alert Message">
              <textarea
                value={config.message || ''}
                onChange={e => update('message', e.target.value)}
                placeholder="Customer {{user.first_name}} requested live assistance!"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>
          </>
        )}

        {/* ─── Logic & Split ─── */}
        {nodeType === 'condition' && (
          <>
            <Field label="Variable to Check">
              <input
                value={config.variable || ''}
                onChange={e => update('variable', e.target.value)}
                placeholder="input.message"
                style={inputStyle}
              />
            </Field>
            <Field label="Condition Operator">
              <select
                value={config.operator || 'equals'}
                onChange={e => update('operator', e.target.value)}
                style={inputStyle}
              >
                <option value="equals">Equals (exact match)</option>
                <option value="not_equals">Does Not Equal</option>
                <option value="contains">Contains text</option>
                <option value="starts_with">Starts with</option>
                <option value="greater_than">Greater than (&gt;)</option>
                <option value="less_than">Less than (&lt;)</option>
                <option value="is_empty">Is Empty</option>
                <option value="is_not_empty">Is Not Empty</option>
              </select>
            </Field>
            <Field label="Value to Compare Against">
              <input
                value={config.value || ''}
                onChange={e => update('value', e.target.value)}
                placeholder="e.g. order, 100, yes"
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {nodeType === 'business_hours' && (
          <>
            <Field label="Store Opening Time (24h)">
              <input
                value={config.openTime || '08:00'}
                onChange={e => update('openTime', e.target.value)}
                placeholder="08:00"
                style={inputStyle}
              />
            </Field>
            <Field label="Store Closing Time (24h)">
              <input
                value={config.closeTime || '21:00'}
                onChange={e => update('closeTime', e.target.value)}
                placeholder="21:00"
                style={inputStyle}
              />
            </Field>
            <Field label="Timezone">
              <input
                value={config.timezone || 'Asia/Phnom_Penh'}
                onChange={e => update('timezone', e.target.value)}
                placeholder="Asia/Phnom_Penh"
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {nodeType === 'format_currency' && (
          <>
            <Field label="Amount Input (number or variable)">
              <input
                value={config.value || ''}
                onChange={e => update('value', e.target.value)}
                placeholder="100.5"
                style={inputStyle}
              />
            </Field>
            <Field label="Target Currency">
              <select
                value={config.currency || 'USD'}
                onChange={e => update('currency', e.target.value)}
                style={inputStyle}
              >
                <option value="USD">USD ($)</option>
                <option value="KHR">KHR (៛)</option>
              </select>
            </Field>
            <Field label="Output Variable Name">
              <input
                value={config.outputVariable || 'formattedPrice'}
                onChange={e => update('outputVariable', e.target.value)}
                placeholder="formattedPrice"
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {/* ─── REST API Call ─── */}
        {nodeType === 'api_call' && (
          <>
            <Field label="HTTP Endpoint URL">
              <input
                value={config.url || ''}
                onChange={e => update('url', e.target.value)}
                placeholder="https://api.example.com/v1/orders"
                style={inputStyle}
              />
            </Field>
            <Field label="HTTP Method">
              <select
                value={config.method || 'GET'}
                onChange={e => update('method', e.target.value)}
                style={inputStyle}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </Field>
            <Field label="Save Result Into Variable">
              <input
                value={config.outputVariable || 'apiResponse'}
                onChange={e => update('outputVariable', e.target.value)}
                placeholder="apiResponse"
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {/* ─── User Input ─── */}
        {nodeType === 'wait_input' && (
          <Field label="Prompt Message (asks user for text)">
            <textarea
              value={config.prompt || ''}
              onChange={e => update('prompt', e.target.value)}
              placeholder="Please type your delivery address or contact number:"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        )}

        {nodeType === 'delay' && (
          <Field label="Wait Time (seconds)">
            <input
              type="number"
              min={1}
              max={300}
              value={config.seconds || 2}
              onChange={e => update('seconds', parseInt(e.target.value) || 2)}
              style={inputStyle}
            />
          </Field>
        )}
      </div>

      {/* Footer / Delete */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid rgba(148,163,184,0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(30,41,59,0.3)',
      }}>
        <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
          {node.id}
        </span>
        {onDelete && (
          <button
            onClick={() => onDelete(node.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 6,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
          >
            <Trash2 size={12} /> Delete Node
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'rgba(30,41,59,0.8)',
  border: '1px solid rgba(148,163,184,0.16)', borderRadius: 8,
  color: '#f8fafc', fontSize: 12, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

// ─── Buttons Editor ─────────────────────────────────────────────────────────

function ButtonsEditor({
  buttons, onChange, isInline,
}: {
  buttons: any[]; onChange: (b: any[]) => void; isInline: boolean;
}) {
  const addButton = (text = 'Button', callbackData = `btn_${Date.now()}`) => {
    onChange([...buttons, { text, callbackData }]);
  };

  const removeButton = (i: number) => {
    onChange(buttons.filter((_, idx) => idx !== i));
  };

  const clearAllButtons = () => {
    onChange([]);
  };

  const updateButton = (i: number, field: string, value: string) => {
    const updated = [...buttons];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  const quickPresets = BUTTON_QUICK_PRESETS;

  return (
    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 10, padding: 12 }}>
      {/* Action bar with Clear All */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
          {buttons.length} {buttons.length === 1 ? 'Button' : 'Buttons'} Configured
        </span>
        {buttons.length > 0 && (
          <button
            type="button"
            onClick={clearAllButtons}
            style={{
              background: 'transparent', border: 'none', color: '#ef4444',
              cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 6px', borderRadius: 4,
            }}
            title="Clear all buttons"
          >
            <RotateCcw size={11} /> Clear All
          </button>
        )}
      </div>

      {/* Column Headers */}
      {buttons.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '0 2px' }}>
          <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Button Text (Customer Sees)
          </div>
          {isInline && (
            <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Callback ID / Action Key
            </div>
          )}
          <div style={{ width: 22 }} />
        </div>
      )}

      {/* Button Rows */}
      {buttons.map((btn: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input
            value={btn.text || ''}
            onChange={e => updateButton(i, 'text', e.target.value)}
            placeholder="e.g. 📦 View Orders"
            style={{ ...inputStyle, flex: 1 }}
          />
          {isInline && (
            <input
              value={btn.callbackData || ''}
              onChange={e => updateButton(i, 'callbackData', e.target.value)}
              placeholder="e.g. view_orders"
              style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
            />
          )}
          <button
            type="button"
            onClick={() => removeButton(i)}
            style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', cursor: 'pointer', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Remove button"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {/* Add Button & Presets */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => addButton('New Button', `btn_${Date.now()}`)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1px dashed rgba(129,140,248,0.4)', background: 'rgba(129,140,248,0.08)',
            color: '#a5b4fc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            justifyContent: 'center',
          }}
        >
          <Plus size={13} /> Add Custom Button
        </button>
      </div>

      {/* Quick Presets Chips */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(148,163,184,0.1)' }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={11} color="#818cf8" /> Quick Add Presets:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {quickPresets.map(preset => (
            <button
              key={preset.data}
              type="button"
              onClick={() => addButton(preset.label, preset.data)}
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 6,
                background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(148,163,184,0.15)',
                color: '#cbd5e1', cursor: 'pointer',
              }}
            >
              + {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
