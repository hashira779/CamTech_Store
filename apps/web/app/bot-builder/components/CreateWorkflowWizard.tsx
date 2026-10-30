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
        background: 'var(--card)', borderRadius: 20, width: 520, maxHeight: '80vh',
        border: '1px solid var(--border)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
            Create Bot Workflow
          </h2>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Steps Indicator */}
        <div style={{
          display: 'flex', gap: 8, padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          {['Select Bot', 'Name & Description'].map((label, i) => (
            <div key={i} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: step > i + 1 ? 'var(--success)' : step === i + 1 ? 'var(--primary)' : 'var(--border)',
                color: 'var(--primary-foreground)',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: step === i + 1 ? 'var(--foreground)' : 'var(--muted-foreground)',
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
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginBottom: 16 }}>
                Select the Telegram bot this workflow will control:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bots.map(bot => (
                  <div key={bot.id}
                    onClick={() => { setBotId(bot.id); setStep(2); }}
                    style={{
                      padding: '14px 16px', borderRadius: 12,
                      background: botId === bot.id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--muted)',
                      border: `1px solid ${botId === bot.id ? 'color-mix(in srgb, var(--primary) 30%, transparent)' : 'var(--border)'}`,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--primary), var(--primary))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Bot size={18} color="#fff" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{bot.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>@{bot.botUsername || 'unknown'}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
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
                  background: 'color-mix(in srgb, var(--primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)',
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--primary)',
                }}>
                  <Bot size={16} /> Connected to: <strong>{selectedBot.name}</strong>
                </div>
              )}

              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6, display: 'block' }}>
                Workflow Name *
              </label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Customer Support Flow"
                autoFocus
                style={{
                  width: '100%', padding: '12px 14px', background: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  color: 'var(--foreground)', fontSize: 14, outline: 'none', marginBottom: 16,
                  boxSizing: 'border-box',
                }}
              />

              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6, display: 'block' }}>
                Description
              </label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What does this workflow do?"
                rows={3}
                style={{
                  width: '100%', padding: '12px 14px', background: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  color: 'var(--foreground)', fontSize: 14, outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          {step > 1 && !preselectedBotId ? (
            <button onClick={() => setStep(s => s - 1)} style={{
              padding: '10px 20px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 10,
              color: 'var(--muted-foreground)', fontSize: 13, cursor: 'pointer',
            }}>
              Back
            </button>
          ) : <div />}

          {step === 2 && (
            <button onClick={handleCreate} disabled={!name.trim() || creating}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600,
                cursor: name.trim() && !creating ? 'pointer' : 'not-allowed',
                background: name.trim() ? 'linear-gradient(135deg, var(--primary), var(--primary))' : 'var(--border)',
                color: name.trim() ? '#fff' : 'var(--muted-foreground)',
                boxShadow: name.trim() ? '0 4px 15px color-mix(in srgb, var(--primary) 30%, transparent)' : 'none',
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
