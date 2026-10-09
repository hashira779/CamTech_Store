import React from 'react';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70  flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-6 rounded-lg border border-destructive/30 shadow-md bg-card space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-destructive/15 text-destructive shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
          <button
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg border border-border/80 bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
          >
            {isPending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {confirmText.replace('Delete', 'Deleting').replace('Unbind', 'Unbinding')}...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" /> {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
