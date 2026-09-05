'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Settings,
  Building,
  Save,
  CheckCircle2,
  DollarSign,
  Globe,
  Percent,
  Sliders,
  Store,
  Receipt,
} from 'lucide-react';
import type { BusinessType, UpdateOrganizationSettingsInput } from '@mystore/contracts';

const AVAILABLE_MODULES = [
  { id: 'products', name: 'Product Catalog & Master Data', desc: 'Master-variant products, barcodes, brands, and categories' },
  { id: 'customers', name: 'Customer Directory & Accounts', desc: 'Individual, wholesale, corporate accounts with credit terms' },
  { id: 'sales', name: 'Sales Ledger & Cashier Sessions', desc: 'Multi-channel transaction recording and cashier reconciliation' },
  { id: 'inventory', name: 'Inventory Ledger & Stock Levels', desc: 'Stock on hand, adjustments, valuation, and low-stock alerts' },
  { id: 'locations', name: 'Locations & Multi-level Hierarchy', desc: 'Companies, regional divisions, branches, warehouses, and POS terminals' },
  { id: 'procurement', name: 'Procurement & Purchase Orders', desc: 'Vendor management, purchase requests, RFQs, and 3-way matching' },
  { id: 'loyalty', name: 'Loyalty Rewards & Member Tiers', desc: 'Customer points accumulation, cashback, and birthday vouchers' },
  { id: 'ai_assistant', name: 'Autonomous AI Business Agents', desc: 'Natural language queries, sales insights, and automated replenishment' },
];

