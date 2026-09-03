'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { PERMISSIONS, type SaleDto, type SaleSummaryDto } from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter';
import { KpiCard } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ShoppingBag,
  Plus,
  Eye,
  Ban,
  Receipt,
  Download,
  CreditCard,
  DollarSign,
  MoreHorizontal,
  Clock,
  Printer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function SalesPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const canWrite = hasPermission(PERMISSIONS.SALES_WRITE);
  const canVoid = hasPermission(PERMISSIONS.SALES_VOID);

  const { data, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.listSales(token!, { limit: 200 }),
    enabled: Boolean(token),
  });

  const { data: selectedSale, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['sale-detail', selectedSaleId],
    queryFn: () => api.getSale(token!, selectedSaleId!),
    enabled: Boolean(token && selectedSaleId),
  });

  const sales = data?.items ?? [];

  // Computed KPIs
  const completedSales = useMemo(
    () => sales.filter((s) => s.status === 'COMPLETED'),
    [sales]
  );

  const totalGrossRevenue = useMemo(
    () => completedSales.reduce((acc, s) => acc + s.grandTotal, 0),
    [completedSales]
  );

  const voidedCount = useMemo(
    () => sales.filter((s) => s.status === 'VOIDED').length,
    [sales]
  );

  const avgOrderValue = useMemo(
    () => (completedSales.length > 0 ? totalGrossRevenue / completedSales.length : 0),
    [completedSales, totalGrossRevenue]
  );

  const handleVoid = async (id: string) => {
    if (!confirm('Are you sure you want to void this transaction? Stock deductions will be automatically reversed.')) {
      return;
    }
    setVoidError(null);
    setIsVoiding(true);
    try {
      await api.voidSale(token!, id);
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-sales'] });
    } catch (err) {
      setVoidError(err instanceof ApiClientError ? err.message : 'Failed to void sale');
    } finally {
      setIsVoiding(false);
    }
  };

  const columns: ColumnDef<SaleSummaryDto>[] = useMemo(
    () => [
      {
        accessorKey: 'saleNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sale #" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border text-foreground">
            {row.getValue('saleNumber')}
          </span>
        ),
      },
      {
        accessorKey: 'channel',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Channel" />,
        cell: ({ row }) => {
          const channel = (row.getValue('channel') as string) || 'POS';
          return (
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider">
              {channel}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'customerName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-foreground">
            {row.getValue('customerName') || 'Walk-in Customer'}
          </span>
        ),
      },
      {
        accessorKey: 'itemCount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Items" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.getValue('itemCount') ?? 1} line item(s)
          </span>
        ),
      },
      {
        accessorKey: 'grandTotal',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Grand Total" />,
        cell: ({ row }) => {
          const amount = row.getValue('grandTotal') as number;
          return (
            <span className="font-mono font-bold text-xs text-foreground">
              ${amount.toFixed(2)}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          return (
            <Badge
              variant={status === 'COMPLETED' ? 'success' : 'destructive'}
              className="text-[10px] font-semibold uppercase"
            >
              {status}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Timestamp" />,
        cell: ({ row }) => {
          const date = new Date(row.getValue('createdAt') as string);
          return (
            <span className="text-xs text-muted-foreground">
              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const sale = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Order Options</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSelectedSaleId(sale.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Receipt Details
                </DropdownMenuItem>
                {canVoid && sale.status === 'COMPLETED' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleVoid(sale.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Void Order
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [canVoid]
  );

  const exportCsv = () => {
    if (!sales.length) return;
    const headers = ['Sale Number', 'Channel', 'Customer', 'Items', 'Grand Total', 'Status', 'Timestamp'];
    const rows = sales.map((s) => [
      s.saleNumber,
      s.channel || 'POS',
      `"${(s.customerName || 'Walk-in Customer').replace(/"/g, '""')}"`,
      s.itemCount || 1,
      s.grandTotal,
      s.status,
      new Date(s.createdAt).toISOString(),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mystore_sales_${new Date().toISOString().slice(0, 10)}.csv`);
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
          title="Sales & Transactions"
          description="Real-time multi-channel sales ledger, POS receipts, and fiscal audit logs."
          badge={
            <Badge variant="secondary" className="font-mono text-xs">
              {sales.length} Orders
            </Badge>
          }
        >
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          {canWrite && (
            <Button
              size="sm"
              onClick={() => navigate('/sales/new')}
              className="gap-2 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Open POS Terminal
            </Button>
          )}
        </PageHeader>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Gross Volume"
            value={`$${totalGrossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            iconColor="text-emerald-500"
            isLoading={isLoading}
          />
          <KpiCard
            title="Completed Transactions"
            value={completedSales.length}
            icon={ShoppingBag}
            iconColor="text-blue-500"
            isLoading={isLoading}
          />
          <KpiCard
            title="Average Order Value"
            value={`$${avgOrderValue.toFixed(2)}`}
            icon={Receipt}
            iconColor="text-indigo-500"
            isLoading={isLoading}
          />
          <KpiCard
            title="Voided Orders"
            value={voidedCount}
            icon={Ban}
            iconColor={voidedCount > 0 ? 'text-destructive' : 'text-muted-foreground'}
            change={voidedCount > 0 ? voidedCount : 0}
            changeLabel="reversed transactions"
            isLoading={isLoading}
          />
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={sales}
          isLoading={isLoading}
          onRowClick={(row) => setSelectedSaleId(row.id)}
          toolbar={(table) => (
            <DataTableToolbar
              table={table}
              searchKey="saleNumber"
              searchPlaceholder="Search by sale #..."
            >
              {table.getColumn('status') && (
                <DataTableFacetedFilter
                  column={table.getColumn('status')}
                  title="Status"
                  options={[
                    { label: 'Completed', value: 'COMPLETED' },
                    { label: 'Voided', value: 'VOIDED' },
                  ]}
                />
              )}
            </DataTableToolbar>
          )}
          emptyState={
            <EmptyState
              icon={ShoppingBag}
              title="No sales transactions recorded"
              description="Orders generated in the POS or storefront will appear in this ledger immediately."
              actionLabel={canWrite ? 'Open POS Terminal' : undefined}
              onAction={() => navigate('/sales/new')}
            />
          }
        />

        {/* Transaction Detail Slide-over Drawer */}
        <Sheet open={Boolean(selectedSaleId)} onOpenChange={(open) => !open && setSelectedSaleId(null)}>
          <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span>Receipt Details</span>
                {selectedSale && (
                  <Badge variant={selectedSale.status === 'COMPLETED' ? 'success' : 'destructive'} className="text-[10px] uppercase">
                    {selectedSale.status}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>
                Transaction ledger receipt #{selectedSale?.saleNumber}
              </SheetDescription>
            </SheetHeader>

            {voidError && (
              <div className="p-3 my-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs">
                {voidError}
              </div>
            )}

            {isLoadingDetail ? (
              <div className="py-16 text-center text-xs text-muted-foreground animate-pulse">
                Loading order receipt breakdown...
              </div>
            ) : selectedSale ? (
              <div className="space-y-6 py-4">
                {/* Meta Information */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-border bg-card text-xs">
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {selectedSale.customer?.name || 'Walk-in Customer'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Channel:</span>
                    <p className="font-semibold text-foreground mt-0.5 uppercase">
                      {selectedSale.channel || 'POS'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {new Date(selectedSale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Served By:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      User #{selectedSale.userId.slice(0, 8)}
                    </p>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="p-3 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Purchased Line Items
                  </div>
                  <div className="divide-y divide-border text-xs">
                    {(selectedSale.lineItems ?? []).map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{item.productName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {item.sku} · {item.quantity} × ${item.unitPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right font-mono font-bold text-foreground">
                          ${item.lineTotal.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals Breakdown */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono font-medium text-foreground">
                      ${selectedSale.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="font-mono font-medium text-emerald-500">
                      -${selectedSale.discountTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span className="font-mono font-medium text-foreground">
                      ${selectedSale.taxTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border flex justify-between font-bold text-sm text-foreground">
                    <span>Grand Total</span>
                    <span className="font-mono text-base text-primary">
                      ${selectedSale.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Payments Section */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Payment Method(s)
                  </span>
                  <div className="space-y-2">
                    {(selectedSale.payments ?? []).map((pay) => (
                      <div
                        key={pay.id}
                        className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium uppercase">{pay.method}</span>
                          {pay.reference && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              ({pay.reference})
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-foreground">
                          ${pay.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Void Order Action */}
                {canVoid && selectedSale.status === 'COMPLETED' && (
                  <div className="pt-4 border-t border-border">
                    <Button
                      variant="destructive"
                      onClick={() => handleVoid(selectedSale.id)}
                      disabled={isVoiding}
                      className="w-full gap-2"
                    >
                      <Ban className="h-4 w-4" />
                      {isVoiding ? 'Processing Void...' : 'Void Order & Reverse Inventory'}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </EnterpriseShell>
  );
}

export default SalesPage;
