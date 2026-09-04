import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function TableSkeletonRows({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-border/50">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="py-3.5 px-4">
              <Skeleton
                className={cn(
                  'h-4 rounded',
                  cIdx === 0 ? 'w-24' : cIdx === 1 ? 'w-36' : cIdx === cols - 1 ? 'w-16 ml-auto' : 'w-20'
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function CardGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-border/70 bg-card p-4 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <Skeleton className="w-full h-36 rounded-xl" />
            <Skeleton className="h-3 w-16 rounded-full" />
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
          <div className="pt-3 border-t border-border/60 flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-2 w-8 rounded" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({
  variant = 'table',
  showKpis = true,
}: {
  variant?: 'table' | 'cards' | 'dashboard' | 'list';
  showKpis?: boolean;
}) {
  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      {showKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-28 rounded-md" />
              <Skeleton className="h-2.5 w-36 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Controls & Filter Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/60">
        <Skeleton className="h-9 w-full sm:w-72 rounded-lg" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Main Content Skeleton depending on variant */}
      {variant === 'table' && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {Array.from({ length: 5 }).map((_, c) => (
                  <th key={c} className="py-3 px-4">
                    <Skeleton className="h-3 w-20 rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <TableSkeletonRows rows={6} cols={5} />
            </tbody>
          </table>
        </div>
      )}

      {variant === 'cards' && <CardGridSkeleton count={8} />}

      {variant === 'list' && <ListSkeleton count={6} />}

      {variant === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <Skeleton className="h-5 w-32 rounded" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-2.5 w-2/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar Skeleton */}
      <div className="w-64 border-r border-border bg-card/60 p-4 hidden md:flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>

          {/* Nav groups */}
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl">
                <Skeleton className="w-5 h-5 rounded-md shrink-0" />
                <Skeleton className="h-3.5 flex-1 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* User profile badge */}
        <div className="flex items-center gap-3 p-2 rounded-xl border border-border bg-card">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-2 w-14 rounded" />
          </div>
        </div>
      </div>

      {/* Main Area Skeleton */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Skeleton */}
        <div className="h-16 border-b border-border px-6 flex items-center justify-between shrink-0 bg-card/40">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg md:hidden" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-44 rounded-lg hidden sm:block" />
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
        </div>

        {/* Page Content Skeleton */}
        <div className="flex-1 p-6">
          <PageSkeleton variant="table" />
        </div>
      </div>
    </div>
  );
}
