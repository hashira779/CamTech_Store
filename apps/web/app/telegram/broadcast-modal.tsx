'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-store';
import { X, Radio } from 'lucide-react';
import type { TelegramBotDto } from '@mystore/contracts';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  bots: TelegramBotDto[];
  initialSelectedBot?: string;
}

export function BroadcastModal({ isOpen, onClose, bots, initialSelectedBot = '' }: BroadcastModalProps) {
  const { token } = useAuth();
  
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSelectedBot, setBroadcastSelectedBot] = useState<string>(initialSelectedBot);

  // Update selected bot if props change
  React.useEffect(() => {
    if (isOpen) {
      setBroadcastSelectedBot(initialSelectedBot);
    }
  }, [isOpen, initialSelectedBot]);

  const broadcastMutation = useMutation({
    mutationFn: (input: { msg: string; botId?: string }) => {
      console.log('[Telegram] Dispatching broadcast via bot:', input.botId || 'ALL');
      return api.sendTelegramBroadcast(token!, input.msg, input.botId);
    },
    onSuccess: (data) => {
      toast.success(`Broadcast dispatched successfully`);
      onClose();
      setBroadcastMessage('');
    },
    onError: (err: any) => {
      console.error('[Telegram] Broadcast failed:', err);
      toast.error(err instanceof ApiClientError ? err.message : 'Broadcast Failed');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60  p-4">
      <div className="card w-full max-w-md p-6 rounded-lg border border-border shadow-md bg-card">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-400" />
            <h3 className="text-base font-bold text-foreground">Dispatch Telegram Broadcast</h3>
          </div>
          <button onClick={onClose}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            broadcastMutation.mutate({
              msg: broadcastMessage,
              botId: broadcastSelectedBot || undefined,
            });
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Dispatching Bot
            </label>
            <select
              value={broadcastSelectedBot}
              onChange={(e) => setBroadcastSelectedBot(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background"
            >
              <option value="">All Active Bots / Primary Bot</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.purpose})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Alert Message *
            </label>
            <textarea
              rows={4}
              required
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Type broadcast message (markdown supported)..."
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background"
            />
          </div>

          {/* Quick Templates */}
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1.5">
              Quick Templates:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setBroadcastMessage('🚨 URGENT: Low inventory detected on high-velocity items. Please review replenishment.')
                }
                className="px-2 py-1 rounded text-[10px] bg-muted/60 hover:bg-muted border border-border/60"
              >
                📦 Low Stock
              </button>
              <button
                type="button"
                onClick={() =>
                  setBroadcastMessage('🎉 FLASH SALE: Weekend promotion is now active across all retail branches!')
                }
                className="px-2 py-1 rounded text-[10px] bg-muted/60 hover:bg-muted border border-border/60"
              >
                🛍️ Flash Sale
              </button>
              <button
                type="button"
                onClick={() =>
                  setBroadcastMessage('⚡ SYSTEM: Daily fiscal closing completed. All batch receipts reconciled.')
                }
                className="px-2 py-1 rounded text-[10px] bg-muted/60 hover:bg-muted border border-border/60"
              >
                ✅ Fiscal Reconciled
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={broadcastMutation.isPending}
              className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold shadow-sm transition-all"
            >
              {broadcastMutation.isPending ? 'Broadcasting...' : 'Send Broadcast'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
