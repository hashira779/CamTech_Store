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
    <Card className={cn('relative overflow-hidden transition-all duration-200 hover:border-border/80 hover:shadow-md', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          <div className={cn('p-2.5 rounded-lg bg-muted/60 border border-border/40', iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3">
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {value}
            </div>
          )}
        </div>

        {change !== undefined && (
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-md',
                isPositive && 'bg-emerald-500/15 text-emerald-500',
                isNegative && 'bg-rose-500/15 text-rose-500',
                !isPositive && !isNegative && 'bg-muted text-muted-foreground'
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : isNegative ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {isPositive ? `+${change}%` : `${change}%`}
            </span>
            <span className="text-muted-foreground">{changeLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
