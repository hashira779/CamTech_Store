import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, CheckCircle2, XCircle, Clock, RefreshCw,
  Search, ChevronRight, Terminal, User, ArrowRight,
  AlertTriangle, Filter, CornerDownRight, Database,
} from 'lucide-react';
import type { BotExecutionDto, BotExecutionTraceItemDto } from '@mystore/contracts';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';

interface Props {
  botId: string;
}

export function ExecutionDebugger({ botId }: Props) {
  const { token } = useAuth();
  const [executions, setExecutions] = useState<BotExecutionDto[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<BotExecutionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [analytics, setAnalytics] = useState<{
    totalExecutions: number;
    successRate: number;
    failedCount: number;
    uniqueUsers: number;
  } | null>(null);

  const fetchExecutions = useCallback(async () => {
    const activeToken = token || useAuth.getState().token || '';
    if (!activeToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await api.listBotExecutions(
        activeToken,
        botId,
        page,
        30,
        statusFilter !== 'ALL' ? statusFilter : undefined,
      );
      setExecutions(list || []);
      if (list && list.length > 0 && !selectedExecution) {
        setSelectedExecution(list[0]);
      }
    } catch (e) {
      console.error('Failed to load executions:', e);
    }
    setLoading(false);
  }, [botId, page, statusFilter, selectedExecution, token]);

  const fetchAnalytics = useCallback(async () => {
    const activeToken = token || useAuth.getState().token || '';
    if (!activeToken) return;
    try {
      const data = await api.getBotAnalytics(activeToken, botId);
      if (data) {
        setAnalytics(data);
      }
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    }
  }, [botId, token]);

  useEffect(() => {
    fetchExecutions();
    fetchAnalytics();
  }, [fetchExecutions, fetchAnalytics]);

  const formatDuration = (ms?: number) => {
    if (!ms && ms !== 0) return '0ms';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Top Analytics Bar */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
        background: 'var(--muted)',
      }}>
        <div style={{
          background: 'var(--card)', padding: '12px 16px', borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Executions</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', marginTop: 4 }}>
            {analytics?.totalExecutions ?? executions.length}
          </div>
        </div>
        <div style={{
          background: 'var(--card)', padding: '12px 16px', borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Success Rate</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)', marginTop: 4 }}>
            {analytics ? `${(analytics.successRate * 100).toFixed(1)}%` : '100%'}
          </div>
        </div>
        <div style={{
          background: 'var(--card)', padding: '12px 16px', borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Failed Runs</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--destructive)', marginTop: 4 }}>
            {analytics?.failedCount ?? 0}
          </div>
        </div>
        <div style={{
          background: 'var(--card)', padding: '12px 16px', borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unique Telegram Users</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
            {analytics?.uniqueUsers ?? 0}
          </div>
        </div>
      </div>

      {/* Main Content: Left List + Right Trace Details */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Executions Table / List */}
        <div style={{
          width: 440, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Filter / Refresh Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['ALL', 'SUCCESS', 'FAILED'].map(st => (
                <button
                  key={st}
                  onClick={() => { setStatusFilter(st); setPage(1); }}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: statusFilter === st ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'var(--card)',
                    color: statusFilter === st ? 'var(--primary)' : 'var(--muted-foreground)',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
            <button
              onClick={() => { fetchExecutions(); fetchAnalytics(); }}
              style={{
                background: 'transparent', border: 'none', color: 'var(--muted-foreground)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* List Items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)', fontSize: 13 }}>
                Loading executions...
              </div>
            ) : executions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted-foreground)', fontSize: 13 }}>
                No execution traces recorded yet. Send a message to your Telegram bot to test!
              </div>
            ) : (
              executions.map(exec => {
                const isSelected = selectedExecution?.id === exec.id;
                const isSuccess = exec.status === 'SUCCESS';
                return (
                  <div
                    key={exec.id}
                    onClick={() => setSelectedExecution(exec)}
                    style={{
                      padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                      cursor: 'pointer',
                      background: isSelected
                        ? 'color-mix(in srgb, var(--primary) 12%, transparent)'
                        : 'var(--card)',
                      border: `1px solid ${isSelected ? 'color-mix(in srgb, var(--primary) 30%, transparent)' : 'var(--border)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isSuccess ? (
                          <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                        ) : (
                          <XCircle size={15} style={{ color: 'var(--destructive)' }} />
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                          {exec.triggerType}: {exec.triggerData?.command || exec.triggerData?.text || 'event'}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                        background: isSuccess ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--destructive) 15%, transparent)',
                        color: isSuccess ? 'var(--success)' : 'var(--destructive)',
                      }}>
                        {exec.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)' }}>
                      <span>User ID: {exec.telegramUserId || 'Anonymous'}</span>
                      <span>v{exec.versionNumber || 1} · {exec.executionTrace?.length || 0} nodes</span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                      {exec.startedAt ? new Date(exec.startedAt).toLocaleTimeString() : ''}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Trace Debugger Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedExecution ? (
            <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
              {/* Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                paddingBottom: 20, borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
                      Execution Trace: {selectedExecution.id.substring(0, 12)}
                    </h2>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600,
                      background: selectedExecution.status === 'SUCCESS' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--destructive) 15%, transparent)',
                      color: selectedExecution.status === 'SUCCESS' ? 'var(--success)' : 'var(--destructive)',
                    }}>
                      {selectedExecution.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>
                    <span>Trigger: <strong>{selectedExecution.triggerType}</strong></span>
                    <span>Chat ID: <strong>{selectedExecution.chatId || 'N/A'}</strong></span>
                    <span>Workflow Version: <strong>v{selectedExecution.versionNumber}</strong></span>
                    <span>Started: {selectedExecution.startedAt ? new Date(selectedExecution.startedAt).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Error Callout if Failed */}
              {selectedExecution.errorMessage && (
                <div style={{
                  marginTop: 16, padding: 14, borderRadius: 10,
                  background: 'color-mix(in srgb, var(--destructive) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--destructive) 30%, transparent)',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <AlertTriangle size={18} style={{ color: 'var(--destructive)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fca5a5' }}>
                      Runtime Execution Error
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4, fontFamily: 'monospace' }}>
                      {selectedExecution.errorMessage}
                    </div>
                  </div>
                </div>
              )}

              {/* Node Execution Step-by-Step Flow */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 16 }}>
                  Execution Pipeline ({selectedExecution.executionTrace?.length || 0} Steps)
                </div>

                {(!selectedExecution.executionTrace || selectedExecution.executionTrace.length === 0) ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', background: 'var(--card)', borderRadius: 10 }}>
                    No intermediate node traces recorded for this execution.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {selectedExecution.executionTrace.map((step: BotExecutionTraceItemDto, index: number) => {
                      const isStepSuccess = step.status === 'SUCCESS';
                      return (
                        <div
                          key={index}
                          style={{
                            background: 'var(--card)', borderRadius: 10,
                            border: `1px solid ${isStepSuccess ? 'var(--border)' : 'color-mix(in srgb, var(--destructive) 30%, transparent)'}`,
                            padding: 16,
                          }}
                        >
                          {/* Step Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: isStepSuccess ? 'color-mix(in srgb, var(--success) 20%, transparent)' : 'color-mix(in srgb, var(--destructive) 20%, transparent)',
                                color: isStepSuccess ? 'var(--success)' : 'var(--destructive)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700,
                              }}>
                                {index + 1}
                              </span>
                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                                {step.nodeName || step.nodeId}
                              </span>
                              <span style={{
                                fontSize: 10, background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)',
                                padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace',
                              }}>
                                {step.nodeType}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} /> {formatDuration(step.durationMs)}
                              </span>
                              <span style={{
                                fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                                background: isStepSuccess ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--destructive) 15%, transparent)',
                                color: isStepSuccess ? 'var(--success)' : 'var(--destructive)',
                              }}>
                                {step.status}
                              </span>
                            </div>
                          </div>

                          {/* Node Step Details (Input / Output / Error) */}
                          {step.errorMessage && (
                            <div style={{
                              marginTop: 10, padding: 8, background: 'color-mix(in srgb, var(--destructive) 15%, transparent)',
                              color: 'var(--destructive)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace',
                            }}>
                              {step.errorMessage}
                            </div>
                          )}

                          <div style={{
                            display: 'grid', gridTemplateColumns: step.outputData ? '1fr 1fr' : '1fr',
                            gap: 12, marginTop: 12,
                          }}>
                            {step.inputData && (
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: 4 }}>
                                  INPUT DATA
                                </div>
                                <pre style={{
                                  background: '#0a0f1d', padding: 10, borderRadius: 6,
                                  fontSize: 11, color: 'var(--info)', margin: 0,
                                  maxHeight: 120, overflowY: 'auto',
                                }}>
                                  {JSON.stringify(step.inputData, null, 2)}
                                </pre>
                              </div>
                            )}
                            {step.outputData && (
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: 4 }}>
                                  OUTPUT / RESULT
                                </div>
                                <pre style={{
                                  background: '#0a0f1d', padding: 10, borderRadius: 6,
                                  fontSize: 11, color: '#a78bfa', margin: 0,
                                  maxHeight: 120, overflowY: 'auto',
                                }}>
                                  {JSON.stringify(step.outputData, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flex: 1, color: 'var(--muted-foreground)', fontSize: 14,
            }}>
              Select an execution on the left to inspect its pipeline trace.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