export default function SettingsPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UpdateOrganizationSettingsInput>({
    currency: 'USD',
    timezone: 'UTC',
    taxRatePct: 10,
    businessType: 'RETAIL',
    enabledModules: ['products', 'customers', 'sales', 'inventory', 'locations'],
    receiptHeader: '',
    receiptFooter: '',
  });

  const canWrite = hasPermission('organizations.write');

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.getCurrentOrg(token!),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (orgData) {
      setFormData({
        currency: orgData.currency,
        timezone: orgData.timezone,
        taxRatePct: orgData.taxRatePct,
        businessType: orgData.businessType,
        enabledModules: orgData.settings?.enabledModules ?? ['products', 'customers', 'sales', 'inventory', 'locations'],
        receiptHeader: orgData.settings?.receiptHeader ?? '',
        receiptFooter: orgData.settings?.receiptFooter ?? '',
      });
    }
  }, [orgData]);

  const mutation = useMutation({
    mutationFn: (input: UpdateOrganizationSettingsInput) => api.updateOrgSettings(token!, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['org-settings'], updated);
      setSavedSuccess(true);
      setError(null);
      setTimeout(() => setSavedSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update settings');
    },
  });

  const handleModuleToggle = (moduleId: string) => {
    const current = formData.enabledModules ?? [];
    if (current.includes(moduleId)) {
      setFormData({ ...formData, enabledModules: current.filter((m) => m !== moduleId) });
    } else {
      setFormData({ ...formData, enabledModules: [...current, moduleId] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <EnterpriseShell>
      <div className="flex flex-col gap-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Settings className="w-6 h-6 text-primary" />
              Organization Settings & Configuration
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure tenant parameters, base financial policies, business type, and dynamic module feature flags.
            </p>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              Settings saved successfully!
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <div className="card p-5 border-border space-y-4">
              <Skeleton className="h-5 w-40 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            </div>
            <div className="card p-5 border-border space-y-4">
              <Skeleton className="h-5 w-48 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            {/* Organization Identity Card */}
            <div className="card p-5 border-border">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border">
                <Building className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-foreground text-sm">Tenant Identity</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-muted-foreground mb-1">Organization Name</label>
                  <div className="font-semibold text-foreground text-sm">{orgData?.name}</div>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Tenant Slug (Identifier)</label>
                  <div className="font-mono text-muted-foreground">{orgData?.slug}</div>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">System Tenant ID</label>
                  <div className="font-mono text-[11px] text-muted-foreground truncate">{orgData?.id}</div>
                </div>
              </div>
            </div>

            {/* Financial & Regional Defaults */}
            <div className="card p-5 border-border">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h2 className="font-bold text-foreground text-sm">Financial & Operational Policies</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">Base Currency *</label>
                  <select
                    disabled={!canWrite}
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="input w-full text-xs"
                  >
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="KHR">KHR (៛) - Cambodian Riel</option>
                    <option value="THB">THB (฿) - Thai Baht</option>
                    <option value="CNY">CNY (¥) - Chinese Yuan</option>
                    <option value="EUR">EUR (€) - Euro</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Timezone *</label>
                  <select
                    disabled={!canWrite}
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="input w-full text-xs"
                  >
                    <option value="Asia/Phnom_Penh">Asia/Phnom Penh (UTC+7)</option>
                    <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                    <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                    <option value="UTC">UTC (Universal)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Default VAT / Tax Rate (%) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      disabled={!canWrite}
                      value={formData.taxRatePct}
                      onChange={(e) => setFormData({ ...formData, taxRatePct: parseFloat(e.target.value) || 0 })}
                      className="input w-full text-xs pr-8 font-mono"
                    />
                    <Percent className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <label className="block font-medium text-foreground mb-1 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-primary" />
                  Primary Business Industry
                </label>
                <select
                  disabled={!canWrite}
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value as BusinessType })}
                  className="input w-full sm:w-72 text-xs"
                >
                  <option value="RETAIL">Retail Store</option>
                  <option value="WHOLESALE">Wholesale & Distribution</option>
                  <option value="SUPERMARKET">Supermarket / Grocery</option>
                  <option value="CAFE">Cafe & Coffee Shop</option>
                  <option value="RESTAURANT">Restaurant & Dining</option>
                  <option value="FUEL_STATION">Fuel Station</option>
                  <option value="PHARMACY">Pharmacy & Healthcare</option>
                  <option value="ELECTRONICS">Electronics & Mobile Store</option>
                  <option value="FASHION">Clothing & Fashion Boutique</option>
                  <option value="AUTOMOTIVE">Automotive Spare Parts</option>
                  <option value="WAREHOUSE">Warehouse Logistics Hub</option>
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Adjusts checkout flows, default units of measure, and industry-specific feature defaults.
                </p>
              </div>
            </div>

            {/* Dynamic Feature Flags / Module Toggle (Spec §76, §98) */}
            <div className="card p-5 border-border">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border">
                <Sliders className="w-4 h-4 text-purple-400" />
                <div>
                  <h2 className="font-bold text-foreground text-sm">Enterprise Feature Modules</h2>
                  <p className="text-muted-foreground text-[11px]">
                    Enable or disable platform capabilities per organization without modifying code.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVAILABLE_MODULES.map((mod) => {
                  const isChecked = (formData.enabledModules ?? []).includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border bg-card hover:bg-muted/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!canWrite}
                        checked={isChecked}
                        onChange={() => handleModuleToggle(mod.id)}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="font-semibold text-foreground block">{mod.name}</span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">{mod.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Receipt Branding */}
            <div className="card p-5 border-border">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border">
                <Receipt className="w-4 h-4 text-orange-400" />
                <h2 className="font-bold text-foreground text-sm">POS Receipt Customization</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">Receipt Header Note</label>
                  <input
                    type="text"
                    disabled={!canWrite}
                    placeholder="e.g. Welcome to Downtown Store!"
                    value={formData.receiptHeader ?? ''}
                    onChange={(e) => setFormData({ ...formData, receiptHeader: e.target.value })}
                    className="input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Receipt Footer Note</label>
                  <input
                    type="text"
                    disabled={!canWrite}
                    placeholder="e.g. Exchanges accepted within 7 days."
                    value={formData.receiptFooter ?? ''}
                    onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                    className="input w-full text-xs"
                  />
                </div>
              </div>
            </div>

            {canWrite && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="btn flex items-center gap-2 px-6 py-2.5 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  {mutation.isPending ? 'Saving Policies...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </EnterpriseShell>
  );
}
