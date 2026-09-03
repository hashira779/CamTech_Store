'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { PERMISSIONS, CUSTOMER_TYPES, type CustomerDto, type CreateCustomerInput } from '@mystore/contracts';
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
import { Input } from '@/components/ui/input';
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
  Users,
  Plus,
  Phone,
  Mail,
  Building,
  Award,
  CreditCard,
  Download,
  Eye,
  MoreHorizontal,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

export function CustomersPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null);

  const canWrite = hasPermission(PERMISSIONS.CUSTOMERS_WRITE);

  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.listCustomers(token!, { limit: 200 }),
    enabled: Boolean(token),
  });

  const customers = data?.items ?? [];

  // KPIs
  const totalAccounts = customers.length;
  const corporateAccounts = useMemo(
    () => customers.filter((c) => c.type === 'COMPANY' || c.type === 'WHOLESALE').length,
    [customers]
  );
  const totalStoreCredit = useMemo(
    () => customers.reduce((sum, c) => sum + (c.storeCredit ?? 0), 0),
    [customers]
  );
  const loyaltyMembers = useMemo(
    () => customers.filter((c) => (c.loyaltyPoints ?? 0) > 0 || c.loyaltyTier).length,
    [customers]
  );

  const columns: ColumnDef<CustomerDto>[] = useMemo(
    () => [
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border text-foreground">
            {row.getValue('code') || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Customer Name" />,
        cell: ({ row }) => {
          const cust = row.original;
          return (
            <div>
              <div className="font-medium text-foreground">{cust.name}</div>
              <span className="text-[11px] text-muted-foreground capitalize">
                {cust.type.toLowerCase()}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Account Type" />,
        cell: ({ row }) => {
          const type = row.getValue('type') as string;
          return (
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider">
              {type}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        id: 'contact',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
        cell: ({ row }) => {
          const cust = row.original;
          return (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {cust.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-muted-foreground/70" />
                  <span>{cust.phone}</span>
                </div>
              )}
              {cust.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-muted-foreground/70" />
                  <span>{cust.email}</span>
                </div>
              )}
              {!cust.phone && !cust.email && <span>—</span>}
            </div>
          );
        },
      },
      {
        accessorKey: 'loyaltyTier',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Loyalty & Points" />,
        cell: ({ row }) => {
          const tier = row.original.loyaltyTier || 'Standard';
          const points = row.original.loyaltyPoints ?? 0;
          return (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {tier}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {points} pts
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'storeCredit',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Store Credit" />,
        cell: ({ row }) => {
          const credit = row.original.storeCredit ?? 0;
          return (
            <span className={`font-mono text-xs font-semibold ${credit > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              ${credit.toFixed(2)}
            </span>
          );
        },
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const active = row.getValue('isActive') as boolean;
          return (
            <Badge variant={active ? 'success' : 'secondary'} className="text-[10px] uppercase">
              {active ? 'Active' : 'Inactive'}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const cust = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Customer Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSelectedCustomer(cust)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Customer Dossier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/loyalty')}>
                  <Award className="mr-2 h-4 w-4" />
                  Manage Loyalty & Credit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [navigate]
  );

  const exportCsv = () => {
    if (!customers.length) return;
    const headers = ['Code', 'Name', 'Type', 'Phone', 'Email', 'Tax ID', 'Tier', 'Points', 'Store Credit', 'Status'];
    const rows = customers.map((c) => [
      c.code || '',
      `"${c.name.replace(/"/g, '""')}"`,
      c.type,
      c.phone || '',
      c.email || '',
      c.taxId || '',
      c.loyaltyTier || 'Standard',
      c.loyaltyPoints ?? 0,
      c.storeCredit ?? 0,
      c.isActive ? 'ACTIVE' : 'INACTIVE',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mystore_customers_${new Date().toISOString().slice(0, 10)}.csv`);
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
          title="Customers & CRM Directory"
          description="Centralized master record of retail shoppers, wholesale accounts, loyalty points, and store credits."
          badge={
            <Badge variant="secondary" className="font-mono text-xs">
              {customers.length} Accounts
            </Badge>
          }
        >
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              New Customer
            </Button>
          )}
        </PageHeader>

        {/* 4-Column Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Registered Accounts"
            value={totalAccounts}
            icon={Users}
            iconColor="text-blue-500"
            isLoading={isLoading}
          />
          <KpiCard
            title="Corporate / Wholesale"
            value={corporateAccounts}
            icon={Building}
            iconColor="text-purple-500"
            isLoading={isLoading}
          />
          <KpiCard
            title="Loyalty Club Members"
            value={loyaltyMembers}
            icon={Award}
            iconColor="text-amber-500"
            isLoading={isLoading}
          />
          <KpiCard
            title="Total Store Credit Balance"
            value={`$${totalStoreCredit.toFixed(2)}`}
            icon={CreditCard}
            iconColor="text-emerald-500"
            isLoading={isLoading}
          />
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={customers}
          isLoading={isLoading}
          onRowClick={(row) => setSelectedCustomer(row)}
          toolbar={(table) => (
            <DataTableToolbar
              table={table}
              searchKey="name"
              searchPlaceholder="Search customer name..."
            >
              {table.getColumn('type') && (
                <DataTableFacetedFilter
                  column={table.getColumn('type')}
                  title="Account Type"
                  options={[
                    { label: 'Individual Shopper', value: 'INDIVIDUAL' },
                    { label: 'Company / Corporate', value: 'COMPANY' },
                    { label: 'Wholesale Buyer', value: 'WHOLESALE' },
                    { label: 'Government', value: 'GOVERNMENT' },
                  ]}
                />
              )}
            </DataTableToolbar>
          )}
          emptyState={
            <EmptyState
              icon={Users}
              title="No customer accounts registered"
              description="Register retail or corporate buyers to track purchase history, issue store credit, and assign custom pricing."
              actionLabel={canWrite ? 'Register Customer' : undefined}
              onAction={() => setIsCreateOpen(true)}
            />
          }
        />

        {/* Create Customer Drawer */}
        <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Register New Customer</SheetTitle>
              <SheetDescription>
                Create an individual, company, or wholesale buyer account.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              <CreateCustomerForm
                token={token}
                onSuccess={() => {
                  setIsCreateOpen(false);
                  queryClient.invalidateQueries({ queryKey: ['customers'] });
                  queryClient.invalidateQueries({ queryKey: ['dashboard-customers'] });
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Customer Dossier Drawer */}
        <Sheet open={Boolean(selectedCustomer)} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
          <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Customer Dossier</SheetTitle>
              <SheetDescription>Account information and credit ledger status</SheetDescription>
            </SheetHeader>
            {selectedCustomer && (
              <div className="space-y-6 py-4">
                <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{selectedCustomer.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Account Code: <span className="font-mono text-foreground font-semibold">{selectedCustomer.code || '—'}</span>
                    </p>
                  </div>
                  <Badge variant={selectedCustomer.isActive ? 'success' : 'secondary'}>
                    {selectedCustomer.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Account Classification</p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {selectedCustomer.type}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">VAT / Tax ID</p>
                    <p className="text-sm font-mono font-medium text-foreground mt-1">
                      {selectedCustomer.taxId || 'N/A'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Loyalty Tier</p>
                    <p className="text-sm font-bold text-primary mt-1">
                      {selectedCustomer.loyaltyTier || 'Standard Tier'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Store Credit</p>
                    <p className="text-sm font-bold font-mono text-emerald-500 mt-1">
                      ${(selectedCustomer.storeCredit ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 p-3.5 rounded-xl border border-border bg-card text-xs">
                  <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                    Direct Contact
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground">
                      Phone:{' '}
                      <span className="font-medium text-foreground font-mono">
                        {selectedCustomer.phone || 'Not provided'}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Email:{' '}
                      <span className="font-medium text-foreground">
                        {selectedCustomer.email || 'Not provided'}
                      </span>
                    </p>
                    {selectedCustomer.notes && (
                      <p className="text-muted-foreground mt-2 border-t border-border pt-2 italic">
                        "{selectedCustomer.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Navigation
                  </p>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => navigate('/loyalty')}
                  >
                    <span>View Customer Loyalty & Credit Engine</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </EnterpriseShell>
  );
}

function CreateCustomerForm({
  token,
  onSuccess,
}: {
  token: string;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit } = useForm<CreateCustomerInput>({
    defaultValues: {
      type: 'INDIVIDUAL',
      isActive: true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.createCustomer(token, values);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create customer');
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
        <label className="text-xs font-semibold text-muted-foreground uppercase">
          Full Name / Corporate Entity *
        </label>
        <Input
          className="mt-1.5"
          placeholder="e.g. Acme Corporation or John Smith"
          {...register('name', { required: true })}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase">
          Account Classification
        </label>
        <select className="input mt-1.5" {...register('type')}>
          {CUSTOMER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Phone Number
          </label>
          <Input
            className="mt-1.5 font-mono"
            placeholder="+855 12 345 678"
            {...register('phone')}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Email Address
          </label>
          <Input
            className="mt-1.5"
            type="email"
            placeholder="buyer@domain.com"
            {...register('email')}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase">
          VAT / Tax ID (Optional)
        </label>
        <Input
          className="mt-1.5 font-mono"
          placeholder="K001-9021234"
          {...register('taxId')}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase">
          Internal Notes (Optional)
        </label>
        <Input
          className="mt-1.5"
          placeholder="Account preferences, payment terms..."
          {...register('notes')}
        />
      </div>

      <div className="pt-4 border-t border-border flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Registering Customer...' : 'Create Customer Account'}
        </Button>
      </div>
    </form>
  );
}

export default CustomersPage;
