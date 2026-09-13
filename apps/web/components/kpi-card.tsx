import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number; // percentage, e.g. +14.2
  changeLabel?: string; // e.g. 'vs last month'
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel = 'vs previous period',
  icon: Icon,
  iconColor = 'text-primary',
  isLoading = false,
  className,
}: KpiCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <Card
      className={cn(
        'rounded-lg border border-border bg-card',
        className
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground truncate">
            {title}
          </p>
          <div
            className={cn(
              'p-2 rounded-md bg-accent shrink-0',
              iconColor
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2">
          {isLoading ? (
            <Skeleton className="h-8 w-28 rounded" />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {value}
            </div>
          )}
        </div>

        {change !== undefined ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold text-[11px] tabular-nums',
                isPositive && 'text-emerald-600 dark:text-emerald-400',
                isNegative && 'text-red-600 dark:text-red-400',
                !isPositive && !isNegative && 'text-muted-foreground'
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : isNegative ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {isPositive ? `+${change}%` : `${change}%`}
            </span>
            <span className="text-[11px] text-muted-foreground truncate">{changeLabel}</span>
          </div>
        ) : (
          changeLabel && (
            <div className="mt-2 text-[11px] text-muted-foreground truncate">
              {changeLabel}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

export default KpiCard;
