export type AppId =
  | 'store'
  | 'cashier'
  | 'delivery'
  | 'warehouse'
  | 'hr'
  | 'finance'
  | 'partner'
  | 'customer'
  | 'ceo'
  | 'admin';

export interface AppRegistryItem {
  id: AppId;
  name: string;
  subdomain: string;
  defaultDomain: string;
  purpose: string;
  audience: string[];
  allowedRoles: string[];
  defaultRoute: string;
  theme: {
    primaryColor: string;
    accentColor: string;
    mode: 'dark' | 'light' | 'auto';
  };
  modules: string[];
  features: string[];
}

export interface DomainResolutionResultDto {
  appId: AppId;
  application: AppRegistryItem;
  domain: string;
  subdomain: string;
  isCustomDomain: boolean;
  resolvedRoute: string;
}

export const APP_REGISTRY: Record<AppId, AppRegistryItem> = {
  store: {
    id: 'store',
    name: 'CamTech Online Store',
    subdomain: 'store',
    defaultDomain: 'store.camtech.cam',
    purpose: 'Public customer product discovery, shopping cart, and Bakong KHQR checkout.',
    audience: ['CUSTOMER', 'PUBLIC'],
    allowedRoles: ['*'],
    defaultRoute: '/shop',
    theme: {
      primaryColor: '#0284c7', // sky-600
      accentColor: '#38bdf8',
      mode: 'dark',
    },
    modules: ['catalog', 'cart', 'checkout', 'orders', 'tracking'],
    features: ['khqr_pay', 'guest_checkout', 'category_filters'],
  },
  cashier: {
    id: 'cashier',
    name: 'POS Cashier Terminal',
    subdomain: 'cashier',
    defaultDomain: 'cashier.camtech.cam',
    purpose: 'Rapid in-store retail checkout, barcode scan, split payment, and cash drawer.',
    audience: ['CASHIER', 'RETAIL_STAFF'],
    allowedRoles: ['CASHIER', 'BRANCH_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN'],
    defaultRoute: '/sales/new',
    theme: {
      primaryColor: '#10b981', // emerald-500
      accentColor: '#34d399',
      mode: 'dark',
    },
    modules: ['pos', 'cart', 'payments', 'shift'],
    features: ['barcode_scanner', 'numpad', 'split_payment', 'offline_queue'],
  },
  delivery: {
    id: 'delivery',
    name: 'Driver & Fleet Dispatch',
    subdomain: 'delivery',
    defaultDomain: 'delivery.camtech.cam',
    purpose: 'Mobile-first courier deliveries, route map, proof of delivery, and COD.',
    audience: ['COURIER', 'DELIVERY_DRIVER', 'DISPATCHER'],
    allowedRoles: ['COURIER', 'DELIVERY_DRIVER', 'DISPATCHER', 'ORG_ADMIN', 'SUPER_ADMIN'],
    defaultRoute: '/driver',
    theme: {
      primaryColor: '#059669', // emerald-600
      accentColor: '#10b981',
      mode: 'dark',
    },
    modules: ['deliveries', 'route', 'pod', 'cod'],
    features: ['gps_telemetry', 'proof_of_delivery', 'call_customer', 'cod_settlement'],
  },
  warehouse: {
    id: 'warehouse',
    name: 'Warehouse WMS',
    subdomain: 'warehouse',
    defaultDomain: 'warehouse.camtech.cam',
    purpose: 'Warehouse execution: receiving, transfers, putaway, pick/pack/ship, and stock count.',
    audience: ['WAREHOUSE_STAFF', 'STOCK_CLERK'],
    allowedRoles: ['WAREHOUSE_STAFF', 'STOCK_CLERK', 'BRANCH_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN'],
    defaultRoute: '/transfers',
    theme: {
      primaryColor: '#f59e0b', // amber-500
      accentColor: '#fbbf24',
      mode: 'dark',
    },
    modules: ['transfers', 'inventory', 'zones', 'batches'],
    features: ['barcode_scan', 'bin_locations', 'lot_quarantine'],
  },
  hr: {
    id: 'hr',
    name: 'HR People Operations',
    subdomain: 'hr',
    defaultDomain: 'hr.camtech.cam',
    purpose: 'Employee directory, attendance, leave approval workflows, and monthly payroll.',
    audience: ['HR_MANAGER', 'PEOPLE_OPS'],
    allowedRoles: ['HR_MANAGER', 'HR_STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'],
    defaultRoute: '/hr',
    theme: {
      primaryColor: '#8b5cf6', // purple-500
      accentColor: '#a78bfa',
      mode: 'dark',
    },
    modules: ['employees', 'departments', 'leave', 'payroll'],
    features: ['leave_approvals', 'salary_runs', 'staff_roster'],
  },
  finance: {
    id: 'finance',
    name: 'Finance & Accounts',
    subdomain: 'finance',
    defaultDomain: 'finance.camtech.cam',
    purpose: 'General ledger, chart of accounts, tax liabilities, fixed assets, and reconciliation.',
    audience: ['ACCOUNTANT', 'FINANCE_DIRECTOR', 'CFO'],
    allowedRoles: ['ACCOUNTANT', 'FINANCE_DIRECTOR', 'ORG_ADMIN', 'SUPER_ADMIN'],
    defaultRoute: '/finance',
    theme: {
      primaryColor: '#0ea5e9', // sky-500
      accentColor: '#38bdf8',
      mode: 'dark',
    },
    modules: ['ledger', 'coa', 'taxes', 'assets', 'reports'],
    features: ['financial_statements', 'tax_calculation', 'journal_entries'],
  },
  partner: {
    id: 'partner',
    name: 'Partner & Developer Platform',
    subdomain: 'partner',
    defaultDomain: 'partner.camtech.cam',
    purpose: 'Developer API applications, scoped API keys, webhook feeds, and docs.',
    audience: ['DEVELOPER', 'PARTNER'],
    allowedRoles: ['DEVELOPER', 'PARTNER', 'ORG_ADMIN', 'SUPER_ADMIN'],
    defaultRoute: '/developers',
    theme: {
      primaryColor: '#ec4899', // pink-500
      accentColor: '#f472b6',
      mode: 'dark',
    },
    modules: ['apps', 'keys', 'webhooks', 'docs'],
    features: ['hmac_signing', 'key_scopes', 'webhook_logs'],
  },
  customer: {
    id: 'customer',
    name: 'Customer Portal',
    subdomain: 'customer',
    defaultDomain: 'customer.camtech.cam',
    purpose: 'Customer self-service: past orders, download invoices, track shipments, loyalty balance.',
    audience: ['CUSTOMER'],
    allowedRoles: ['*'],
    defaultRoute: '/customer',
    theme: {
      primaryColor: '#06b6d4', // cyan-500
      accentColor: '#22d3ee',
      mode: 'dark',
    },
    modules: ['orders', 'invoices', 'tracking', 'loyalty'],
    features: ['invoice_download', 'loyalty_points', 'track_shipment'],
  },
  ceo: {
    id: 'ceo',
    name: 'Executive Command Center',
    subdomain: 'ceo',
    defaultDomain: 'ceo.camtech.cam',
    purpose: 'Global executive decision support: revenue, cash, AR/AP, branch performance, AI insights.',
    audience: ['CEO', 'EXECUTIVE', 'BOARD'],
    allowedRoles: ['CEO', 'SUPER_ADMIN', 'ORG_ADMIN'],
    defaultRoute: '/dashboard',
    theme: {
      primaryColor: '#6366f1', // indigo-500
      accentColor: '#818cf8',
      mode: 'dark',
    },
    modules: ['kpis', 'drilldown', 'ai_insights', 'approvals'],
    features: ['branch_comparison', 'revenue_velocity', 'ai_copilot'],
  },
  admin: {
    id: 'admin',
    name: 'Enterprise Control Center',
    subdomain: 'admin',
    defaultDomain: 'admin.camtech.cam',
    purpose: 'Complete platform administration, tenant isolation, security, audit, and global settings.',
    audience: ['SUPER_ADMIN', 'ORG_ADMIN'],
    allowedRoles: ['SUPER_ADMIN', 'ORG_ADMIN'],
    defaultRoute: '/settings',
    theme: {
      primaryColor: '#3b82f6', // blue-500
      accentColor: '#60a5fa',
      mode: 'dark',
    },
    modules: ['organizations', 'users', 'security', 'audit', 'settings'],
    features: ['tenant_settings', 'mfa_enforcement', 'schema_audit', 'backups'],
  },
};
