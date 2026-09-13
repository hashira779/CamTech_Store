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
        'flex flex-col items-center justify-center p-10 text-center rounded-lg border border-dashed border-border/70 bg-card/40 -xs my-4',
        className
      )}
    >
      <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/20 text-primary mb-3 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="mt-4 rounded-lg shadow-xs font-semibold">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
