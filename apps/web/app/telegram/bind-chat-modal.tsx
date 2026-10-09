'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-store';
import { X } from 'lucide-react';
import type { TelegramBotDto, BindTelegramChatInput } from '@mystore/contracts';

interface BindChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  bots: TelegramBotDto[];
}

export function BindChatModal({ isOpen, onClose, bots }: BindChatModalProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [bindChatId, setBindChatId] = useState('');
  const [bindChatTitle, setBindChatTitle] = useState('');
  const [bindRole, setBindRole] = useState('OPERATOR');
  const [bindBotId, setBindBotId] = useState('');
  const [bindType, setBindType] = useState<'USER' | 'GROUP'>('GROUP');

  const bindMutation = useMutation({
    mutationFn: (input: BindTelegramChatInput) => {
      console.log('[Telegram] Binding destination chat:', input);
      return api.bindTelegramChat(token!, input);
    },
    onSuccess: () => {
      toast.success('Telegram chat destination bound successfully');
      queryClient.invalidateQueries({ queryKey: ['telegramBindings'] });
      onClose();
      setBindChatId('');
      setBindChatTitle('');
      setBindBotId('');
    },
    onError: (err: any) => {
      console.error('[Telegram] Failed to bind chat destination:', err);
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to bind chat');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60  p-4">
      <div className="card w-full max-w-sm p-6 rounded-lg border border-border shadow-md bg-card">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-border/60">
          <h3 className="text-base font-bold text-foreground">Bind Telegram Destination</h3>
          <button onClick={onClose}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            bindMutation.mutate({
              chatId: bindChatId,
              chatTitle: bindChatTitle || undefined,
              role: bindRole,
              botId: bindBotId || undefined,
              bindingType: bindType,
            });
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Telegram Chat ID *
            </label>
            <input
              required
              value={bindChatId}
              onChange={(e) => setBindChatId(e.target.value)}
              placeholder="e.g. 987654321 or -100123456"
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background font-mono"
            />
          </div>
          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Destination Title
            </label>
            <input
              value={bindChatTitle}
              onChange={(e) => setBindChatTitle(e.target.value)}
              placeholder="e.g. Phnom Penh Cashiers Group"
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background"
            />
          </div>
          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Assign Specific Bot (Optional)
            </label>
            <select
              value={bindBotId}
              onChange={(e) => setBindBotId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background"
            >
              <option value="">Default / Primary Bot</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.purpose})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Assigned Role
            </label>
            <select
              value={bindRole}
              onChange={(e) => setBindRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background"
            >
              <option value="OPERATOR">OPERATOR (Sales, stock, orders)</option>
              <option value="BRANCH_MANAGER">BRANCH_MANAGER (All commands + approvals)</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN (Full platform access)</option>
              <option value="DISPATCHER">DISPATCHER (Fleet & Delivery)</option>
              <option value="CASHIER">CASHIER (Checkout transactions)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bindMutation.isPending}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold"
            >
              {bindMutation.isPending ? 'Binding...' : 'Authorize'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
