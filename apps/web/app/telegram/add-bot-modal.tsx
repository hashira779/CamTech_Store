import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-store';
import { Bot, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TelegramBotPurpose } from '@mystore/contracts';
import { useTelegramTokenTest } from '@/lib/use-telegram-token-test';
import { PURPOSE_OPTIONS } from '@/lib/telegram-constants';

interface AddBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBotModal({ isOpen, onClose }: AddBotModalProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [botPurpose, setBotPurpose] = useState<TelegramBotPurpose>('SALES');
  const [botDefaultChatId, setBotDefaultChatId] = useState('');
  const [botDescription, setBotDescription] = useState('');
  const [botIsPrimary, setBotIsPrimary] = useState(false);
  const { testResult, isTesting, testToken, resetResult } = useTelegramTokenTest();

  const resetForm = () => {
    setBotName('');
    setBotToken('');
    setBotPurpose('SALES');
    setBotDefaultChatId('');
    setBotDescription('');
    setBotIsPrimary(false);
    resetResult();
  };

  const createBotMutation = useMutation({
    mutationFn: (input: any) => api.createTelegramBot(token!, input),
    onSuccess: () => {
      toast.success('Telegram bot registered successfully');
      queryClient.invalidateQueries({ queryKey: ['telegramBots'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to create bot');
    },
  });



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-lg p-6 rounded-lg border border-border shadow-md bg-card">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Add New Telegram Bot</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createBotMutation.mutate({
              name: botName,
              botToken,
              purpose: botPurpose,
              defaultChatId: botDefaultChatId || undefined,
              description: botDescription || undefined,
              isPrimary: botIsPrimary,
              isActive: true,
            });
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Bot Friendly Name *
            </label>
            <input
              required
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="e.g. Sales Alerts Bot"
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background"
            />
          </div>

          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Operational Purpose / Department *
            </label>
            <select
              value={botPurpose}
              onChange={(e) => setBotPurpose(e.target.value as TelegramBotPurpose)}
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background"
            >
              {PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block uppercase font-bold text-muted-foreground text-[11px]">
                Telegram Bot Token *
              </label>
              <button
                type="button"
                onClick={() => testToken(botToken)}
                disabled={!botToken.trim() || isTesting}
                className="text-[11px] text-primary hover:text-primary/80 font-semibold flex items-center gap-1 disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Testing API...' : 'Test Token'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                required
                type="password"
                value={botToken}
                onChange={(e) => {
                  setBotToken(e.target.value);
                  resetResult();
                }}
                className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background font-mono text-xs"
              />
            </div>
            {testResult && (
              <div className={`mt-2 p-3 rounded-lg text-xs border ${testResult.success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'}`}>
                {testResult.success ? (
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Verified: @{testResult.botUsername}
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <div className="font-bold text-rose-400">{testResult.botName}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Default Chat ID (Optional)
            </label>
            <input
              value={botDefaultChatId}
              onChange={(e) => setBotDefaultChatId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background font-mono"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={botIsPrimary}
              onChange={(e) => setBotIsPrimary(e.target.checked)}
              className="rounded border-border text-primary"
            />
            <label className="text-xs font-medium">Set as Primary</label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={createBotMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold">
              {createBotMutation.isPending ? 'Saving...' : 'Save Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
