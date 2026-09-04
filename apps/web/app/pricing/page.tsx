'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { TableSkeletonRows } from '@/components/page-skeleton';
import {
  Coins,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  Sliders,
  DollarSign,
  TrendingDown,
  Trash2,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';
import type {
  PriceListDto,
  CreatePriceListInput,
  SetPriceListItemInput,
  CustomerType,
} from '@mystore/contracts';

export default function PricingPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manageListId, setManageListId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canWrite = hasPermission('pricing.write');

  // Create Price List Form State
  const [listForm, setListForm] = useState<CreatePriceListInput>({
    name: '',
    code: '',
    description: '',
    currency: 'USD',
    isDefault: false,
    customerType: undefined,
    isActive: true,
  });

  // Add Item Override State
  const [itemForm, setItemForm] = useState<SetPriceListItemInput>({
    productVariantId: '',
    unitPrice: 0,
    minQuantity: 1,
  });

  // Queries
  const { data: priceListsData, isLoading } = useQuery({
    queryKey: ['price-lists', customerTypeFilter, search],
    queryFn: () =>
      api.listPriceLists(token!, {
        customerType: customerTypeFilter || undefined,
        search: search || undefined,
        limit: 50,
      }),
    enabled: Boolean(token),
  });

  const { data: activePriceList, isLoading: isListDetailLoading } = useQuery({
    queryKey: ['price-list-detail', manageListId],
    queryFn: () => api.getPriceList(token!, manageListId!),
    enabled: Boolean(token) && Boolean(manageListId),
  });

  const { data: productsData } = useQuery({
    queryKey: ['pricing-products-dropdown'],
    queryFn: () => api.listProducts(token!, { limit: 100 }),
    enabled: Boolean(token) && Boolean(manageListId),
  });

  // Mutations
  const createListMutation = useMutation({
    mutationFn: (input: CreatePriceListInput) => api.createPriceList(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      setCreateModalOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create price list');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updatePriceList(token!, id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to update status');
    },
  });

  const setItemMutation = useMutation({
    mutationFn: ({ listId, input }: { listId: string; input: SetPriceListItemInput }) =>
      api.setPriceListItem(token!, listId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list-detail', manageListId] });
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      setItemForm({ productVariantId: '', unitPrice: 0, minQuantity: 1 });
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to save tier price');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      api.deletePriceListItem(token!, listId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list-detail', manageListId] });
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to remove price tier');
    },
  });

  // Metrics
  const totalLists = priceListsData?.meta.total ?? 0;
  const defaultListsCount = priceListsData?.items.filter((p) => p.isDefault).length ?? 0;
  const totalOverridesConfigured =
    priceListsData?.items.reduce((acc, p) => acc + (p.itemCount ?? 0), 0) ?? 0;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Coins className="w-6 h-6 text-primary" />
              Pricing Matrix & Tiered Price Lists
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure B2B wholesale price lists, VIP club rates, and multi-tier volume quantity breaks.
            </p>
          </div>

          {canWrite && (
            <button
              onClick={() => {
                setListForm({
                  name: '',
                  code: '',
                  description: '',
                  currency: 'USD',
                  isDefault: false,
                  customerType: undefined,
                  isActive: true,
                });
                setFormError(null);
                setCreateModalOpen(true);
              }}
              className="btn flex items-center gap-2 shadow-sm text-xs"
            >
              <Plus className="w-4 h-4" />
              New Price List
            </button>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 border-border flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Price Lists</div>
              <div className="text-2xl font-bold text-foreground mt-1">{totalLists}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Coins className="w-5 h-5" />
            </div>
          </div>

          <div className="card p-4 border-border flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Customer Type Defaults</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{defaultListsCount}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="card p-4 border-border flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Configured Price Tiers</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{totalOverridesConfigured}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search price lists by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs w-full"
            />
          </div>

          <select
            value={customerTypeFilter}
            onChange={(e) => setCustomerTypeFilter(e.target.value)}
            className="input text-xs w-full sm:w-48"
          >
            <option value="">All Customer Tiers</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="COMPANY">Company</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="GOVERNMENT">Government</option>
            <option value="NON_PROFIT">Non-Profit</option>
          </select>
        </div>

        {/* Price Lists Table */}
        <div className="card overflow-hidden border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Price List Name</th>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Customer Tier Default</th>
                <th className="p-3.5">Currency</th>
                <th className="p-3.5">Configured Tiers</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <TableSkeletonRows rows={5} cols={7} />
              ) : priceListsData?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No price lists found. Create a price list to configure custom B2B wholesale rates!
                  </td>
                </tr>
              ) : (
                priceListsData?.items.map((pl) => (
                  <tr key={pl.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-foreground">{pl.name}</div>
                      {pl.description && (
                        <div className="text-[11px] text-muted-foreground">{pl.description}</div>
                      )}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-primary">{pl.code}</td>

                    <td className="p-3.5">
                      {pl.customerType ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-border bg-muted/40 text-foreground">
                          {pl.customerType}
                          {pl.isDefault && (
                            <span className="text-[10px] font-bold text-emerald-400">(Default)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Manual Assignment Only</span>
                      )}
                    </td>

                    <td className="p-3.5 font-mono font-medium text-foreground">{pl.currency}</td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-primary/10 text-primary border border-primary/20">
                        {pl.itemCount ?? 0} variants
                      </span>
                    </td>

                    <td className="p-3.5">
                      <button
                        onClick={() =>
                          canWrite &&
                          toggleActiveMutation.mutate({ id: pl.id, isActive: !pl.isActive })
                        }
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          pl.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}
                      >
                        {pl.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>

                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setManageListId(pl.id)}
                        className="btn bg-card text-foreground border border-border hover:bg-muted/30 text-xs px-3 py-1 flex items-center gap-1.5 ml-auto"
                      >
                        <Sliders className="w-3.5 h-3.5 text-primary" />
                        Configure Tiers
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MODAL 1: CREATE PRICE LIST */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-md w-full p-6 border-border shadow-xl">
              <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                New Price List
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Define a named price list for wholesale clients, VIP members, or distributors.
              </p>

              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
                  {formError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createListMutation.mutate(listForm);
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block font-medium text-foreground mb-1">Price List Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wholesale Tier A (Gold)"
                    value={listForm.name}
                    onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
                    className="input w-full text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. WHOLESALE-A"
                      value={listForm.code}
                      onChange={(e) =>
                        setListForm({ ...listForm, code: e.target.value.toUpperCase() })
                      }
                      className="input w-full text-xs font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Currency</label>
                    <select
                      value={listForm.currency}
                      onChange={(e) => setListForm({ ...listForm, currency: e.target.value })}
                      className="input w-full text-xs"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="KHR">KHR (៛)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Default for Customer Tier</label>
                  <select
                    value={listForm.customerType ?? ''}
                    onChange={(e) =>
                      setListForm({
                        ...listForm,
                        customerType: (e.target.value as CustomerType) || undefined,
                      })
                    }
                    className="input w-full text-xs"
                  >
                    <option value="">None (Explicit Assignment Only)</option>
                    <option value="WHOLESALE">Wholesale Customers</option>
                    <option value="COMPANY">Corporate / Companies</option>
                    <option value="INDIVIDUAL">Individual Retail</option>
                    <option value="GOVERNMENT">Government Accounts</option>
                    <option value="NON_PROFIT">Non-Profit Accounts</option>
                  </select>
                </div>

                {listForm.customerType && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={listForm.isDefault}
                      onChange={(e) => setListForm({ ...listForm, isDefault: e.target.checked })}
                      className="rounded border-border"
                    />
                    <span className="text-xs text-foreground">
                      Make this the automatic default price list for{' '}
                      <strong>{listForm.customerType}</strong> customers
                    </span>
                  </label>
                )}

                <div>
                  <label className="block font-medium text-foreground mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. High-volume B2B contract pricing"
                    value={listForm.description ?? ''}
                    onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
                    className="input w-full text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createListMutation.isPending}
                    className="btn px-4 py-1.5"
                  >
                    {createListMutation.isPending ? 'Saving...' : 'Create Price List'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: MANAGE TIERS & QUANTITY BREAKS */}
        {manageListId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-3xl w-full p-6 border-border shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-border pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-primary" />
                    Tiered Pricing: {activePriceList?.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    Code: <strong>{activePriceList?.code}</strong> · Currency:{' '}
                    <strong>{activePriceList?.currency}</strong>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setManageListId(null);
                    setFormError(null);
                  }}
                  className="p-1 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
                  {formError}
                </div>
              )}

              {/* Add New Override Form */}
              {canWrite && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!itemForm.productVariantId) {
                      setFormError('Please select a product variant');
                      return;
                    }
                    setItemMutation.mutate({
                      listId: manageListId,
                      input: itemForm,
                    });
                  }}
                  className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3 mb-5"
                >
                  <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    Add Variant Price Override or Volume Quantity Break
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] text-muted-foreground mb-1">
                        Product Variant *
                      </label>
                      <select
                        required
                        value={itemForm.productVariantId}
                        onChange={(e) => {
                          const variantId = e.target.value;
                          let suggested = 0;
                          productsData?.items.forEach((p) => {
                            const v = p.variants.find((v) => v.id === variantId);
                            if (v) suggested = v.sellPrice;
                          });
                          setItemForm({
                            ...itemForm,
                            productVariantId: variantId,
                            unitPrice: suggested,
                          });
                        }}
                        className="input w-full text-xs"
                      >
                        <option value="">Select item variant...</option>
                        {productsData?.items.map((p) => (
                          <optgroup key={p.id} label={p.name}>
                            {p.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {p.name} {v.name ? `(${v.name})` : ''} — SKU: {v.sku} [Base: ${v.sellPrice.toFixed(2)}]
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-muted-foreground mb-1">
                        Min Quantity Break
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={itemForm.minQuantity}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            minQuantity: parseFloat(e.target.value) || 1,
                          })
                        }
                        className="input w-full text-xs font-mono"
                        placeholder="e.g. 1, 10, 50"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-muted-foreground mb-1">
                        Tier Price ($) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={itemForm.unitPrice}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            unitPrice: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="input w-full text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={setItemMutation.isPending}
                      className="btn px-4 py-1 text-xs"
                    >
                      {setItemMutation.isPending ? 'Saving...' : 'Save Price Tier'}
                    </button>
                  </div>
                </form>
              )}

              {/* Overrides Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3">Product / Variant</th>
                      <th className="p-3">Min Quantity</th>
                      <th className="p-3">Base Price</th>
                      <th className="p-3">Tier Unit Price</th>
                      <th className="p-3">Unit Discount</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isListDetailLoading ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          Loading tier rules...
                        </td>
                      </tr>
                    ) : activePriceList?.items?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          No price overrides or quantity breaks configured for this list yet.
                        </td>
                      </tr>
                    ) : (
                      activePriceList?.items?.map((item) => {
                        const savings = Math.max(0, item.baseSellPrice - item.unitPrice);
                        const savingsPct =
                          item.baseSellPrice > 0
                            ? Math.round((savings / item.baseSellPrice) * 100)
                            : 0;

                        return (
                          <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-foreground">{item.productName}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {item.sku} {item.variantName ? `(${item.variantName})` : ''}
                              </div>
                            </td>

                            <td className="p-3 font-mono font-medium">
                              {item.minQuantity > 1 ? (
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                                  ≥ {item.minQuantity} units
                                </span>
                              ) : (
                                <span className="text-muted-foreground">≥ 1 unit (Standard)</span>
                              )}
                            </td>

                            <td className="p-3 font-mono text-muted-foreground">
                              ${item.baseSellPrice.toFixed(2)}
                            </td>

                            <td className="p-3 font-mono font-bold text-foreground">
                              ${item.unitPrice.toFixed(2)}
                            </td>

                            <td className="p-3">
                              {savings > 0 ? (
                                <span className="text-emerald-400 font-semibold text-[11px]">
                                  -${savings.toFixed(2)} ({savingsPct}%)
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>

                            <td className="p-3 text-right">
                              {canWrite && (
                                <button
                                  onClick={() =>
                                    deleteItemMutation.mutate({
                                      listId: manageListId,
                                      itemId: item.id,
                                    })
                                  }
                                  className="p-1 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-400"
                                  title="Remove override"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4 border-t border-border mt-4">
                <button
                  type="button"
                  onClick={() => setManageListId(null)}
                  className="px-4 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted/30 text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}
