'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  PackageCheck,
  Building2,
  FileText,
  DollarSign,
  Calendar,
  AlertCircle,
  Eye,
  Trash2,
} from 'lucide-react';
import type {
  PurchaseOrderStatus,
  PurchaseOrderSummaryDto,
  PurchaseOrderDto,
  CreatePurchaseOrderInput,
  POLineItemInput,
  CreateSupplierInput,
  CreateGoodsReceiptInput,
} from '@mystore/contracts';

const PO_STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  SUBMITTED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  APPROVED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PARTIALLY_RECEIVED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function ProcurementPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'orders' | 'receipts' | 'suppliers'>('orders');
  const [poStatusFilter, setPoStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Modals
  const [createPoModalOpen, setCreatePoModalOpen] = useState(false);
  const [createSupplierModalOpen, setCreateSupplierModalOpen] = useState(false);
  const [receiveModalPo, setReceiveModalPo] = useState<PurchaseOrderDto | null>(null);
  const [viewPoModal, setViewPoModal] = useState<PurchaseOrderDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Create PO Form State
  const [poForm, setPoForm] = useState<CreatePurchaseOrderInput>({
    supplierId: '',
    locationId: '',
    expectedDeliveryDate: '',
    currency: 'USD',
    notes: '',
    lineItems: [{ productVariantId: '', quantity: 1, unitCost: 0, taxRatePct: 0 }],
  });

  // Create Supplier Form State
  const [supplierForm, setSupplierForm] = useState<CreateSupplierInput>({
    name: '',
    code: '',
    contactPerson: '',
    email: '',
    phone: '',
    paymentTerms: 'NET_30',
    notes: '',
  });

  // Receive Shipment State
  const [receiveForm, setReceiveForm] = useState<CreateGoodsReceiptInput>({
    notes: '',
    lineItems: [],
  });

  const canWrite = hasPermission('procurement.write');
  const canApprove = hasPermission('procurement.approve');
  const canReceive = hasPermission('procurement.receive');

  // Queries
  const { data: posData, isLoading: isPosLoading } = useQuery({
    queryKey: ['purchase-orders', poStatusFilter, search],
    queryFn: () =>
      api.listPurchaseOrders(token!, {
        status: poStatusFilter || undefined,
        search: search || undefined,
        limit: 50,
      }),
    enabled: Boolean(token),
  });

  const { data: receiptsData, isLoading: isReceiptsLoading } = useQuery({
    queryKey: ['goods-receipts'],
    queryFn: () => api.listGoodsReceipts(token!, { limit: 50 }),
    enabled: Boolean(token) && activeTab === 'receipts',
  });

  const { data: suppliersData, isLoading: isSuppliersLoading } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => api.listSuppliers(token!, { search: search || undefined, limit: 50 }),
    enabled: Boolean(token),
  });

  const { data: locationsData } = useQuery({
    queryKey: ['locations-dropdown'],
    queryFn: () => api.listLocations(token!, { limit: 100 }),
    enabled: Boolean(token) && createPoModalOpen,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-dropdown'],
    queryFn: () => api.listProducts(token!, { limit: 100 }),
    enabled: Boolean(token) && createPoModalOpen,
  });

  // Mutations
  const createPoMutation = useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) => api.createPurchaseOrder(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setCreatePoModalOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create purchase order');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approvePurchaseOrder(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to approve purchase order');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelPurchaseOrder(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to cancel purchase order');
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: (input: CreateSupplierInput) => api.createSupplier(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setCreateSupplierModalOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to register supplier');
    },
  });

  const receiveMutation = useMutation({
    mutationFn: ({ poId, input }: { poId: string; input: CreateGoodsReceiptInput }) =>
      api.receiveGoods(token!, poId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setReceiveModalPo(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to record inbound receipt');
    },
  });

  // Line item helpers
  const addPoLine = () => {
    setPoForm({
      ...poForm,
      lineItems: [...poForm.lineItems, { productVariantId: '', quantity: 1, unitCost: 0, taxRatePct: 0 }],
    });
  };

  const removePoLine = (index: number) => {
    if (poForm.lineItems.length <= 1) return;
    setPoForm({
      ...poForm,
      lineItems: poForm.lineItems.filter((_, i) => i !== index),
    });
  };

  const updatePoLine = (index: number, field: keyof POLineItemInput, value: any) => {
    const updated = [...poForm.lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setPoForm({ ...poForm, lineItems: updated });
  };

  const openReceiveModal = async (poSummary: PurchaseOrderSummaryDto) => {
    try {
      const fullPo = await api.getPurchaseOrder(token!, poSummary.id);
      setReceiveModalPo(fullPo);
      setReceiveForm({
        notes: '',
        lineItems: fullPo.lineItems
          .filter((l) => l.quantity > l.receivedQty)
          .map((l) => ({
            poLineItemId: l.id,
            productVariantId: l.productVariantId,
            quantityReceived: l.quantity - l.receivedQty,
          })),
      });
      setFormError(null);
    } catch (e: any) {
      alert('Failed to load purchase order details');
    }
  };

  const openViewPoModal = async (id: string) => {
    try {
      const fullPo = await api.getPurchaseOrder(token!, id);
      setViewPoModal(fullPo);
    } catch (e: any) {
      alert('Failed to load purchase order details');
    }
  };

  // Compute form totals preview
  const poPreviewSubtotal = poForm.lineItems.reduce((acc, l) => acc + (l.quantity || 0) * (l.unitCost || 0), 0);
  const poPreviewTax = poForm.lineItems.reduce(
    (acc, l) => acc + ((l.quantity || 0) * (l.unitCost || 0) * (l.taxRatePct || 0)) / 100,
    0,
  );
  const poPreviewGrandTotal = poPreviewSubtotal + poPreviewTax;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Truck className="w-6 h-6 text-primary" />
              Procurement & Purchasing Engine
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              End-to-end procurement lifecycle: vendor registry, purchase orders, and atomic inbound stock receipt (GRN).
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canWrite && (
              <>
                <button
                  onClick={() => {
                    setSupplierForm({ name: '', code: '', contactPerson: '', email: '', phone: '', paymentTerms: 'NET_30' });
                    setFormError(null);
                    setCreateSupplierModalOpen(true);
                  }}
                  className="btn bg-card text-foreground border border-border hover:bg-muted/20 text-xs flex items-center gap-1.5"
                >
                  <Building2 className="w-4 h-4" />
                  Add Supplier
                </button>
                <button
                  onClick={() => {
                    setPoForm({
                      supplierId: suppliersData?.items[0]?.id ?? '',
                      locationId: '',
                      expectedDeliveryDate: '',
                      currency: 'USD',
                      notes: '',
                      lineItems: [{ productVariantId: '', quantity: 1, unitCost: 0, taxRatePct: 0 }],
                    });
                    setFormError(null);
                    setCreatePoModalOpen(true);
                  }}
                  className="btn flex items-center gap-2 shadow-sm text-xs"
                >
                  <Plus className="w-4 h-4" />
                  Create Purchase Order
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-border gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" />
            Purchase Orders
            {posData?.meta.total ? (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                {posData.meta.total}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'receipts'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Goods Receipts (GRN)
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'suppliers'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Suppliers & Vendors
            {suppliersData?.meta.total ? (
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                {suppliersData.meta.total}
              </span>
            ) : null}
          </button>
        </div>

        {/* TAB 1: PURCHASE ORDERS */}
        {activeTab === 'orders' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by PO number or supplier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-9 text-xs w-full"
                />
              </div>

              <select
                value={poStatusFilter}
                onChange={(e) => setPoStatusFilter(e.target.value)}
                className="input text-xs w-full sm:w-48"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="card overflow-hidden border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">PO Number</th>
                    <th className="p-3.5">Supplier</th>
                    <th className="p-3.5">Delivery Location</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Items</th>
                    <th className="p-3.5">Grand Total</th>
                    <th className="p-3.5">Order Date</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isPosLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        Loading purchase orders...
                      </td>
                    </tr>
                  ) : posData?.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No purchase orders found. Create a new purchase order to initiate stock procurement!
                      </td>
                    </tr>
                  ) : (
                    posData?.items.map((po) => (
                      <tr key={po.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3.5 font-mono font-semibold text-foreground">{po.poNumber}</td>
                        <td className="p-3.5 font-medium text-foreground">{po.supplierName}</td>
                        <td className="p-3.5 text-muted-foreground">{po.locationName}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${PO_STATUS_COLORS[po.status]}`}
                          >
                            {po.status}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-muted-foreground">{po.itemCount} lines</td>
                        <td className="p-3.5 font-mono font-semibold text-foreground">
                          ${po.grandTotal.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-muted-foreground">
                          {new Date(po.orderDate).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openViewPoModal(po.id)}
                              className="p-1 hover:bg-muted/40 rounded text-muted-foreground hover:text-foreground"
                              title="View PO Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {canApprove && (po.status === 'DRAFT' || po.status === 'SUBMITTED') && (
                              <button
                                onClick={() => approveMutation.mutate(po.id)}
                                className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[11px] font-medium"
                              >
                                Approve
                              </button>
                            )}

                            {canReceive && (po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && (
                              <button
                                onClick={() => openReceiveModal(po)}
                                className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-semibold flex items-center gap-1"
                              >
                                <PackageCheck className="w-3 h-3" />
                                Receive Goods
                              </button>
                            )}

                            {canWrite && po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && (
                              <button
                                onClick={() => {
                                  if (confirm(`Cancel purchase order ${po.poNumber}?`)) {
                                    cancelMutation.mutate(po.id);
                                  }
                                }}
                                className="p-1 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-400"
                                title="Cancel Order"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: GOODS RECEIPTS (GRN) */}
        {activeTab === 'receipts' && (
          <div className="card overflow-hidden border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">GRN Number</th>
                  <th className="p-3.5">Related PO</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5">Receiving Location</th>
                  <th className="p-3.5">Received Date</th>
                  <th className="p-3.5">Received Items</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isReceiptsLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Loading goods receipt notes...
                    </td>
                  </tr>
                ) : receiptsData?.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No inbound shipments recorded yet. Receive an approved purchase order to generate a GRN.
                    </td>
                  </tr>
                ) : (
                  receiptsData?.items.map((grn) => (
                    <tr key={grn.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-foreground">{grn.grnNumber}</td>
                      <td className="p-3.5 font-mono text-muted-foreground">{grn.poNumber}</td>
                      <td className="p-3.5 font-medium text-foreground">{grn.supplierName}</td>
                      <td className="p-3.5 text-muted-foreground">{grn.locationName}</td>
                      <td className="p-3.5 text-muted-foreground">
                        {new Date(grn.receivedDate).toLocaleDateString()}
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-col gap-0.5">
                          {grn.lineItems.map((l, i) => (
                            <span key={i} className="text-muted-foreground">
                              {l.productName} ({l.sku}):{' '}
                              <strong className="text-emerald-400">+{l.quantityReceived}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          COMPLETED
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: SUPPLIERS */}
        {activeTab === 'suppliers' && (
          <div className="card overflow-hidden border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Supplier Name</th>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Contact Person</th>
                  <th className="p-3.5">Email / Phone</th>
                  <th className="p-3.5">Payment Terms</th>
                  <th className="p-3.5">Orders</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isSuppliersLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Loading suppliers...
                    </td>
                  </tr>
                ) : suppliersData?.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No suppliers registered yet. Click &quot;Add Supplier&quot; to register your first vendor!
                    </td>
                  </tr>
                ) : (
                  suppliersData?.items.map((sup) => (
                    <tr key={sup.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3.5 font-medium text-foreground">{sup.name}</td>
                      <td className="p-3.5 font-mono text-muted-foreground">{sup.code ?? '—'}</td>
                      <td className="p-3.5 text-muted-foreground">{sup.contactPerson ?? '—'}</td>
                      <td className="p-3.5 text-muted-foreground">
                        {sup.email || sup.phone ? (
                          <div>
                            {sup.email && <div>{sup.email}</div>}
                            {sup.phone && <div className="text-[11px] text-muted-foreground/70">{sup.phone}</div>}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium border border-border bg-muted/40 text-foreground">
                          {sup.paymentTerms}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-muted-foreground">
                        {sup._count?.purchaseOrders ?? 0}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            sup.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}
                        >
                          {sup.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* MODAL 1: CREATE PURCHASE ORDER */}
        {createPoModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-3xl w-full p-6 border-border shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-foreground mb-1">New Purchase Order</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Draft a supplier purchase order. Stock will increment upon shipment receipt.
              </p>

              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
                  {formError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!poForm.supplierId || !poForm.locationId) {
                    setFormError('Please select both supplier and destination location');
                    return;
                  }
                  createPoMutation.mutate(poForm);
                }}
                className="space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Supplier *</label>
                    <select
                      required
                      value={poForm.supplierId}
                      onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                      className="input w-full text-xs"
                    >
                      <option value="">Select Supplier...</option>
                      {suppliersData?.items.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code ?? 'No Code'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Destination Location *</label>
                    <select
                      required
                      value={poForm.locationId}
                      onChange={(e) => setPoForm({ ...poForm, locationId: e.target.value })}
                      className="input w-full text-xs"
                    >
                      <option value="">Select Location...</option>
                      {locationsData?.items.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Expected Delivery</label>
                    <input
                      type="date"
                      value={poForm.expectedDeliveryDate ?? ''}
                      onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })}
                      className="input w-full text-xs"
                    />
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="border border-border rounded-lg p-3 bg-muted/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
                      Purchase Order Line Items
                    </h4>
                    <button
                      type="button"
                      onClick={addPoLine}
                      className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-2">
                    {poForm.lineItems.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-card p-2 rounded border border-border">
                        <div className="col-span-5">
                          <label className="block text-[10px] text-muted-foreground mb-0.5">Product Variant</label>
                          <select
                            required
                            value={line.productVariantId}
                            onChange={(e) => {
                              const variantId = e.target.value;
                              let suggestedCost = 0;
                              productsData?.items.forEach((p) => {
                                const v = p.variants.find((v) => v.id === variantId);
                                if (v) suggestedCost = v.costPrice;
                              });
                              const updated = [...poForm.lineItems];
                              updated[idx] = { ...updated[idx], productVariantId: variantId, unitCost: suggestedCost };
                              setPoForm({ ...poForm, lineItems: updated });
                            }}
                            className="input w-full text-xs"
                          >
                            <option value="">Choose item...</option>
                            {productsData?.items.map((p) => (
                              <optgroup key={p.id} label={p.name}>
                                {p.variants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {p.name} {v.name ? `(${v.name})` : ''} - SKU: {v.sku} [Cost: ${v.costPrice.toFixed(2)}]
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[10px] text-muted-foreground mb-0.5">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={line.quantity}
                            onChange={(e) => updatePoLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="input w-full text-xs font-mono"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[10px] text-muted-foreground mb-0.5">Unit Cost ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={line.unitCost}
                            onChange={(e) => updatePoLine(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                            className="input w-full text-xs font-mono"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[10px] text-muted-foreground mb-0.5">Tax %</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={line.taxRatePct}
                            onChange={(e) => updatePoLine(idx, 'taxRatePct', parseFloat(e.target.value) || 0)}
                            className="input w-full text-xs font-mono"
                          />
                        </div>

                        <div className="col-span-1 text-right pt-4">
                          <button
                            type="button"
                            onClick={() => removePoLine(idx)}
                            className="text-muted-foreground hover:text-red-400 p-1"
                            title="Remove Line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Summary */}
                  <div className="flex justify-end pt-3 border-t border-border">
                    <div className="text-right space-y-1 w-48 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal:</span>
                        <span className="font-mono">${poPreviewSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax Total:</span>
                        <span className="font-mono">${poPreviewTax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground text-sm border-t border-border pt-1">
                        <span>Grand Total:</span>
                        <span className="font-mono text-primary">${poPreviewGrandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Notes / Instructions</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Include batch inspection certificate on delivery"
                    value={poForm.notes ?? ''}
                    onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                    className="input w-full text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setCreatePoModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createPoMutation.isPending}
                    className="btn px-4 py-1.5"
                  >
                    {createPoMutation.isPending ? 'Saving PO...' : 'Create Purchase Order'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: RECEIVE GOODS (GRN) */}
        {receiveModalPo && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-2xl w-full p-6 border-border shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-400" />
                Inbound Goods Receipt (GRN)
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Record physical delivery for <strong>{receiveModalPo.poNumber}</strong> at{' '}
                <strong>{receiveModalPo.location.name}</strong>. Stock will be atomically credited to the inventory ledger.
              </p>

              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
                  {formError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  receiveMutation.mutate({ poId: receiveModalPo.id, input: receiveForm });
                }}
                className="space-y-4 text-xs"
              >
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5">Ordered</th>
                        <th className="p-2.5">Prior Received</th>
                        <th className="p-2.5">Receive Now</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {receiveModalPo.lineItems.map((l, idx) => {
                        const remaining = l.quantity - l.receivedQty;
                        const receiveLine = receiveForm.lineItems.find((r) => r.poLineItemId === l.id);
                        return (
                          <tr key={l.id}>
                            <td className="p-2.5">
                              <div className="font-semibold text-foreground">{l.productName}</div>
                              <div className="text-[11px] font-mono text-muted-foreground">{l.sku}</div>
                            </td>
                            <td className="p-2.5 font-mono text-muted-foreground">{l.quantity}</td>
                            <td className="p-2.5 font-mono text-muted-foreground">{l.receivedQty}</td>
                            <td className="p-2.5">
                              {remaining > 0 ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  required
                                  value={receiveLine?.quantityReceived ?? 0}
                                  onChange={(e) => {
                                    const qty = parseFloat(e.target.value) || 0;
                                    const updated = receiveForm.lineItems.map((item) =>
                                      item.poLineItemId === l.id ? { ...item, quantityReceived: qty } : item,
                                    );
                                    setReceiveForm({ ...receiveForm, lineItems: updated });
                                  }}
                                  className="input w-24 text-xs font-mono"
                                />
                              ) : (
                                <span className="text-emerald-400 font-semibold">Fully Received</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Receipt Notes / Delivery Slip #</label>
                  <input
                    type="text"
                    placeholder="e.g. Delivered via Flash Express, Waybill #998822"
                    value={receiveForm.notes ?? ''}
                    onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                    className="input w-full text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setReceiveModalPo(null)}
                    className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={receiveMutation.isPending}
                    className="btn px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500"
                  >
                    {receiveMutation.isPending ? 'Processing GRN...' : 'Confirm Goods Receipt & Add Stock'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: VIEW PO DETAILS */}
        {viewPoModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-2xl w-full p-6 border-border shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-border pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Purchase Order: {viewPoModal.poNumber}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    Vendor: <strong className="text-foreground">{viewPoModal.supplier.name}</strong> ·
                    Destination: <strong className="text-foreground">{viewPoModal.location.name}</strong>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded text-xs font-semibold border ${PO_STATUS_COLORS[viewPoModal.status]}`}
                >
                  {viewPoModal.status}
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5">Ordered</th>
                        <th className="p-2.5">Received</th>
                        <th className="p-2.5">Unit Cost</th>
                        <th className="p-2.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {viewPoModal.lineItems.map((l) => (
                        <tr key={l.id}>
                          <td className="p-2.5">
                            <div className="font-semibold text-foreground">{l.productName}</div>
                            <div className="text-[11px] font-mono text-muted-foreground">{l.sku}</div>
                          </td>
                          <td className="p-2.5 font-mono">{l.quantity}</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-semibold">{l.receivedQty}</td>
                          <td className="p-2.5 font-mono">${l.unitCost.toFixed(2)}</td>
                          <td className="p-2.5 font-mono text-right font-semibold">${l.lineTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <div className="text-right space-y-1 w-48 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal:</span>
                      <span className="font-mono">${viewPoModal.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax Total:</span>
                      <span className="font-mono">${viewPoModal.taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground text-sm border-t border-border pt-1">
                      <span>Grand Total:</span>
                      <span className="font-mono text-primary">${viewPoModal.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setViewPoModal(null)}
                    className="px-4 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted/30"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: ADD SUPPLIER */}
        {createSupplierModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-md w-full p-6 border-border shadow-xl">
              <h3 className="text-lg font-bold text-foreground mb-1">Register Supplier</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Add a new vendor or distributor to your enterprise registry.
              </p>

              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
                  {formError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createSupplierMutation.mutate(supplierForm);
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block font-medium text-foreground mb-1">Supplier / Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mega Distributors Co."
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="input w-full text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Supplier Code</label>
                    <input
                      type="text"
                      placeholder="e.g. SUP-001"
                      value={supplierForm.code ?? ''}
                      onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                      className="input w-full text-xs font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Payment Terms</label>
                    <select
                      value={supplierForm.paymentTerms}
                      onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value as any })}
                      className="input w-full text-xs"
                    >
                      <option value="NET_30">Net 30 Days</option>
                      <option value="NET_15">Net 15 Days</option>
                      <option value="NET_60">Net 60 Days</option>
                      <option value="COD">Cash On Delivery</option>
                      <option value="IMMEDIATE">Immediate</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={supplierForm.contactPerson ?? ''}
                      onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                      className="input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +855 12 345 678"
                      value={supplierForm.phone ?? ''}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      className="input w-full text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. sales@megadist.com"
                    value={supplierForm.email ?? ''}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="input w-full text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setCreateSupplierModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSupplierMutation.isPending}
                    className="btn px-4 py-1.5"
                  >
                    {createSupplierMutation.isPending ? 'Registering...' : 'Register Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
