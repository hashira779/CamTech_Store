import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, RefreshCw, Command, CheckCircle2,
  AlertCircle, Zap, ToggleLeft, ToggleRight,
} from 'lucide-react';

const token = () => localStorage.getItem('token') || '';
const API = 'http://localhost:4000/api/v1';

interface BotCommandItem {
  id: string; command: string; description: string | null;
  workflowId: string | null; scope: string; isActive: boolean;
}

interface Props {
  botId: string;
  workflowId: string;
}

export function CommandBuilder({ botId, workflowId }: Props) {
  const [commands, setCommands] = useState<BotCommandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [newCmd, setNewCmd] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchCommands = useCallback(async () => {
    try {
      const res = await fetch(`${API}/bot-builder/bots/${botId}/commands`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const body = await res.json();
      setCommands(body.success ? body.data : (Array.isArray(body) ? body : []));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [botId]);

  useEffect(() => { fetchCommands(); }, [fetchCommands]);

  const addCommand = async () => {
    if (!newCmd.trim()) return;
    try {
      await fetch(`${API}/bot-builder/bots/${botId}/commands`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: newCmd.trim(),
          description: newDesc.trim() || undefined,
          workflowId,
          isActive: true,
        }),
      });
      setNewCmd(''); setNewDesc('');
      fetchCommands();
    } catch (e) { console.error(e); }
  };

  const deleteCommand = async (id: string) => {
    try {
      await fetch(`${API}/bot-builder/commands/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      fetchCommands();
    } catch (e) { console.error(e); }
  };

  const syncToTelegram = async () => {
    setSyncing(true);
    try {
      await fetch(`${API}/bot-builder/bots/${botId}/commands/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      });
    } catch (e) { console.error(e); }
    setSyncing(false);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
            <Command size={20} style={{ verticalAlign: -3, marginRight: 8, color: '#818cf8' }} />
            Bot Commands
          </h2>
          <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
            Define Telegram commands and sync them to your bot
          </p>
        </div>
        <button onClick={syncToTelegram} disabled={syncing}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: '#fff', cursor: 'pointer',
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
        background: 'rgba(30,41,59,0.5)', borderRadius: 12,
        border: '1px solid rgba(148,163,184,0.08)',
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
            background: newCmd.trim() ? '#818cf8' : '#334155',
            color: newCmd.trim() ? '#fff' : '#64748b', fontSize: 12, fontWeight: 600,
            cursor: newCmd.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Command List */}
      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>Loading commands...</div>
      ) : commands.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px', color: '#475569',
          background: 'rgba(30,41,59,0.3)', borderRadius: 12,
          border: '1px dashed rgba(148,163,184,0.15)',
        }}>
          <Command size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: '#64748b' }}>No commands configured yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {commands.map(cmd => (
            <div key={cmd.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 18px', borderRadius: 12,
              background: 'rgba(30,41,59,0.5)',
              border: '1px solid rgba(148,163,184,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <code style={{
                  fontSize: 14, fontWeight: 700, color: '#818cf8',
                  fontFamily: 'monospace',
                }}>
                  {cmd.command}
                </code>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  {cmd.description || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: cmd.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.1)',
                  color: cmd.isActive ? '#22c55e' : '#64748b',
                }}>
                  {cmd.isActive ? 'Active' : 'Disabled'}
                </span>
                <button onClick={() => deleteCommand(cmd.id)} style={{
                  background: 'transparent', border: 'none', color: '#64748b',
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
  padding: '8px 12px', background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(148,163,184,0.12)', borderRadius: 8,
  color: '#e2e8f0', fontSize: 13, outline: 'none',
};
