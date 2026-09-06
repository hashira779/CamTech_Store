import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Routes, Route, useParams } from 'react-router-dom';
import {
  Bot, Plus, Search, MoreVertical, Zap, Settings, History,
  Play, Pause, CheckCircle2, AlertCircle, ArrowLeft, Command,
  BarChart3, Activity,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import type {
  TelegramBotDto, BotWorkflowDto, CreateBotWorkflowInput,
} from '@mystore/contracts';

import { VisualBuilder } from './components/VisualBuilder';
import { CreateWorkflowWizard } from './components/CreateWorkflowWizard';
import { VersionHistory } from './components/VersionHistory';
import { ExecutionDebugger } from './components/ExecutionDebugger';
import { CommandBuilder } from './components/CommandBuilder';

const getAuthToken = () => useAuth.getState().token || '';

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    PUBLISHED: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', dot: '#22c55e', label: '🟢 Live' },
    DRAFT: { bg: 'rgba(234,179,8,0.12)', text: '#eab308', dot: '#eab308', label: '🟡 Draft' },
    PAUSED: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', dot: '#ef4444', label: '🔴 Paused' },
  };
  const s = map[status] || map.DRAFT;
  return (
    <span style={{
      background: s.bg, color: s.text, padding: '4px 10px', borderRadius: 6,
      fontSize: 12, fontWeight: 600,
    }}>
      {s.label}
    </span>
  );
}

// ─── Bot Builder Dashboard ───────────────────────────────────────────────────

