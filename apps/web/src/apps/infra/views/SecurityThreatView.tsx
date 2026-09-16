import React, { useState } from 'react';
import { type SecurityEventDTO, type ActiveBanDTO } from '@mystore/contracts';
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  Unlock,
  AlertTriangle,
  Clock,
  Globe,
  Plus,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

interface SecurityThreatViewProps {
  events?: SecurityEventDTO[];
  bans?: ActiveBanDTO[];
  onBanIp?: (ip: string, reason: string, durationHours?: number) => Promise<void>;
  onUnbanIp?: (ip: string) => Promise<void>;
}

export function SecurityThreatView({
  events = [],
  bans = [],
  onBanIp,
  onUnbanIp,
}: SecurityThreatViewProps) {
  const [showBanModal, setShowBanModal] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newDuration, setNewDuration] = useState('24');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim()) {
      toast.error('Please enter a valid IP address.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onBanIp?.(newIp.trim(), newReason.trim() || 'Manual defensive block', Number(newDuration));
      toast.success(`IP ${newIp} blocked successfully.`);
      setShowBanModal(false);
      setNewIp('');
      setNewReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to ban IP');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnban = async (ip: string) => {
    try {
      await onUnbanIp?.(ip);
      toast.success(`IP ${ip} unbanned.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to unban IP');
    }
  };

  const filteredBans = bans.filter(
    (b) => b.ip.includes(searchTerm) || b.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── Status Banner & Actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            Threat Center & Edge IP Registry
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time Redis sliding-window violations, automated 429 escalation, and manual defensive IP blocking.
          </p>
        </div>

        <button
          onClick={() => setShowBanModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-[0_0_15px_rgba(244,63,94,0.3)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Enact Defensive IP Ban</span>
        </button>
      </div>

      {/* ── Active Ban Registry Table ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Active IP Blocklist ({bans.length})
            </h3>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search banned IP or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-700/80 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden">
          {filteredBans.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-xs font-bold text-white">No Active IP Blocks</div>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                No abusive or auto-escalated IP addresses currently present in the edge ban registry.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 text-[11px] uppercase tracking-wider">
                  <th className="p-3">Blocked IP</th>
                  <th className="p-3">Reason / Trigger Rule</th>
                  <th className="p-3">Banned By</th>
                  <th className="p-3">Banned At</th>
                  <th className="p-3">TTL Remaining</th>
                  <th className="p-3 text-right">Defensive Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredBans.map((b) => (
                  <tr key={b.ip} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3 font-bold text-rose-400">{b.ip}</td>
                    <td className="p-3 text-zinc-200">{b.reason}</td>
                    <td className="p-3 text-zinc-400">{b.banned_by || 'System Escalation'}</td>
                    <td className="p-3 text-zinc-500">
                      {new Date(b.banned_at * 1000).toLocaleTimeString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-zinc-950 text-amber-300 border border-zinc-800 text-[10px]">
                        {b.ttl_remaining_seconds > 0
                          ? `${Math.round(b.ttl_remaining_seconds / 60)} min remaining`
                          : 'Permanent (1 Year)'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleUnban(b.ip)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-sans transition cursor-pointer"
                      >
                        <Unlock className="w-3 h-3 text-emerald-400" />
                        <span>Unban</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Security Anomaly Event Feed ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Security Detections & Signals Log
          </h3>
        </div>

        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 divide-y divide-zinc-800/60">
          {events.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No recent security anomalies recorded.
            </div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="p-4 flex items-start justify-between gap-4 hover:bg-zinc-800/20 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px] font-mono">
                      {e.severity}
                    </span>
                    <span className="text-xs font-bold text-white">{e.title}</span>
                    <span className="text-[10px] font-mono text-zinc-500">[{e.ruleId}]</span>
                  </div>
                  <p className="text-xs text-zinc-400">{e.description}</p>
                  <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-3 pt-1">
                    <span>Target: <strong className="text-zinc-300">{e.affectedService}</strong></span>
                    <span>Source: <strong className="text-zinc-300">{e.sourceIp}</strong> ({e.approximateGeo?.country || 'Unknown'})</span>
                    {e.defenseAction && (
                      <span className="text-emerald-400">Action: {e.defenseAction.actionTaken}</span>
                    )}
                  </div>
                </div>

                <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Manual Ban Dialog Modal ── */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleBanSubmit}
            className="w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Ban className="w-4 h-4" />
                <span>Enforce Edge IP Ban</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBanModal(false)}
                className="text-zinc-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-mono">Target IP Address</label>
                <input
                  type="text"
                  placeholder="e.g. 185.220.101.5"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-mono">Operational Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Credential stuffing burst on /api/v1/auth/login"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-mono">Duration (Hours)</label>
                <select
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono focus:outline-none focus:border-rose-500"
                >
                  <option value="1">1 Hour (Defensive Hold)</option>
                  <option value="24">24 Hours (Standard Mitigation)</option>
                  <option value="168">7 Days (Severe Repeated Abuse)</option>
                  <option value="8760">1 Year (Permanent Edge Block)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowBanModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmitting ? 'Applying Ban...' : 'Confirm Block'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
