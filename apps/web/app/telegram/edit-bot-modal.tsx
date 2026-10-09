import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-store';
import { Edit2, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TelegramBotPurpose, TelegramBotDto } from '@mystore/contracts';
import { useTelegramTokenTest } from '@/lib/use-telegram-token-test';
import { PURPOSE_OPTIONS } from '@/lib/telegram-constants';

interface EditBotModalProps {
  bot: TelegramBotDto | null;
  onClose: () => void;
}

export function EditBotModal({ bot, onClose }: EditBotModalProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [editName, setEditName] = useState('');
  const [editToken, setEditToken] = useState('');
  const [editPurpose, setEditPurpose] = useState<TelegramBotPurpose>('SALES');
  const [editDefaultChatId, setEditDefaultChatId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const { testResult, isTesting, testToken, resetResult } = useTelegramTokenTest();

  useEffect(() => {
    if (bot) {
      setEditName(bot.name);
      setEditToken('');
      setEditPurpose(bot.purpose as TelegramBotPurpose);
      setEditDefaultChatId(bot.defaultChatId || '');
      setEditDescription(bot.description || '');
      setEditIsPrimary(bot.isPrimary || false);
      setEditIsActive(bot.isActive !== false);
      resetResult();
    }
  }, [bot]);

  const updateBotMutation = useMutation({
    mutationFn: ({ id, input }: any) => api.updateTelegramBot(token!, id, input),
    onSuccess: () => {
      toast.success('Telegram bot updated successfully');
      queryClient.invalidateQueries({ queryKey: ['telegramBots'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to update bot');
    },
  });



  if (!bot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-lg p-6 rounded-lg border border-border shadow-md bg-card">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Edit Telegram Bot: {bot.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateBotMutation.mutate({
              id: bot.id,
              input: {
                name: editName,
                botToken: editToken || undefined,
                purpose: editPurpose,
                defaultChatId: editDefaultChatId || undefined,
                description: editDescription || undefined,
                isPrimary: editIsPrimary,
                isActive: editIsActive,
              },
            });
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Bot Friendly Name
            </label>
            <input
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background"
            />
          </div>

          <div>
            <label className="block uppercase font-bold text-muted-foreground mb-1 text-[11px]">
              Operational Purpose / Department
            </label>
            <select
              value={editPurpose}
              onChange={(e) => setEditPurpose(e.target.value as TelegramBotPurpose)}
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
                Update Bot Token (Leave blank to keep current token)
              </label>
              <button
                type="button"
                onClick={() => testToken(editToken)}
                disabled={!editToken.trim() || isTesting}
                className="text-[11px] text-primary hover:text-primary/80 font-semibold flex items-center gap-1 disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ` + (isTesting ? 'animate-spin' : '')} />
                {isTesting ? 'Testing API...' : 'Test Token'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={editToken}
                onChange={(e) => {
                  setEditToken(e.target.value);
                  resetResult();
                }}
                placeholder="Enter new token only if rotating credentials..."
                className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background font-mono text-xs"
              />
            </div>

            {testResult && (
              <div className={`mt-2 p-3 rounded-lg text-xs border ` + (testResult.success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30')}>
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
              Default Group / Channel Chat ID
            </label>
            <input
              value={editDefaultChatId}
              onChange={(e) => setEditDefaultChatId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/80 bg-background font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editIsPrimary}
                onChange={(e) => setEditIsPrimary(e.target.checked)}
                className="rounded border-border text-primary"
              />
              <label className="text-xs font-medium">Primary Bot</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
                className="rounded border-border text-primary"
              />
              <label className="text-xs font-medium text-emerald-500">Active Status</label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={updateBotMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold">
              {updateBotMutation.isPending ? 'Saving...' : 'Update Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
