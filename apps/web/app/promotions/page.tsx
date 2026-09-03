'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import {
  Tag,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Percent,
  DollarSign,
  Gift,
  TrendingDown,
  Calendar,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type {
  PromotionDto,
  CreatePromotionInput,
  PromotionType,
  PromotionScope,
} from '@mystore/contracts';

const PROMO_TYPE_BADGES: Record<
  PromotionType,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  PERCENTAGE: {
    label: '% Off',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    icon: Percent,
  },
  FIXED_AMOUNT: {
    label: '$ Fixed Off',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    icon: DollarSign,
  },
  BUY_X_GET_Y: {
    label: 'Buy X Get Y',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    icon: Gift,
  },
  ORDER_THRESHOLD: {
    label: 'Order Tier',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    icon: TrendingDown,
  },
};

export default function PromotionsPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canWrite = hasPermission('promotions.write');

  // Form state
  const [promoForm, setPromoForm] = useState<CreatePromotionInput>({
    name: '',
    code: '',
    description: '',
    type: 'PERCENTAGE',
    scope: 'ORDER',
    discountValue: 10,
    minOrderAmount: null,
    maxDiscountAmount: null,
    buyQuantity: null,
    getQuantity: null,
    startDate: '',
    endDate: '',
    usageLimit: null,
    isActive: true,
  });

  // Queries
  const { data: promotionsData, isLoading } = useQuery({
    queryKey: ['promotions', typeFilter, search],
    queryFn: () =>
      api.listPromotions(token!, {
        type: typeFilter || undefined,
        search: search || undefined,
        limit: 50,
      }),
    enabled: Boolean(token),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (input: CreatePromotionInput) => api.createPromotion(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setCreateModalOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create promotion');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updatePromotion(token!, id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to update status');
    },
  });

  // Summary Metrics
  const totalCampaigns = promotionsData?.meta.total ?? 0;
  const activeCount = promotionsData?.items.filter((p) => p.isActive).length ?? 0;
  const totalRedemptions =
    promotionsData?.items.reduce((acc, p) => acc + p.currentUses, 0) ?? 0;

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Tag className="w-6 h-6 text-primary" />
              Promotion & Discount Matrix
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure coupons, volume discounts, buy-X-get-Y deals, and order threshold incentives.
            </p>
          </div>

          {canWrite && (
            <button
              onClick={() => {
                setPromoForm({
                  name: '',
                  code: '',
                  description: '',
                  type: 'PERCENTAGE',
                  scope: 'ORDER',
                  discountValue: 10,
                  minOrderAmount: null,
                  maxDiscountAmount: null,
                  buyQuantity: null,
                  getQuantity: null,
                  startDate: '',
                  endDate: '',
                  usageLimit: null,
                  isActive: true,
                });
                setFormError(null);
                setCreateModalOpen(true);
              }}
              className="btn flex items-center gap-2 shadow-sm text-xs"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </button>
          )}
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 border-border flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Campaigns</div>
              <div className="text-2xl font-bold text-foreground mt-1">{totalCampaigns}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Tag className="w-5 h-5" />
            </div>
          </div>

          <div className="card p-4 border-border flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Active Deals</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="card p-4 border-border flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Redemptions</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{totalRedemptions}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search campaigns by name or coupon code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs w-full"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input text-xs w-full sm:w-48"
          >
            <option value="">All Promotion Types</option>
            <option value="PERCENTAGE">Percentage (% Off)</option>
            <option value="FIXED_AMOUNT">Fixed Amount ($ Off)</option>
            <option value="BUY_X_GET_Y">Buy X Get Y Free</option>
            <option value="ORDER_THRESHOLD">Order Spend Tier</option>
          </select>
        </div>

        {/* Promotions Table */}
        <div className="card overflow-hidden border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Campaign & Code</th>
                <th className="p-3.5">Type & Benefit</th>
                <th className="p-3.5">Scope</th>
                <th className="p-3.5">Threshold / Cap</th>
                <th className="p-3.5">Redemptions</th>
                <th className="p-3.5">Schedule</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading promotional campaigns...
                  </td>
                </tr>
              ) : promotionsData?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No promotions found. Create your first promotional deal to boost sales!
                  </td>
                </tr>
              ) : (
                promotionsData?.items.map((promo) => {
                  const badge = PROMO_TYPE_BADGES[promo.type];
                  const Icon = badge.icon;
                  const usagePct = promo.usageLimit
                    ? Math.min(100, Math.round((promo.currentUses / promo.usageLimit) * 100))
                    : 0;

                  return (
                    <tr key={promo.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-foreground">{promo.name}</div>
                        {promo.code ? (
                          <span className="inline-block mt-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {promo.code}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Auto-applied</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            <Icon className="w-3 h-3" />
                            {badge.label}
                          </span>
                        </div>
                        <div className="font-mono text-xs font-bold text-foreground mt-1">
                          {promo.type === 'PERCENTAGE' && `${promo.discountValue}% OFF`}
                          {promo.type === 'FIXED_AMOUNT' && `$${promo.discountValue.toFixed(2)} OFF`}
                          {promo.type === 'BUY_X_GET_Y' &&
                            `Buy ${promo.buyQuantity} Get ${promo.getQuantity} Free`}
                          {promo.type === 'ORDER_THRESHOLD' && `$${promo.discountValue.toFixed(2)} OFF`}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium border border-border bg-muted/40 text-foreground">
                          {promo.scope}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-0.5 text-muted-foreground">
                          {promo.minOrderAmount && (
                            <div>Min Spend: ${promo.minOrderAmount.toFixed(2)}</div>
                          )}
                          {promo.maxDiscountAmount && (
                            <div>Max Cap: ${promo.maxDiscountAmount.toFixed(2)}</div>
                          )}
                          {!promo.minOrderAmount && !promo.maxDiscountAmount && '—'}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-mono font-medium text-foreground">
                          {promo.currentUses} / {promo.usageLimit ? promo.usageLimit : '∞'}
                        </div>
                        {promo.usageLimit && (
                          <div className="w-24 bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-muted-foreground">
                        {promo.startDate || promo.endDate ? (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Calendar className="w-3 h-3" />
                            {promo.startDate
                              ? new Date(promo.startDate).toLocaleDateString()
                              : 'Start'}{' '}
                            —{' '}
                            {promo.endDate
                              ? new Date(promo.endDate).toLocaleDateString()
                              : 'Ongoing'}
                          </div>
                        ) : (
                          'Always Active'
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        {canWrite ? (
                          <button
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: promo.id,
                                isActive: !promo.isActive,
                              })
                            }
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                              promo.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
                            }`}
                          >
                            {promo.isActive ? 'Active' : 'Paused'}
                          </button>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              promo.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}
                          >
                            {promo.isActive ? 'Active' : 'Paused'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MODAL: CREATE CAMPAIGN */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-xl w-full p-6 border-border shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Create Promotional Campaign
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Define promotion rules, coupon codes, thresholds, and customer constraints.
              </p>

              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
                  {formError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate(promoForm);
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block font-medium text-foreground mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Summer Weekend Flash Sale 20%"
                    value={promoForm.name}
                    onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
                    className="input w-full text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-foreground mb-1">
                      Coupon Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SUMMER20 (leave blank for auto)"
                      value={promoForm.code ?? ''}
                      onChange={(e) =>
                        setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })
                      }
                      className="input w-full text-xs font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Promotion Type *</label>
                    <select
                      value={promoForm.type}
                      onChange={(e) =>
                        setPromoForm({ ...promoForm, type: e.target.value as PromotionType })
                      }
                      className="input w-full text-xs"
                    >
                      <option value="PERCENTAGE">Percentage Discount (% Off)</option>
                      <option value="FIXED_AMOUNT">Fixed Amount ($ Off)</option>
                      <option value="BUY_X_GET_Y">Buy X Get Y Free</option>
                      <option value="ORDER_THRESHOLD">Order Spend Threshold</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-foreground mb-1">
                      {promoForm.type === 'PERCENTAGE'
                        ? 'Discount Percentage (%) *'
                        : 'Discount Amount ($) *'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={promoForm.discountValue}
                      onChange={(e) =>
                        setPromoForm({
                          ...promoForm,
                          discountValue: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="input w-full text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Scope</label>
                    <select
                      value={promoForm.scope}
                      onChange={(e) =>
                        setPromoForm({ ...promoForm, scope: e.target.value as PromotionScope })
                      }
                      className="input w-full text-xs"
                    >
                      <option value="ORDER">Entire Order (Cart)</option>
                      <option value="PRODUCT">Specific Products</option>
                      <option value="CATEGORY">Specific Category</option>
                    </select>
                  </div>
                </div>

                {promoForm.type === 'BUY_X_GET_Y' && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div>
                      <label className="block font-medium text-foreground mb-1">Buy Quantity</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={promoForm.buyQuantity ?? 2}
                        onChange={(e) =>
                          setPromoForm({
                            ...promoForm,
                            buyQuantity: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        className="input w-full text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-foreground mb-1">Get Quantity Free</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={promoForm.getQuantity ?? 1}
                        onChange={(e) =>
                          setPromoForm({
                            ...promoForm,
                            getQuantity: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        className="input w-full text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-foreground mb-1">
                      Min Order Spend ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 50.00"
                      value={promoForm.minOrderAmount ?? ''}
                      onChange={(e) =>
                        setPromoForm({
                          ...promoForm,
                          minOrderAmount: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      className="input w-full text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">
                      Max Discount Cap ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 25.00"
                      value={promoForm.maxDiscountAmount ?? ''}
                      onChange={(e) =>
                        setPromoForm({
                          ...promoForm,
                          maxDiscountAmount: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      className="input w-full text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Start Date</label>
                    <input
                      type="date"
                      value={promoForm.startDate ?? ''}
                      onChange={(e) => setPromoForm({ ...promoForm, startDate: e.target.value })}
                      className="input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">End Date</label>
                    <input
                      type="date"
                      value={promoForm.endDate ?? ''}
                      onChange={(e) => setPromoForm({ ...promoForm, endDate: e.target.value })}
                      className="input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Usage Limit</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 100"
                      value={promoForm.usageLimit ?? ''}
                      onChange={(e) =>
                        setPromoForm({
                          ...promoForm,
                          usageLimit: e.target.value ? parseInt(e.target.value, 10) : null,
                        })
                      }
                      className="input w-full text-xs font-mono"
                    />
                  </div>
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
                    disabled={createMutation.isPending}
                    className="btn px-4 py-1.5"
                  >
                    {createMutation.isPending ? 'Saving...' : 'Create Campaign'}
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
