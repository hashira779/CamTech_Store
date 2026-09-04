'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { TableSkeletonRows } from '@/components/page-skeleton';
import type {
  StockTransferDto,
  StockTransferStatus,
  CreateStockTransferInput,
  ReceiveStockTransferInput,
} from '@mystore/contracts';
import {
  ArrowLeftRight,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Boxes,
  MapPin,
  X,
  PackageCheck,
  Building,
  Send,
  Calendar,
  Layers,
} from 'lucide-react';

export default function TransfersPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [receiveModalTransfer, setReceiveModalTransfer] = useState<StockTransferDto | null>(null);
  const [inspectTransfer, setInspectTransfer] = useState<StockTransferDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // New Transfer Form State
  const [sourceLocId, setSourceLocId] = useState('');
  const [destLocId, setDestLocId] = useState('');
  const [notes, setNotes] = useState('');
  const [transferLines, setTransferLines] = useState<
    Array<{ productVariantId: string; requestedQty: number; batchNumber?: string }>
  >([{ productVariantId: '', requestedQty: 1 }]);

  // Receive Form State
  const [receiveLines, setReceiveLines] = useState<
    Array<{ lineId: string; receivedQty: number; destBinId?: string }>
  >([]);
  const [receiveNotes, setReceiveNotes] = useState('');

  // Queries
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers', selectedStatus],
    queryFn: () =>
      api.listTransfers(token!, {
        status: selectedStatus === 'ALL' ? undefined : (selectedStatus as StockTransferStatus),
      }),
    enabled: Boolean(token),
  });

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.listLocations(token!),
    enabled: Boolean(token),
  });

  const locations = locationsData?.items || [];

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.listProducts(token!, { limit: 100 }),
    enabled: Boolean(token),
  });

  const allVariants = (productsData?.items || []).flatMap((p) =>
    p.variants.map((v) => ({
      master: p,
      variant: v,
    })),
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: (input: CreateStockTransferInput) => api.createTransfer(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setIsCreateOpen(false);
      setTransferLines([{ productVariantId: '', requestedQty: 1 }]);
      setNotes('');
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create transfer');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StockTransferStatus }) =>
      api.updateTransferStatus(token!, id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
  });

  const shipMutation = useMutation({
    mutationFn: (id: string) => api.shipTransfer(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to dispatch shipment');
    },
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReceiveStockTransferInput }) =>
      api.receiveTransfer(token!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setReceiveModalTransfer(null);
      setReceiveLines([]);
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to receive transfer');
    },
  });

  // KPI calculations
  const totalTransfers = transfers.length;
  const inTransitCount = transfers.filter((t) => t.status === 'IN_TRANSIT').length;
  const pendingReceiptCount = transfers.filter(
    (t) => t.status === 'APPROVED' || t.status === 'IN_TRANSIT',
  ).length;
  const totalDiscrepancies = transfers.reduce(
    (sum, t) => sum + t.lines.reduce((s, l) => s + (l.discrepancyQty || 0), 0),
    0,
  );

  const handleOpenReceive = (transfer: StockTransferDto) => {
    setReceiveModalTransfer(transfer);
    setReceiveLines(
      transfer.lines.map((l) => ({
        lineId: l.id,
        receivedQty: l.sentQty || l.requestedQty,
      })),
    );
    setReceiveNotes('');
  };

  const getStatusBadge = (status: StockTransferStatus) => {
    const styles: Record<StockTransferStatus, string> = {
      DRAFT: 'bg-muted/30 text-muted-foreground border-border',
      REQUESTED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      APPROVED: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      IN_TRANSIT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      RECEIVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${styles[status] || styles.DRAFT}`}
      >
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <ArrowLeftRight className="w-6 h-6 text-primary" />
              Stock Transfers & WMS
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Multi-branch stock movements, automated inventory replenishment & FEFO lot tracking
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="btn flex items-center gap-2 text-sm shadow-md"
          >
            <Plus className="w-4 h-4" />
            New Stock Transfer
          </button>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Transfers</p>
                <p className="text-xl font-bold text-foreground font-mono">{totalTransfers}</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">In Transit</p>
                <p className="text-xl font-bold text-amber-400 font-mono">{inTransitCount}</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pending Receipt</p>
                <p className="text-xl font-bold text-blue-400 font-mono">{pendingReceiptCount}</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Transit Discrepancies</p>
                <p className="text-xl font-bold text-rose-400 font-mono">{totalDiscrepancies}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto text-xs">
          {['ALL', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedStatus(tab)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                selectedStatus === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/30'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Transfers Table */}
        <div className="card border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-4">Route (From ➔ To)</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <TableSkeletonRows rows={6} cols={6} />
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No stock transfers found matching criteria.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        {t.transferNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span>{t.sourceLocationName || 'Source'}</span>
                          <span className="text-muted-foreground">➔</span>
                          <span className="text-primary">{t.destinationLocationName || 'Destination'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {t.lines.reduce((s, l) => s + l.requestedQty, 0)} units ({t.lines.length} lines)
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {t.status === 'REQUESTED' && (
                            <button
                              type="button"
                              onClick={() => statusMutation.mutate({ id: t.id, status: 'APPROVED' })}
                              className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 font-semibold"
                            >
                              Approve
                            </button>
                          )}

                          {t.status === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => shipMutation.mutate(t.id)}
                              className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-semibold flex items-center gap-1"
                            >
                              <Truck className="w-3 h-3" />
                              Ship Goods
                            </button>
                          )}

                          {t.status === 'IN_TRANSIT' && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceive(t)}
                              className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-semibold flex items-center gap-1"
                            >
                              <PackageCheck className="w-3 h-3" />
                              Receive
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setInspectTransfer(t)}
                            className="px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground font-medium"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Stock Transfer Drawer */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-lg bg-card border-l border-border h-full flex flex-col p-6 shadow-2xl overflow-y-auto">
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">Create Stock Transfer</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                  {formError}
                </div>
              )}

              <div className="space-y-4 py-4 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Source Location
                    </label>
                    <select
                      value={sourceLocId}
                      onChange={(e) => setSourceLocId(e.target.value)}
                      className="input w-full text-xs"
                    >
                      <option value="">Select Source...</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Destination Location
                    </label>
                    <select
                      value={destLocId}
                      onChange={(e) => setDestLocId(e.target.value)}
                      className="input w-full text-xs"
                    >
                      <option value="">Select Destination...</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Urgent stock replenishment for weekend promo"
                    className="input w-full text-xs"
                  />
                </div>

                <div className="border-t border-border pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-foreground">Transfer Lines</label>
                    <button
                      type="button"
                      onClick={() =>
                        setTransferLines([...transferLines, { productVariantId: '', requestedQty: 1 }])
                      }
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {transferLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-border bg-muted/10 space-y-2 text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-muted-foreground">Item #{idx + 1}</span>
                          {transferLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setTransferLines(transferLines.filter((_, i) => i !== idx))
                              }
                              className="text-rose-400 hover:text-rose-300 text-[11px]"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div>
                          <select
                            value={line.productVariantId}
                            onChange={(e) => {
                              const updated = [...transferLines];
                              updated[idx].productVariantId = e.target.value;
                              setTransferLines(updated);
                            }}
                            className="input w-full text-xs"
                          >
                            <option value="">Select Product Variant...</option>
                            {allVariants.map(({ master, variant }) => (
                              <option key={variant.id} value={variant.id}>
                                {master.name} - {variant.sku} {variant.name ? `(${variant.name})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[11px] text-muted-foreground block mb-0.5">
                              Quantity
                            </span>
                            <input
                              type="number"
                              min="1"
                              value={line.requestedQty}
                              onChange={(e) => {
                                const updated = [...transferLines];
                                updated[idx].requestedQty = parseInt(e.target.value) || 1;
                                setTransferLines(updated);
                              }}
                              className="input w-full text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[11px] text-muted-foreground block mb-0.5">
                              Batch / Lot # (Opt)
                            </span>
                            <input
                              type="text"
                              value={line.batchNumber || ''}
                              onChange={(e) => {
                                const updated = [...transferLines];
                                updated[idx].batchNumber = e.target.value;
                                setTransferLines(updated);
                              }}
                              placeholder="BATCH-..."
                              className="input w-full text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn-ghost flex-1 py-2 text-xs border border-border"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createMutation.isPending || !sourceLocId || !destLocId}
                  onClick={() =>
                    createMutation.mutate({
                      sourceLocationId: sourceLocId,
                      destinationLocationId: destLocId,
                      notes: notes || undefined,
                      lines: transferLines,
                    })
                  }
                  className="btn flex-1 py-2 text-xs"
                >
                  {createMutation.isPending ? 'Creating...' : 'Submit Transfer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receive Goods Modal */}
        {receiveModalTransfer && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-lg w-full p-6 border-border shadow-2xl bg-card">
              <div className="flex justify-between items-center pb-3 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-bold text-foreground">
                    Receive Goods ({receiveModalTransfer.transferNumber})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiveModalTransfer(null)}
                  className="p-1 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {receiveModalTransfer.lines.map((line, idx) => {
                  const curr = receiveLines[idx];
                  const sent = line.sentQty || line.requestedQty;
                  const missing = sent - (curr?.receivedQty ?? sent);

                  return (
                    <div
                      key={line.id}
                      className="p-3 rounded-lg border border-border bg-muted/10 space-y-2 text-xs"
                    >
                      <div className="flex justify-between font-semibold text-foreground">
                        <span>{line.productName} ({line.sku})</span>
                        <span className="text-muted-foreground font-mono">Dispatched: {sent}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-[11px] text-muted-foreground block mb-0.5">
                            Received Quantity
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={sent}
                            value={curr?.receivedQty ?? sent}
                            onChange={(e) => {
                              const updated = [...receiveLines];
                              updated[idx].receivedQty = parseInt(e.target.value) || 0;
                              setReceiveLines(updated);
                            }}
                            className="input w-full text-xs"
                          />
                        </div>

                        {missing > 0 && (
                          <div className="text-rose-400 text-xs font-semibold pt-4">
                            Missing: {missing} units
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mb-4">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Receiving Inspection Notes
                </label>
                <input
                  type="text"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="e.g. Received intact, carton seals verified"
                  className="input w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setReceiveModalTransfer(null)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={receiveMutation.isPending}
                  onClick={() =>
                    receiveMutation.mutate({
                      id: receiveModalTransfer.id,
                      input: {
                        lines: receiveLines,
                        notes: receiveNotes || undefined,
                      },
                    })
                  }
                  className="btn px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {receiveMutation.isPending ? 'Confirming...' : 'Confirm Inbound Receipt'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Detail Inspector Drawer */}
        {inspectTransfer && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-md bg-card border-l border-border h-full flex flex-col p-6 shadow-2xl overflow-y-auto">
              <div className="flex justify-between items-center pb-4 border-b border-border mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground font-mono">
                    {inspectTransfer.transferNumber}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Transfer Details & Movement Manifest
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectTransfer(null)}
                  className="p-1 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs flex-1">
                <div className="bg-muted/20 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    {getStatusBadge(inspectTransfer.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source Location</span>
                    <span className="font-semibold text-foreground">
                      {inspectTransfer.sourceLocationName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Destination</span>
                    <span className="font-semibold text-foreground">
                      {inspectTransfer.destinationLocationName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requested By</span>
                    <span className="font-semibold text-foreground">
                      {inspectTransfer.requestedByName || 'User'}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-foreground mb-2">Item Manifest</h4>
                  <div className="space-y-2">
                    {inspectTransfer.lines.map((line) => (
                      <div
                        key={line.id}
                        className="p-3 rounded-lg border border-border bg-card space-y-1"
                      >
                        <div className="font-semibold text-foreground">
                          {line.productName} ({line.sku})
                        </div>
                        <div className="flex justify-between text-muted-foreground font-mono">
                          <span>Requested: {line.requestedQty}</span>
                          <span>Dispatched: {line.sentQty}</span>
                          <span className="text-emerald-400">Received: {line.receivedQty}</span>
                        </div>
                        {line.discrepancyQty > 0 && (
                          <div className="text-rose-400 font-semibold text-[11px]">
                            Discrepancy: -{line.discrepancyQty} units
                          </div>
                        )}
                        {line.batchNumber && (
                          <div className="text-muted-foreground text-[11px]">
                            Batch/Lot: {line.batchNumber}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setInspectTransfer(null)}
                  className="btn-ghost w-full py-2 text-xs border border-border"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
