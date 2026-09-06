import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Node } from '@xyflow/react';

interface Props {
  node: Node;
  onChange: (nodeId: string, config: any, label?: string) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
}

export function NodeConfigPanel({ node, onChange, onClose, onDelete }: Props) {
  const nodeType = node.data?.nodeType as string || '';
  const config = (node.data?.config as Record<string, any>) || {};
  const label = (node.data?.label as string) || '';

  const update = (key: string, value: any) => {
    onChange(node.id, { [key]: value });
  };

  const updateLabel = (newLabel: string) => {
    onChange(node.id, {}, newLabel);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid rgba(148,163,184,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Configure Node</div>
          <div style={{ fontSize: 10, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {nodeType.replace(/_/g, ' ')}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Config Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Label — always shown */}
        <Field label="Node Label">
          <input value={label} onChange={e => updateLabel(e.target.value)} style={inputStyle} />
        </Field>

        {/* Type-specific config */}
        {nodeType === 'command_received' && (
          <Field label="Command">
            <input value={config.command || ''} onChange={e => update('command', e.target.value)}
              placeholder="/start" style={inputStyle} />
          </Field>
        )}

        {(nodeType === 'send_message') && (
          <Field label="Message Text">
            <textarea value={config.message || ''} onChange={e => update('message', e.target.value)}
              placeholder="Hello {{user.name}}!" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
              Use {'{{user.name}}'}, {'{{input.message}}'} for variables
            </div>
          </Field>
        )}

        {(nodeType === 'show_inline_keyboard' || nodeType === 'show_reply_keyboard') && (
          <>
            <Field label="Message">
              <textarea value={config.message || ''} onChange={e => update('message', e.target.value)}
                placeholder="Choose an option:" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
            <Field label="Buttons">
              <ButtonsEditor
                buttons={config.buttons || []}
                onChange={buttons => update('buttons', buttons)}
                isInline={nodeType === 'show_inline_keyboard'}
              />
            </Field>
            <Field label="Columns">
              <input type="number" value={config.columns || 1} min={1} max={4}
                onChange={e => update('columns', parseInt(e.target.value) || 1)}
                style={{ ...inputStyle, width: 80 }} />
            </Field>
          </>
        )}

        {nodeType === 'condition' && (
          <>
            <Field label="Variable Path">
              <input value={config.variable || ''} onChange={e => update('variable', e.target.value)}
                placeholder="input.message" style={inputStyle} />
            </Field>
            <Field label="Operator">
              <select value={config.operator || 'equals'} onChange={e => update('operator', e.target.value)}
                style={inputStyle}>
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="contains">Contains</option>
                <option value="starts_with">Starts With</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
                <option value="is_empty">Is Empty</option>
                <option value="is_not_empty">Is Not Empty</option>
              </select>
            </Field>
            <Field label="Compare Value">
              <input value={config.value || ''} onChange={e => update('value', e.target.value)}
                placeholder="hello" style={inputStyle} />
            </Field>
          </>
        )}

        {nodeType === 'set_variable' && (
          <>
            <Field label="Variable Name">
              <input value={config.variableName || ''} onChange={e => update('variableName', e.target.value)}
                placeholder="myVar" style={inputStyle} />
            </Field>
            <Field label="Value">
              <input value={config.value || ''} onChange={e => update('value', e.target.value)}
                placeholder="{{input.message}}" style={inputStyle} />
            </Field>
          </>
        )}

        {nodeType === 'api_call' && (
          <>
            <Field label="URL">
              <input value={config.url || ''} onChange={e => update('url', e.target.value)}
                placeholder="https://api.example.com/data" style={inputStyle} />
            </Field>
            <Field label="Method">
              <select value={config.method || 'GET'} onChange={e => update('method', e.target.value)}
                style={inputStyle}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </Field>
            <Field label="Output Variable">
              <input value={config.outputVariable || ''} onChange={e => update('outputVariable', e.target.value)}
                placeholder="apiResponse" style={inputStyle} />
            </Field>
          </>
        )}

        {nodeType === 'send_photo' && (
          <>
            <Field label="Photo URL">
              <input value={config.photoUrl || ''} onChange={e => update('photoUrl', e.target.value)}
                placeholder="https://..." style={inputStyle} />
            </Field>
            <Field label="Caption">
              <input value={config.caption || ''} onChange={e => update('caption', e.target.value)}
                placeholder="Optional caption" style={inputStyle} />
            </Field>
          </>
        )}

        {nodeType === 'send_location' && (
          <>
            <Field label="Latitude">
              <input type="number" step="any" value={config.latitude || ''} onChange={e => update('latitude', parseFloat(e.target.value))}
                style={inputStyle} />
            </Field>
            <Field label="Longitude">
              <input type="number" step="any" value={config.longitude || ''} onChange={e => update('longitude', parseFloat(e.target.value))}
                style={inputStyle} />
            </Field>
          </>
        )}

        {nodeType === 'wait_input' && (
          <Field label="Prompt (shown before waiting)">
            <textarea value={config.prompt || ''} onChange={e => update('prompt', e.target.value)}
              placeholder="Please enter your name:" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
        )}

        {nodeType === 'delay' && (
          <Field label="Delay (seconds)">
            <input type="number" value={config.seconds || 1} min={1} max={300}
              onChange={e => update('seconds', parseInt(e.target.value) || 1)}
              style={{ ...inputStyle, width: 100 }} />
          </Field>
        )}
      </div>

      {/* Node ID & Actions */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid rgba(148,163,184,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>
          ID: {node.id}
        </span>
        {onDelete && (
          <button
            onClick={() => onDelete(node.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 6,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444', fontSize: 11, fontWeight: 500, cursor: 'pointer',
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
      <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 5, display: 'block' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'rgba(30,41,59,0.6)',
  border: '1px solid rgba(148,163,184,0.12)', borderRadius: 8,
  color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

function ButtonsEditor({
  buttons, onChange, isInline,
}: {
  buttons: any[]; onChange: (b: any[]) => void; isInline: boolean;
}) {
  const addButton = () => {
    onChange([...buttons, { text: 'Button', callbackData: `btn_${Date.now()}` }]);
  };

  const removeButton = (i: number) => {
    onChange(buttons.filter((_, idx) => idx !== i));
  };

  const updateButton = (i: number, field: string, value: string) => {
    const updated = [...buttons];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  return (
    <div>
      {buttons.map((btn: any, i: number) => (
        <div key={i} style={{
          display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center',
        }}>
          <input value={btn.text || ''} onChange={e => updateButton(i, 'text', e.target.value)}
            placeholder="Button text" style={{ ...inputStyle, flex: 1 }} />
          {isInline && (
            <input value={btn.callbackData || ''} onChange={e => updateButton(i, 'callbackData', e.target.value)}
              placeholder="Callback" style={{ ...inputStyle, width: 80, fontSize: 11 }} />
          )}
          <button onClick={() => removeButton(i)} style={{
            background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4,
          }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button onClick={addButton} style={{
        padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
        border: '1px dashed rgba(148,163,184,0.2)', background: 'transparent',
        color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        width: '100%', justifyContent: 'center',
      }}>
        <Plus size={12} /> Add Button
      </button>
    </div>
  );
}
