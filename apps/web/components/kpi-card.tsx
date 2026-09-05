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
        'relative overflow-hidden rounded-2xl border border-border/80 bg-card/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl group',
        className
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-muted-foreground/90 uppercase tracking-wider truncate">
            {title}
          </p>
          <div
            className={cn(
              'p-2.5 rounded-xl bg-muted/70 border border-border/50 shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-xs',
              iconColor
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5">
          {isLoading ? (
            <Skeleton className="h-8 w-28 rounded-lg" />
          ) : (
            <div className="text-2xl sm:text-[26px] font-bold tracking-tight text-foreground tabular-nums">
              {value}
            </div>
          )}
        </div>

        {change !== undefined ? (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded-md text-[11px] tabular-nums shadow-2xs',
                isPositive && 'bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20',
                isNegative && 'bg-rose-500/15 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20',
                !isPositive && !isNegative && 'bg-muted text-muted-foreground border border-border/50'
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
            <span className="text-[11px] text-muted-foreground/80 truncate">{changeLabel}</span>
          </div>
        ) : (
          changeLabel && (
            <div className="mt-2.5 text-[11px] text-muted-foreground/80 flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              <span className="truncate">{changeLabel}</span>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

export default KpiCard;