function Dashboard() {
  const nav = useNavigate();
  const { token } = useAuth();
  const [bots, setBots] = useState<TelegramBotDto[]>([]);
  const [workflows, setWorkflows] = useState<Record<string, BotWorkflowDto[]>>({});
  const [search, setSearch] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedBot, setSelectedBot] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const activeToken = token || useAuth.getState().token;
    if (!activeToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const b = await api.listTelegramBots(activeToken);
      setBots(b);
      const wfMap: Record<string, BotWorkflowDto[]> = {};
      for (const bot of b) {
        try {
          const list = await api.listBotWorkflows(activeToken, bot.id);
          wfMap[bot.id] = list || [];
        } catch { wfMap[bot.id] = []; }
      }
      setWorkflows(wfMap);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredBots = bots.filter(b =>
    !search || b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bot size={32} style={{ color: '#818cf8' }} />
            Telegram Bot Builder
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 6 }}>
            Create and manage Telegram bots visually — no code required
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          style={{
            background: 'linear-gradient(135deg, #818cf8, #6366f1)',
            color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(99,102,241,0.3)'; }}
        >
          <Plus size={18} /> Create Bot Workflow
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24, maxWidth: 400 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: '#64748b' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search bots..."
          style={{
            width: '100%', padding: '10px 14px 10px 40px', background: 'rgba(30,41,59,0.7)',
            border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10, color: '#e2e8f0',
            fontSize: 14, outline: 'none',
          }}
        />
      </div>

      {/* Bot Cards */}
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 60 }}>Loading bots...</div>
      ) : filteredBots.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 20px', color: '#64748b',
          background: 'rgba(30,41,59,0.4)', borderRadius: 16,
          border: '1px dashed rgba(148,163,184,0.2)',
        }}>
          <Bot size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>No Telegram bots found</p>
          <p style={{ fontSize: 13 }}>Go to Telegram settings to add a bot first, then create a workflow here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
          {filteredBots.map(bot => {
            const wfs = workflows[bot.id] || [];
            return (
              <div key={bot.id} style={{
                background: 'rgba(30,41,59,0.6)', borderRadius: 16,
                border: '1px solid rgba(148,163,184,0.1)', overflow: 'hidden',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.3)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {/* Bot Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Bot size={22} color="#fff" />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{bot.name}</h3>
                        <span style={{ fontSize: 12, color: '#64748b' }}>@{bot.botUsername || 'unknown'}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 6,
                      background: bot.status === 'CONNECTED' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: bot.status === 'CONNECTED' ? '#22c55e' : '#ef4444',
                    }}>
                      {bot.status}
                    </span>
                  </div>
                </div>

                {/* Workflows */}
                <div style={{ padding: '16px 24px' }}>
                  {wfs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#64748b', fontSize: 13 }}>
                      No workflows yet
                    </div>
                  ) : wfs.map(wf => (
                    <div key={wf.id}
                      onClick={() => nav(`/bot-builder/${wf.id}`)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', marginBottom: 8, borderRadius: 10,
                        background: 'rgba(15,23,42,0.5)', cursor: 'pointer',
                        border: '1px solid transparent',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.2)'; e.currentTarget.style.background = 'rgba(15,23,42,0.8)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'rgba(15,23,42,0.5)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Zap size={16} style={{ color: '#818cf8' }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{wf.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            v{wf.publishedVersionNumber || 0} · {wf.draftNodes?.length || 0} nodes
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={wf.status} />
                    </div>
                  ))}

                  <button
                    onClick={() => { setSelectedBot(bot.id); setShowWizard(true); }}
                    style={{
                      width: '100%', padding: '10px', marginTop: 8,
                      background: 'transparent', border: '1px dashed rgba(148,163,184,0.2)',
                      borderRadius: 10, color: '#64748b', fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.3)'; e.currentTarget.style.color = '#818cf8'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.2)'; e.currentTarget.style.color = '#64748b'; }}
                  >
                    <Plus size={14} /> New Workflow
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Wizard Modal */}
      {showWizard && (
        <CreateWorkflowWizard
          bots={bots}
          preselectedBotId={selectedBot}
          onClose={() => { setShowWizard(false); setSelectedBot(''); }}
          onCreated={(wf) => { setShowWizard(false); setSelectedBot(''); nav(`/bot-builder/${wf.id}`); }}
        />
      )}
    </div>
  );
}

// ─── Workflow Editor Page (wraps VisualBuilder) ──────────────────────────────

function WorkflowEditorPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const nav = useNavigate();
  const { token } = useAuth();
  const [tab, setTab] = useState<'builder' | 'commands' | 'versions' | 'executions'>('builder');
  const [workflow, setWorkflow] = useState<BotWorkflowDto | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) return;
    const activeToken = token || useAuth.getState().token;
    if (!activeToken) return;
    try {
      const data = await api.getBotWorkflow(activeToken, workflowId);
      setWorkflow(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [workflowId, token]);

  useEffect(() => { fetchWorkflow(); }, [fetchWorkflow]);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading workflow...</div>;
  if (!workflow) return <div style={{ padding: 60, textAlign: 'center', color: '#ef4444' }}>Workflow not found</div>;

  const tabs = [
    { key: 'builder', label: 'Builder', icon: <Zap size={15} /> },
    { key: 'commands', label: 'Commands', icon: <Command size={15} /> },
    { key: 'versions', label: 'Versions', icon: <History size={15} /> },
    { key: 'executions', label: 'Executions', icon: <Activity size={15} /> },
  ] as const;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', background: 'rgba(15,23,42,0.9)',
        borderBottom: '1px solid rgba(148,163,184,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => nav('/bot-builder')} style={{
            background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
          }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ width: 1, height: 24, background: 'rgba(148,163,184,0.15)' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{workflow.name}</h2>
            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={workflow.status} />
              <span>v{workflow.publishedVersionNumber || 0}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                background: tab === t.key ? 'rgba(129,140,248,0.15)' : 'transparent',
                color: tab === t.key ? '#818cf8' : '#94a3b8',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'builder' && <VisualBuilder workflow={workflow} onUpdate={fetchWorkflow} />}
        {tab === 'commands' && <CommandBuilder botId={workflow.botId} workflowId={workflow.id} />}
        {tab === 'versions' && <VersionHistory workflowId={workflow.id} currentVersion={workflow.publishedVersionNumber} onRollback={fetchWorkflow} />}
        {tab === 'executions' && <ExecutionDebugger botId={workflow.botId} />}
      </div>
    </div>
  );
}

// ─── Page Router ─────────────────────────────────────────────────────────────

export default function BotBuilderPage() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path=":workflowId" element={<WorkflowEditorPage />} />
    </Routes>
  );
}
