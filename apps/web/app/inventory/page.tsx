'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { PERMISSIONS, type InventoryItemDto, type AdjustInventoryInput } from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { KpiCard } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/empty-state';
import {
  Boxes,
  SlidersHorizontal,
  History,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Download,
} from 'lucide-react';
import { useForm } from 'react-hook-form';

export function InventoryPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemDto | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItemDto | null>(null);

  const canAdjust = hasPermission(PERMISSIONS.INVENTORY_ADJUST);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', lowStockOnly],
    queryFn: () =>
      api.listInventory(token!, {
        limit: 200,
        lowStockOnly: lowStockOnly || undefined,
      }),
    enabled: Boolean(token),
  });

  const { data: movementsData, isLoading: isLoadingMovements } = useQuery({
    queryKey: ['inventory-movements', historyItem?.productVariantId],
    queryFn: () => api.getMovements(token!, historyItem!.productVariantId),
    enabled: Boolean(token && historyItem),
  });

  const inventoryItems = data?.items ?? [];

  // Summary KPIs
  const totalStockOnHand = useMemo(
    () => inventoryItems.reduce((sum, item) => sum + item.stockOnHand, 0),
    [inventoryItems]
  );

  const lowStockCount = useMemo(
    () => inventoryItems.filter((i) => i.isLowStock ?? (Number(i.stockOnHand) <= Number(i.reorderPoint ?? 0))).length,
    [inventoryItems]
  );

  const outOfStockCount = useMemo(
    () => inventoryItems.filter((i) => itemOutOfStock(i)).length,
    [inventoryItems]
  );

  function itemOutOfStock(i: InventoryItemDto) {
    return i.stockOnHand <= 0;
  }

  const columns: ColumnDef<InventoryItemDto>[] = useMemo(
    () => [
      {
        accessorKey: 'sku',
        header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border text-foreground">
            {row.getValue('sku')}
          </span>
        ),
      },
      {
        accessorKey: 'productName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Product / Variant" />,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <div className="font-medium text-foreground">{item.productName}</div>
              {item.variantName && (
                <span className="text-[11px] text-muted-foreground">{item.variantName}</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'locationName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.locationName || 'Main Store'}
          </span>
        ),
      },
      {
        accessorKey: 'stockOnHand',
        header: ({ column }) => <DataTableColumnHeader column={column} title="On Hand" />,
        cell: ({ row }) => {
          const count = row.getValue('stockOnHand') as number;
          return (
            <span className={`font-mono text-sm font-bold ${count <= 0 ? 'text-destructive' : 'text-foreground'}`}>
              {count}
            </span>
          );
        },
      },
      {
        accessorKey: 'reservedQty',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Reserved" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.getValue('reservedQty')}
          </span>
        ),
      },
      {
        accessorKey: 'availableQty',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Available" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-foreground">
            {row.getValue('availableQty')}
          </span>
        ),
      },
      {
        accessorKey: 'reorderPoint',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Min Threshold" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.getValue('reorderPoint') ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'isLowStock',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Stock Health" />,
        cell: ({ row }) => {
          const isLow = row.original.isLowStock ?? (Number(row.original.stockOnHand) <= Number(row.original.reorderPoint ?? 0));
          const isOut = row.original.stockOnHand <= 0;

          if (isOut) {
            return (
              <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                Out of Stock
              </Badge>
            );
          }
          if (isLow) {
            return (
              <Badge variant="warning" className="text-[10px] uppercase font-semibold">
                Low Stock
              </Badge>
            );
          }
          return (
            <Badge variant="success" className="text-[10px] uppercase font-medium">
              Optimal
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Inventory Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedItem(item);
                    setIsAdjustOpen(true);
                  }}
                  disabled={!canAdjust}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Adjust Quantity
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setHistoryItem(item)}>
                  <History className="mr-2 h-4 w-4" />
                  View Audit Movements
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [canAdjust]
  );

  const exportCsv = () => {
    if (!inventoryItems.length) return;
    const headers = ['SKU', 'Product Name', 'Variant', 'Location', 'On Hand', 'Reserved', 'Available', 'Reorder Point', 'Status'];
    const rows = inventoryItems.map((r) => [
      r.sku,
      `"${r.productName.replace(/"/g, '""')}"`,
      `"${(r.variantName || '').replace(/"/g, '""')}"`,
      `"${(r.locationName || '').replace(/"/g, '""')}"`,
      r.stockOnHand,
      r.reservedQty,
      r.availableQty,
      r.reorderPoint ?? 0,
      (r.isLowStock ?? (Number(r.stockOnHand) <= Number(r.reorderPoint ?? 0))) ? 'LOW_STOCK' : 'OPTIMAL',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mystore_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Inventory & Stock Ledger"
          description="Multi-location inventory tracking, reorder thresholds, and immutable ledger movements."
          badge={
            <Badge variant="secondary" className="font-mono text-xs">
              {inventoryItems.length} SKUs Tracked
            </Badge>
          }
        >
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          {canAdjust && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedItem(null);
                setIsAdjustOpen(true);
              }}
              className="gap-2 shadow-sm"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Adjust Stock Level
            </Button>
          )}
        </PageHeader>

        {/* 4-Column Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Stock Units"
            value={totalStockOnHand.toLocaleString()}
            icon={Boxes}
            iconColor="text-blue-500"
            isLoading={isLoading}
          />
          <KpiCard
            title="Active Catalog SKUs"
            value={inventoryItems.length}
            icon={Package}
            iconColor="text-indigo-500"
            isLoading={isLoading}
          />
          <KpiCard
            title="Low Stock Watchlist"
            value={lowStockCount}
            icon={AlertTriangle}
            iconColor={lowStockCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}
            change={lowStockCount > 0 ? -lowStockCount : 0}
            changeLabel="below reorder threshold"
            isLoading={isLoading}
          />
          <KpiCard
            title="Out of Stock SKUs"
            value={outOfStockCount}
            icon={XCircle}
            iconColor={outOfStockCount > 0 ? 'text-destructive' : 'text-emerald-500'}
            change={outOfStockCount === 0 ? 100 : 0}
            changeLabel={outOfStockCount === 0 ? '100% available' : 'critical depletion'}
            isLoading={isLoading}
          />
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={inventoryItems}
          isLoading={isLoading}
          toolbar={(table) => (
            <DataTableToolbar
              table={table}
              searchKey="productName"
              searchPlaceholder="Search product by title..."
            >
              <div className="flex items-center space-x-2 pl-2 border-l border-border">
                <Switch
                  id="low-stock-toggle"
                  checked={lowStockOnly}
                  onCheckedChange={setLowStockOnly}
                />
                <label
                  htmlFor="low-stock-toggle"
                  className="text-xs font-medium text-foreground cursor-pointer select-none"
                >
                  Low Stock Only
                </label>
              </div>
            </DataTableToolbar>
          )}
          emptyState={
            <EmptyState
              icon={Boxes}
              title="No inventory records found"
              description="Inventory balances are initialized automatically when catalog items are received or adjusted."
              actionLabel={canAdjust ? 'Adjust Stock' : undefined}
              onAction={() => setIsAdjustOpen(true)}
            />
          }
        />

        {/* Stock Adjustment Drawer */}
        <Sheet open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
          <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Stock Level Adjustment</SheetTitle>
              <SheetDescription>
                Post an immutable inventory balance adjustment with audit reason codes.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              <StockAdjustmentForm
                token={token}
                initialItem={selectedItem}
                allItems={inventoryItems}
                onSuccess={() => {
                  setIsAdjustOpen(false);
                  queryClient.invalidateQueries({ queryKey: ['inventory'] });
                  queryClient.invalidateQueries({ queryKey: ['dashboard-inventory'] });
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Movement History Drawer */}
        <Sheet open={Boolean(historyItem)} onOpenChange={(open) => !open && setHistoryItem(null)}>
          <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Movement Ledger Audit</SheetTitle>
              <SheetDescription>
                Chronological transaction ledger for SKU:{' '}
                <span className="font-mono font-bold text-foreground">{historyItem?.sku}</span>
              </SheetDescription>
            </SheetHeader>
            <div className="py-4 space-y-3">
              {isLoadingMovements ? (
                <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                  Loading ledger entries...
                </div>
              ) : (movementsData?.items ?? []).length > 0 ? (
                movementsData?.items.map((m) => {
                  const isInflow = m.type.includes('IN') || m.type.includes('RECEIPT');
                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-lg border border-border bg-card flex items-start justify-between text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`p-2 rounded-md ${
                            isInflow
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          {isInflow ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            <span>{m.type}</span>
                            {m.referenceId && (
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {m.referenceId}
                              </Badge>
                            )}
                          </div>
                          {m.notes && <p className="text-muted-foreground text-[11px] mt-0.5">{m.notes}</p>}
                          <p className="text-muted-foreground text-[10px] mt-0.5">
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-sm ${
                            isInflow ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {isInflow ? `+${m.quantity}` : `-${m.quantity}`}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Balance: {m.balanceAfter}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  No movement entries recorded for this item yet.
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </EnterpriseShell>
  );
}

function StockAdjustmentForm({
  token,
  initialItem,
  allItems,
  onSuccess,
}: {
  token: string;
  initialItem: InventoryItemDto | null;
  allItems: InventoryItemDto[];
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultItem = initialItem || allItems[0];

  const { register, handleSubmit, reset } = useForm<{
    productVariantId: string;
    locationId: string;
    type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE' | 'EXPIRED' | 'COUNT';
    quantity: number;
    notes: string;
  }>({
    defaultValues: {
      productVariantId: defaultItem?.productVariantId ?? '',
      locationId: defaultItem?.locationId ?? '',
      type: 'ADJUSTMENT_IN',
      quantity: 1,
      notes: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.adjustInventory(token, {
        productVariantId: values.productVariantId,
        locationId: values.locationId,
        type: values.type,
        quantity: Number(values.quantity),
        notes: values.notes || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to adjust inventory');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase">Item / SKU</label>
        <select
          className="input mt-1.5"
          {...register('productVariantId', { required: true })}
        >
          {allItems.map((item) => (
            <option key={item.productVariantId} value={item.productVariantId}>
              {item.sku} — {item.productName} ({item.stockOnHand} on hand)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase">Adjustment Type</label>
        <select className="input mt-1.5" {...register('type')}>
          <option value="ADJUSTMENT_IN">ADJUSTMENT IN — Positive stock addition</option>
          <option value="ADJUSTMENT_OUT">ADJUSTMENT OUT — Stock deduction</option>
          <option value="DAMAGE">DAMAGE — Broken / Defective goods write-off</option>
          <option value="EXPIRED">EXPIRED — Past expiration date</option>
          <option value="COUNT">COUNT — Physical count reconciliation</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase">
          Quantity (Positive Number)
        </label>
        <Input
          type="number"
          min="1"
          className="mt-1.5 font-mono text-base"
          placeholder="e.g. 5"
          {...register('quantity', { required: true, valueAsNumber: true, min: 1 })}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase">
          Audit Notes / Reference (Optional)
        </label>
        <Input
          className="mt-1.5"
          placeholder="e.g. Physical inventory count batch #12"
          {...register('notes')}
        />
      </div>

      <div className="pt-4 border-t border-border flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Posting Ledger Entry...' : 'Post Inventory Adjustment'}
        </Button>
      </div>
    </form>
  );
}

export default InventoryPage;
