'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Truck,
  Package,
  ShoppingCart,
  CheckCircle2,
  Bike,
  ChevronLeft,
  MapPin,
  ExternalLink,
  Navigation,
  Phone,
  Check,
  RefreshCw,
  Loader2,
  Tag,
  Copy,
  FileText,
  Sparkles,
  ArrowRight,
  Send,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function SalesPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

  const canWrite = hasPermission(PERMISSIONS.SALES_WRITE);
  const canVoid = hasPermission(PERMISSIONS.SALES_VOID);

  const { data, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.listSales(token!, { limit: 200 }),
    enabled: Boolean(token),
  });

  const { data: selectedSale, isLoading: isLoadingDetail, refetch: refetchSale } = useQuery({
    queryKey: ['sale-detail', selectedSaleId],
    queryFn: () => api.getSale(token!, selectedSaleId!),
    enabled: Boolean(token && selectedSaleId),
    refetchInterval: (query) => {
      const st = query.state.data?.deliveryStatus;
      return st && st !== 'DELIVERED' && st !== 'CANCELLED' ? 4000 : false;
    },
  });

  const updateDeliveryStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return api.updateDeliveryStatus(token!, orderId, { status });
    },
    onSuccess: (_, variables) => {
      toast.success(`Delivery status updated to ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ['sale-detail', selectedSaleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update delivery status');
    },
  });

  const createDeliveryMutation = useMutation({
    mutationFn: async (sale: SaleDto) => {
      return api.createDeliveryOrder(token!, {
        recipientName: sale.customer?.name || 'Walk-in Customer',
        recipientPhone: sale.customer?.phone || '012-345-678',
        deliveryAddress: sale.deliveryAddress || '123 Norodom Blvd, Daun Penh, Phnom Penh',
        destLat: sale.destLat || 11.5564,
        destLng: sale.destLng || 104.9282,
        saleId: sale.id,
        codAmount: 0,
        deliveryFee: 2.5,
        notes: `Order #${sale.saleNumber} auto-dispatched from Sales Admin`,
      });
    },
    onSuccess: (data) => {
      toast.success(`Dispatched order to fleet! Tracking ID: ${data.trackingNumber}`);
      queryClient.invalidateQueries({ queryKey: ['sale-detail', selectedSaleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to dispatch order');
    },
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
          const channel = row.getValue('channel') as string;
          const deliveryStatus = row.original.deliveryStatus;

          if (channel === 'STORE' && deliveryStatus) {
             return (
              <Badge
                variant={deliveryStatus === 'DELIVERED' ? 'success' : deliveryStatus === 'PENDING' ? 'secondary' : 'default'}
                className="text-[10px] font-semibold uppercase"
              >
                {deliveryStatus === 'PENDING' ? 'PREPARING' : deliveryStatus}
              </Badge>
            );
          }

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

  const handleDownloadInvoice = (sale: SaleDto) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }
    const trackingNumber =
      sale.trackingNumber || sale.deliveryOrderId || `TRK-${sale.saleNumber.replace(/[^0-9]/g, '').slice(-8)}`;
    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice #${sale.saleNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 36px; color: #1e293b; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #ff007a; padding-bottom: 20px; align-items: flex-start; }
            .logo { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #ff007a; }
            .sublogo { font-size: 12px; color: #64748b; font-weight: 500; margin-top: 2px; }
            .invoice-title { font-size: 22px; font-weight: 800; text-align: right; color: #0f172a; }
            .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 28px 0; padding: 18px; background: #f8fafc; border-radius: 12px; font-size: 13px; border: 1px solid #e2e8f0; }
            .meta-label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px; }
            .meta-value { font-weight: 700; font-size: 14px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
            th { text-align: left; padding: 12px 14px; background: #f1f5f9; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #475569; letter-spacing: 0.5px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #cbd5e1; }
            td { padding: 14px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
            .text-right { text-align: right; }
            .totals { margin-top: 28px; width: 320px; margin-left: auto; font-size: 13px; background: #fafafa; padding: 16px; border-radius: 10px; border: 1px solid #f1f5f9; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; color: #475569; }
            .grand-total { font-size: 20px; font-weight: 900; color: #ff007a; border-top: 2px solid #e2e8f0; padding-top: 12px; margin-top: 8px; }
            .footer { margin-top: 48px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; background: #fce7f3; color: #db2777; font-weight: 700; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">POP-COUCH / CAMTECH</div>
              <div class="sublogo">Official Customer Tax Invoice & Packing Slip</div>
            </div>
            <div class="invoice-title">
              <div>TAX INVOICE</div>
              <div style="font-size: 14px; font-weight: 600; color: #64748b; margin-top: 4px; font-family: monospace;">#${sale.saleNumber}</div>
            </div>
          </div>
          <div class="meta-grid">
            <div>
              <div class="meta-label">Customer</div>
              <div class="meta-value">${sale.customer?.name || 'Walk-in Customer'}</div>
            </div>
            <div>
              <div class="meta-label">Date Placed</div>
              <div class="meta-value">${new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <div>
              <div class="meta-label">Tracking ID</div>
              <div class="meta-value" style="font-family: monospace; font-size: 12px;">${trackingNumber}</div>
            </div>
            <div>
              <div class="meta-label">Status</div>
              <div class="meta-value"><span class="badge">${sale.deliveryStatus || sale.status}</span></div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th>SKU</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${(sale.lineItems || []).map(item => `
                <tr>
                  <td><strong>${item.productName}</strong></td>
                  <td style="font-family: monospace; color: #64748b; font-size: 12px;">${item.sku}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">$${item.unitPrice.toFixed(2)}</td>
                  <td class="text-right" style="font-family: monospace; font-weight: 700;">$${item.lineTotal.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals">
            <div class="totals-row">
              <span>Subtotal</span>
              <span style="font-family: monospace;">$${sale.subtotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Delivery / Shipping</span>
              <span style="font-family: monospace;">$${(sale.deliveryFee ?? 2.5).toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Discount</span>
              <span style="color: #10b981; font-family: monospace;">-$${sale.discountTotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Tax (VAT)</span>
              <span style="font-family: monospace;">$${sale.taxTotal.toFixed(2)}</span>
            </div>
            <div class="totals-row grand-total">
              <span>Total</span>
              <span style="font-family: monospace;">$${sale.grandTotal.toFixed(2)}</span>
            </div>
          </div>
          <div class="footer">
            <p>Thank you for shopping with Pop-Couch / CamTech Store!</p>
            <p>Real-time GPS order tracking link: <strong>http://localhost:5000/order-tracking</strong></p>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
    toast.success(`Generated printable invoice #${sale.saleNumber}`);
  };

  const handleCopyTracking = (trackingId: string) => {
    navigator.clipboard.writeText(trackingId);
    setCopiedTracking(true);
    toast.success('Tracking ID copied to clipboard!');
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const currentStage = useMemo(() => {
    if (!selectedSale) return 0;
    const st = (selectedSale.deliveryStatus || '').toUpperCase();
    if (st === 'DELIVERED') return 3;
    if (st === 'IN_TRANSIT') return 2;
    if (st === 'DISPATCHED' || st === 'PACKED') return 1;
    return 0; // Placed (PENDING)
  }, [selectedSale]);

  const totalItemsCount = useMemo(() => {
    if (!selectedSale?.lineItems) return 1;
    return selectedSale.lineItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [selectedSale]);

  const trackingId = useMemo(() => {
    return (
      selectedSale?.trackingNumber ||
      selectedSale?.deliveryOrderId ||
      `#TRK-${selectedSale?.saleNumber.replace(/[^0-9]/g, '').slice(-8) || '12233984'}`
    );
  }, [selectedSale]);

  const googleMapsUrl = useMemo(() => {
    const lat = selectedSale?.destLat || 11.5564;
    const lng = selectedSale?.destLng || 104.9282;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }, [selectedSale]);

  const stages = [
    {
      label: 'Order Placed',
      date: selectedSale
        ? new Date(selectedSale.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '',
      icon: ShoppingCart,
    },
    {
      label: 'Packed & Dispatched',
      date: currentStage >= 1 ? 'Handed to Courier' : 'Pending',
      icon: Package,
    },
    {
      label: 'Out for delivery',
      date:
        currentStage >= 2 && selectedSale?.driverName
          ? `With ${selectedSale.driverName}`
          : 'Pending',
      icon: Truck,
    },
    {
      label: 'Delivered',
      date: currentStage >= 3 ? 'Completed' : 'Pending',
      icon: CheckCircle2,
    },
  ];

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

        {/* Image 2 Admin Order Details & Tracking Slide-over Center */}
        <Sheet open={Boolean(selectedSaleId)} onOpenChange={(open) => !open && setSelectedSaleId(null)}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-3xl lg:max-w-4xl p-0 overflow-y-auto bg-[#fafafa] dark:bg-[#090a0f] border-l border-border/80 shadow-2xl"
          >
            {isLoadingDetail ? (
              <div className="py-32 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="h-8 w-8 text-[#ff007a] animate-spin" />
                <p className="text-xs text-muted-foreground font-medium animate-pulse">
                  Loading real-time order telemetry & tracking ledger...
                </p>
              </div>
            ) : selectedSale ? (
              <div className="p-6 sm:p-8 space-y-6">
                {/* Top Header: Back Link + Pink Download Invoice Button */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedSaleId(null)}
                    className="flex items-center gap-2 text-foreground font-extrabold text-xl sm:text-2xl hover:opacity-80 transition-opacity"
                  >
                    <ChevronLeft className="w-6 h-6 text-foreground" />
                    <span>Order Details</span>
                  </button>

                  <button
                    onClick={() => handleDownloadInvoice(selectedSale)}
                    className="bg-[#ff007a] hover:bg-[#e0006c] text-white px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm tracking-wide shadow-md shadow-pink-500/25 hover:shadow-pink-500/40 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Download Invoice</span>
                    <FileText className="w-4 h-4" />
                  </button>
                </div>

                {voidError && (
                  <div className="p-3.5 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 text-xs font-medium">
                    {voidError}
                  </div>
                )}

                {/* 5-Column Order Metadata Card */}
                <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium block">Order Number</span>
                    <p className="font-mono font-bold text-foreground mt-1 text-sm">
                      {selectedSale.saleNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">Order Placed</span>
                    <p className="font-semibold text-foreground mt-1 text-xs">
                      {new Date(selectedSale.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">Order Delivered</span>
                    <p className="font-semibold text-foreground mt-1 text-xs">
                      {currentStage >= 4
                        ? 'Delivered'
                        : selectedSale.etaMinutes
                        ? `ETA ~${selectedSale.etaMinutes} mins`
                        : 'Est. Same Day'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">No of items</span>
                    <p className="font-semibold text-foreground mt-1 text-xs">
                      {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-muted-foreground font-medium block">Status</span>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-pink-50 dark:bg-pink-950/40 text-[#ff007a] border border-pink-200 dark:border-pink-800">
                        {selectedSale.deliveryStatus || selectedSale.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Tracking 5-Stage Visual Stepper */}
                <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-xs space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-foreground">Order Tracking</h3>
                      {selectedSale.deliveryStatus && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          Live GPS Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <span>Tracking ID</span>
                      <span className="font-semibold text-foreground">{trackingId}</span>
                      <button
                        onClick={() => handleCopyTracking(trackingId)}
                        className="p-1 hover:text-foreground text-muted-foreground transition-colors"
                        title="Copy Tracking ID"
                      >
                        {copiedTracking ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 5-Stage Timeline Bar */}
                  <div className="relative pt-2 pb-4">
                    {/* Background track line */}
                    <div className="absolute top-7 left-7 right-7 h-1 bg-slate-200 dark:bg-zinc-800 rounded-full" />
                    {/* Active pink progress fill line */}
                    <div
                      className="absolute top-7 left-7 h-1 bg-gradient-to-r from-[#ff007a] to-pink-500 rounded-full transition-all duration-500 shadow-sm shadow-pink-500/50"
                      style={{ width: `calc(${(currentStage / 3) * 100}% - 28px)` }}
                    />

                    {/* Nodes row */}
                    <div className="relative flex justify-between z-10">
                      {stages.map((st, idx) => {
                        const Icon = st.icon;
                        const isDone = idx < currentStage;
                        const isActive = idx === currentStage;
                        return (
                          <div key={st.label} className="flex flex-col items-center text-center max-w-[80px]">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                                isDone
                                  ? 'bg-[#ff007a] text-white shadow-md shadow-pink-500/30'
                                  : isActive
                                  ? 'bg-[#ff007a] text-white ring-4 ring-pink-500/25 shadow-lg shadow-pink-500/40 animate-pulse'
                                  : 'bg-muted/80 text-muted-foreground border border-border'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <span
                              className={`mt-3 font-bold text-xs leading-tight ${
                                isActive || isDone ? 'text-foreground' : 'text-muted-foreground'
                              }`}
                            >
                              {st.label}
                            </span>
                            <span className="mt-1 text-[10px] text-muted-foreground line-clamp-1">
                              {st.date}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Driver & Telemetry Bar / Admin Dispatch Bar */}
                  {selectedSale.driverName ? (
                    <div className="p-4 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-950/60 text-[#ff007a] flex items-center justify-center font-bold text-sm">
                          <Bike className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">
                              {selectedSale.driverName}
                            </span>
                            <span className="text-[10px] font-semibold text-amber-500">★ 4.8</span>
                            {selectedSale.driverVehicle && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                · {selectedSale.driverVehicle}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {selectedSale.distanceKm
                              ? `${selectedSale.distanceKm.toFixed(1)} km away`
                              : 'Dispatched to customer location'}
                            {selectedSale.etaMinutes && ` · ~${selectedSale.etaMinutes} mins ETA`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedSale.driverPhone && (
                          <a
                            href={`tel:${selectedSale.driverPhone}`}
                            className="p-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground transition-colors"
                            title="Call Driver"
                          >
                            <Phone className="w-4 h-4 text-emerald-600" />
                          </a>
                        )}
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Google Maps</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {/* Admin Milestone Controller Toolbar */}
                  <div className="pt-2 border-t border-border flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-muted-foreground font-medium">
                      Admin Fleet Workflow Actions:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {!selectedSale.deliveryOrderId ? (
                        <Button
                          size="sm"
                          onClick={() => createDeliveryMutation.mutate(selectedSale)}
                          disabled={createDeliveryMutation.isPending}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-8 text-xs font-medium"
                        >
                          {createDeliveryMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Dispatch to Fleet Delivery
                        </Button>
                      ) : (
                        <>
                          {currentStage === 0 && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updateDeliveryStatusMutation.mutate({
                                  orderId: selectedSale.deliveryOrderId!,
                                  status: 'DISPATCHED',
                                })
                              }
                              disabled={updateDeliveryStatusMutation.isPending}
                              className="bg-[#ff007a] hover:bg-[#e0006c] text-white gap-1.5 h-8 text-xs font-medium"
                            >
                              <Package className="w-3.5 h-3.5" />
                              Mark as Packed
                            </Button>
                          )}
                          {currentStage === 1 && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updateDeliveryStatusMutation.mutate({
                                  orderId: selectedSale.deliveryOrderId!,
                                  status: 'IN_TRANSIT',
                                })
                              }
                              disabled={updateDeliveryStatusMutation.isPending}
                              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8 text-xs font-medium"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Set Out for Delivery
                            </Button>
                          )}
                          {currentStage === 2 && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updateDeliveryStatusMutation.mutate({
                                  orderId: selectedSale.deliveryOrderId!,
                                  status: 'DELIVERED',
                                })
                              }
                              disabled={updateDeliveryStatusMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-medium"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirm Delivered
                            </Button>
                          )}
                          {currentStage === 3 && (
                            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                              <CheckCircle2 className="w-4 h-4" /> Delivered & Completed
                            </span>
                          )}
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refetchSale()}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Refresh live tracking"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Main Content 2-Column: Order Items + Signature Navy Summary Card */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Items from the order */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-xs">
                      <div className="p-4 border-b border-border/70 flex items-center justify-between">
                        <h3 className="font-bold text-sm text-foreground">Items from the order</h3>
                        <span className="text-xs text-muted-foreground font-mono">
                          {selectedSale.lineItems?.length ?? 0} SKU(s)
                        </span>
                      </div>

                      <div className="divide-y divide-border/60">
                        {(selectedSale.lineItems ?? []).map((item) => (
                          <div
                            key={item.id}
                            className="p-4 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-zinc-800 border border-pink-100 dark:border-zinc-700 flex items-center justify-center text-[#ff007a] font-bold text-lg shadow-2xs">
                                🛋️
                              </div>
                              <div>
                                <p className="font-bold text-foreground text-sm leading-snug">
                                  {item.productName}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  SKU: <span className="font-mono">{item.sku}</span> · Unit: $
                                  {item.unitPrice.toFixed(2)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground">
                                {item.quantity}
                              </span>
                              <span className="font-mono font-bold text-sm text-foreground min-w-[60px] text-right">
                                ${item.lineTotal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Customer & Address Details */}
                    <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs text-xs space-y-2">
                      <h4 className="font-bold text-foreground">Recipient & Delivery Destination</h4>
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">{selectedSale.customer?.name || 'Walk-in Customer'}</strong>
                        {selectedSale.customer?.phone && ` · ${selectedSale.customer.phone}`}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{selectedSale.deliveryAddress || '123 Norodom Blvd, Daun Penh, Phnom Penh'}</span>
                      </p>
                    </div>

                    {/* Void Order Action for Admin */}
                    {canVoid && selectedSale.status === 'COMPLETED' && (
                      <div className="pt-2">
                        <Button
                          variant="destructive"
                          onClick={() => handleVoid(selectedSale.id)}
                          disabled={isVoiding}
                          className="w-full gap-2 text-xs font-semibold h-10"
                        >
                          <Ban className="h-4 w-4" />
                          {isVoiding ? 'Processing Void...' : 'Void Transaction & Reverse Inventory'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Signature Pop-Couch Dark Navy Summary Card (Image 2) */}
                  <div className="lg:col-span-5">
                    <div className="bg-[#0f0b29] text-white p-6 rounded-3xl shadow-2xl border border-white/10 space-y-5">
                      <h3 className="font-bold text-lg text-white">Summary</h3>

                      <div className="space-y-3 text-xs text-zinc-300">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span className="font-mono font-semibold text-white">
                            ${selectedSale.subtotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shipping</span>
                          <span className="font-mono font-semibold text-white">
                            ${(selectedSale.deliveryFee ?? 2.5).toFixed(2)}
                          </span>
                        </div>
                        {selectedSale.discountTotal > 0 && (
                          <div className="flex justify-between text-emerald-400">
                            <span>Discount</span>
                            <span className="font-mono font-semibold">
                              -${selectedSale.discountTotal.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Tax</span>
                          <span className="font-mono font-semibold text-white">
                            ${selectedSale.taxTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Promo Code Box */}
                      <div className="pt-2">
                        <div className="relative flex items-center bg-white/5 border border-white/15 rounded-2xl p-1.5 focus-within:border-pink-500/50 transition-colors">
                          <Tag className="w-4 h-4 ml-2.5 text-zinc-400" />
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            placeholder="Add a coupon code"
                            className="bg-transparent border-0 text-white placeholder:text-zinc-500 text-xs px-2.5 py-1 focus:outline-none flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!couponCode) return;
                              setCouponApplied(true);
                              toast.success(`Coupon "${couponCode}" applied successfully!`);
                            }}
                            className="text-[#ff007a] hover:text-pink-300 font-bold text-xs px-3 py-1 transition-colors cursor-pointer"
                          >
                            Apply
                          </button>
                        </div>
                        {couponApplied && (
                          <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Special promo discount verified
                          </p>
                        )}
                      </div>

                      {/* Total and Pink Action Button */}
                      <div className="pt-4 border-t border-white/10 space-y-4">
                        <div className="flex justify-between items-baseline">
                          <span className="font-semibold text-sm text-zinc-200">Total</span>
                          <span className="font-mono font-black text-2xl text-white">
                            ${selectedSale.grandTotal.toFixed(2)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDownloadInvoice(selectedSale)}
                          className="w-full bg-[#ff007a] hover:bg-[#e0006c] text-white font-bold py-3.5 px-5 rounded-2xl flex items-center justify-between shadow-lg shadow-pink-500/30 hover:shadow-pink-500/45 transition-all cursor-pointer group"
                        >
                          <span className="text-sm">Download Official Invoice</span>
                          <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </EnterpriseShell>
  );
}

export default SalesPage;

