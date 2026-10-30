import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, RefreshCw, Command, CheckCircle2,
  AlertCircle, Zap, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';

interface BotCommandItem {
  id: string; command: string; description: string | null;
  workflowId: string | null; scope: string; isActive: boolean;
}

interface Props {
  botId: string;
  workflowId: string;
}

export function CommandBuilder({ botId, workflowId }: Props) {
  const { token } = useAuth();
  const [commands, setCommands] = useState<BotCommandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [newCmd, setNewCmd] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchCommands = useCallback(async () => {
    const activeToken = token || useAuth.getState().token || '';
    if (!activeToken) {
      setLoading(false);
      return;
    }
    try {
      const list = await api.listBotCommands(activeToken, botId);
      setCommands((list as any) || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [botId, token]);

  useEffect(() => { fetchCommands(); }, [fetchCommands]);

  const addCommand = async () => {
    if (!newCmd.trim()) return;
    try {
      const activeToken = token || useAuth.getState().token || '';
      await api.createBotCommand(activeToken, botId, {
        command: newCmd.trim(),
        description: newDesc.trim() || undefined,
        workflowId,
        isActive: true,
      });
      setNewCmd(''); setNewDesc('');
      fetchCommands();
    } catch (e) { console.error(e); }
  };

  const deleteCommand = async (id: string) => {
    try {
      const activeToken = token || useAuth.getState().token || '';
      await api.deleteBotCommand(activeToken, id);
      fetchCommands();
    } catch (e) { console.error(e); }
  };

  const syncToTelegram = async () => {
    setSyncing(true);
    try {
      const activeToken = token || useAuth.getState().token || '';
      await api.syncBotCommands(activeToken, botId);
    } catch (e) { console.error(e); }
    setSyncing(false);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
            <Command size={20} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--primary)' }} />
            Bot Commands
          </h2>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 12, marginTop: 4 }}>
            Define Telegram commands and sync them to your bot
          </p>
        </div>
        <button onClick={syncToTelegram} disabled={syncing}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, var(--primary), var(--primary))', color: 'var(--primary-foreground)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: syncing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync to Telegram'}
        </button>
      </div>

      {/* Add Command */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20, padding: '16px',
        background: 'var(--card)', borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <input value={newCmd} onChange={e => setNewCmd(e.target.value)}
          placeholder="/command" style={{
            ...iStyle, width: 140, fontFamily: 'monospace',
          }}
        />
        <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
          placeholder="Description" style={{ ...iStyle, flex: 1 }}
        />
        <button onClick={addCommand} disabled={!newCmd.trim()}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: newCmd.trim() ? 'var(--primary)' : 'var(--border)',
            color: newCmd.trim() ? '#fff' : 'var(--muted-foreground)', fontSize: 12, fontWeight: 600,
            cursor: newCmd.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Command List */}
      {loading ? (
        <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 40 }}>Loading commands...</div>
      ) : commands.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)',
          background: 'var(--card)', borderRadius: 12,
          border: '1px dashed var(--border)',
        }}>
          <Command size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>No commands configured yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {commands.map(cmd => (
            <div key={cmd.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 18px', borderRadius: 12,
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <code style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--primary)',
                  fontFamily: 'monospace',
                }}>
                  {cmd.command}
                </code>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  {cmd.description || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: cmd.isActive ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'var(--border)',
                  color: cmd.isActive ? 'var(--success)' : 'var(--muted-foreground)',
                }}>
                  {cmd.isActive ? 'Active' : 'Disabled'}
                </span>
                <button onClick={() => deleteCommand(cmd.id)} style={{
                  background: 'transparent', border: 'none', color: 'var(--muted-foreground)',
                  cursor: 'pointer', padding: 4,
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const iStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--muted)',
  border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--foreground)', fontSize: 13, outline: 'none',
};
