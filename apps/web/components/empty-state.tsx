import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-10 text-center rounded-2xl border border-dashed border-border/70 bg-card/40 backdrop-blur-xs my-4',
        className
      )}
    >
      <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-3 shadow-2xs">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="mt-4 rounded-xl shadow-xs font-semibold">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
