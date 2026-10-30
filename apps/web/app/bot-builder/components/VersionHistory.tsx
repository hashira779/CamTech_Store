import React, { useState, useEffect, useCallback } from 'react';
import {
  History, RotateCcw, CheckCircle2, ChevronRight, Calendar,
  User, Layers, FileText, AlertCircle, Eye,
} from 'lucide-react';
import type { BotWorkflowVersionDto } from '@mystore/contracts';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';

interface Props {
  workflowId: string;
  currentVersion?: number | null;
  onRollback: () => void;
}

export function VersionHistory({ workflowId, currentVersion, onRollback }: Props) {
  const { token } = useAuth();
  const [versions, setVersions] = useState<BotWorkflowVersionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<BotWorkflowVersionDto | null>(null);
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    const activeToken = token || useAuth.getState().token || '';
    if (!activeToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await api.listWorkflowVersions(activeToken, workflowId);
      setVersions(list || []);
      if (list && list.length > 0 && !selectedVersion) {
        setSelectedVersion(list[0]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load version history');
    }
    setLoading(false);
  }, [workflowId, selectedVersion, token]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleRollback = async (versionNumber: number) => {
    setRollingBack(versionNumber);
    setError(null);
    try {
      const activeToken = token || useAuth.getState().token || '';
      await api.rollbackBotWorkflow(activeToken, workflowId, versionNumber);
      setConfirmVersion(null);
      onRollback();
      await fetchVersions();
    } catch (e: any) {
      setError(e.message || 'Rollback failed');
    }
    setRollingBack(null);
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Left List of Versions */}
      <div style={{
        width: 380, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <History size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
            Release History
          </h3>
          <span style={{
            marginLeft: 'auto', fontSize: 12, background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
            color: 'var(--primary)', padding: '2px 8px', borderRadius: 12, fontWeight: 600,
          }}>
            {versions.length} versions
          </span>
        </div>

        {error && (
          <div style={{
            margin: 12, padding: 10, background: 'color-mix(in srgb, var(--destructive) 15%, transparent)',
            color: 'var(--destructive)', borderRadius: 8, fontSize: 12, display: 'flex', gap: 8,
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)', fontSize: 13 }}>
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 16px', color: 'var(--muted-foreground)', fontSize: 13,
            }}>
              No published versions yet. Click &quot;Publish&quot; in the builder to create v1.
            </div>
          ) : (
            versions.map(v => {
              const isCurrent = v.versionNumber === currentVersion;
              const isSelected = selectedVersion?.id === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVersion(v)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, marginBottom: 8,
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
                      <span style={{
                        fontSize: 14, fontWeight: 700,
                        color: isCurrent ? 'var(--success)' : 'var(--foreground)',
                      }}>
                        v{v.versionNumber}
                      </span>
                      {isCurrent && (
                        <span style={{
                          background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)',
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <CheckCircle2 size={12} /> Active Live
                        </span>
                      )}
                    </div>
                    <ChevronRight size={14} style={{ color: isSelected ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                    {v.notes ? v.notes : 'No release notes'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} />
                      {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : 'N/A'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Layers size={12} />
                      {v.nodes?.length || 0} nodes
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Snapshot Viewer & Rollback Action */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedVersion ? (
          <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              paddingBottom: 20, borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--foreground)' }}>
                    Version {selectedVersion.versionNumber}
                  </h2>
                  {selectedVersion.versionNumber === currentVersion ? (
                    <span style={{
                      background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)',
                      padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    }}>
                      Current Active Release
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmVersion(selectedVersion.versionNumber)}
                      disabled={rollingBack !== null}
                      style={{
                        background: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)',
                        border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)', borderRadius: 8,
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'background 0.15s',
                      }}
                    >
                      <RotateCcw size={14} /> Rollback to v{selectedVersion.versionNumber}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 13, color: 'var(--muted-foreground)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} />
                    Published: {selectedVersion.publishedAt ? new Date(selectedVersion.publishedAt).toLocaleString() : 'N/A'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={14} />
                    Published By: {selectedVersion.publishedBy || 'User'}
                  </span>
                </div>
              </div>
            </div>

            {/* Confirmation Modal / Banner for Rollback */}
            {confirmVersion === selectedVersion.versionNumber && (
              <div style={{
                marginTop: 20, padding: 16, borderRadius: 10,
                background: 'color-mix(in srgb, var(--warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#fef08a', fontSize: 14 }}>
                    Confirm Rollback to v{selectedVersion.versionNumber}?
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--foreground)', marginTop: 4 }}>
                    The live Telegram bot will immediately start running this snapshot. Your current draft canvas remains untouched.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setConfirmVersion(null)}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 12,
                      background: 'var(--border)', border: 'none',
                      color: 'var(--foreground)', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRollback(selectedVersion.versionNumber)}
                    disabled={rollingBack !== null}
                    style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'var(--warning)', border: 'none', color: 'var(--background)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {rollingBack === selectedVersion.versionNumber ? 'Rolling back...' : 'Confirm Rollback'}
                  </button>
                </div>
              </div>
            )}

            {/* Release Notes */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 8 }}>
                Release Notes
              </div>
              <div style={{
                background: 'var(--card)', padding: 16, borderRadius: 10,
                border: '1px solid var(--border)', fontSize: 14, color: 'var(--foreground)',
                lineHeight: 1.5,
              }}>
                {selectedVersion.notes || 'No notes provided for this version.'}
              </div>
            </div>

            {/* Architecture Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 20 }}>
              <div style={{
                background: 'var(--card)', padding: 16, borderRadius: 10,
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Total Nodes</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
                  {selectedVersion.nodes?.length || 0}
                </div>
              </div>
              <div style={{
                background: 'var(--card)', padding: 16, borderRadius: 10,
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Total Edges</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
                  {selectedVersion.edges?.length || 0}
                </div>
              </div>
              <div style={{
                background: 'var(--card)', padding: 16, borderRadius: 10,
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Active Commands</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
                  {selectedVersion.commands?.length || 0}
                </div>
              </div>
            </div>

            {/* Nodes Breakdown in Snapshot */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 8 }}>
                Workflow Topology ({selectedVersion.nodes?.length || 0} Nodes)
              </div>
              <div style={{
                background: 'var(--card)', borderRadius: 10,
                border: '1px solid var(--border)', overflow: 'hidden',
              }}>
                {(selectedVersion.nodes || []).map((node, i) => (
                  <div
                    key={node.id || i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: i < (selectedVersion.nodes?.length || 0) - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 11, background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)',
                        padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace',
                      }}>
                        {node.type}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                        {node.data?.label || node.id}
                      </span>
                    </div>
                    {node.data?.config?.message && (
                      <span style={{
                        fontSize: 12, color: 'var(--muted-foreground)', maxWidth: 260,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {node.data.config.message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flex: 1, color: 'var(--muted-foreground)', fontSize: 14,
          }}>
            Select a version on the left to inspect its snapshot details.
          </div>
        )}
      </div>
    </div>
  );
}
