import React, { useState } from 'react';
import { X, Bot, ChevronRight } from 'lucide-react';
import type { TelegramBotDto, BotWorkflowDto } from '@mystore/contracts';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';

interface Props {
  bots: TelegramBotDto[];
  preselectedBotId?: string;
  onClose: () => void;
  onCreated: (wf: BotWorkflowDto) => void;
}

export function CreateWorkflowWizard({ bots, preselectedBotId, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const [step, setStep] = useState(preselectedBotId ? 2 : 1);
  const [botId, setBotId] = useState(preselectedBotId || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedBot = bots.find(b => b.id === botId);

  const handleCreate = async () => {
    if (!botId || !name.trim()) return;
    setCreating(true);
    try {
      const activeToken = token || useAuth.getState().token || '';
      const wf = await api.createBotWorkflowForBot(activeToken, botId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(wf);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#1e293b', borderRadius: 20, width: 520, maxHeight: '80vh',
        border: '1px solid rgba(148,163,184,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
            Create Bot Workflow
          </h2>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Steps Indicator */}
        <div style={{
          display: 'flex', gap: 8, padding: '16px 24px',
          borderBottom: '1px solid rgba(148,163,184,0.05)',
        }}>
          {['Select Bot', 'Name & Description'].map((label, i) => (
            <div key={i} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: step > i + 1 ? '#22c55e' : step === i + 1 ? '#818cf8' : '#334155',
                color: '#fff',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: step === i + 1 ? '#e2e8f0' : '#64748b',
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {step === 1 && (
            <div>
              <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                Select the Telegram bot this workflow will control:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bots.map(bot => (
                  <div key={bot.id}
                    onClick={() => { setBotId(bot.id); setStep(2); }}
                    style={{
                      padding: '14px 16px', borderRadius: 12,
                      background: botId === bot.id ? 'rgba(129,140,248,0.12)' : 'rgba(15,23,42,0.5)',
                      border: `1px solid ${botId === bot.id ? 'rgba(129,140,248,0.3)' : 'rgba(148,163,184,0.08)'}`,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Bot size={18} color="#fff" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{bot.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>@{bot.botUsername || 'unknown'}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: '#64748b' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              {selectedBot && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 20,
                  background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)',
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#a5b4fc',
                }}>
                  <Bot size={16} /> Connected to: <strong>{selectedBot.name}</strong>
                </div>
              )}

              <label style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6, display: 'block' }}>
                Workflow Name *
              </label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Customer Support Flow"
                autoFocus
                style={{
                  width: '100%', padding: '12px 14px', background: 'rgba(15,23,42,0.6)',
                  border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10,
                  color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 16,
                  boxSizing: 'border-box',
                }}
              />

              <label style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6, display: 'block' }}>
                Description
              </label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What does this workflow do?"
                rows={3}
                style={{
                  width: '100%', padding: '12px 14px', background: 'rgba(15,23,42,0.6)',
                  border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10,
                  color: '#e2e8f0', fontSize: 14, outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.08)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          {step > 1 && !preselectedBotId ? (
            <button onClick={() => setStep(s => s - 1)} style={{
              padding: '10px 20px', background: 'transparent',
              border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10,
              color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            }}>
              Back
            </button>
          ) : <div />}

          {step === 2 && (
            <button onClick={handleCreate} disabled={!name.trim() || creating}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600,
                cursor: name.trim() && !creating ? 'pointer' : 'not-allowed',
                background: name.trim() ? 'linear-gradient(135deg, #818cf8, #6366f1)' : '#334155',
                color: name.trim() ? '#fff' : '#64748b',
                boxShadow: name.trim() ? '0 4px 15px rgba(99,102,241,0.3)' : 'none',
              }}
            >
              {creating ? 'Creating...' : 'Create Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
