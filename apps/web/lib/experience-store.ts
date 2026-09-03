'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ExperienceType =
  | 'EXECUTIVE'       // CEO / Super Admin Global Enterprise Command Center (Spec §155, §156)
  | 'STORE_MANAGER'   // Store Operations, cashier oversight, branch approvals (Spec §164)
  | 'POS_CASHIER'     // Dedicated Touch & Barcode POS Terminal (Spec §163)
  | 'DELIVERY_DRIVER' // Focused Mobile Delivery & COD App (Spec §160)
  | 'WAREHOUSE_WMS'   // Warehouse Pick, Pack, Ship, Receive (Spec §165)
  | 'HR_OPERATIONS'   // HR Command Center, staff, leave, payroll (Spec §166)
  | 'FINANCE_LEDGER'  // Finance, Chart of Accounts, Invoices, Tax (Spec §167)
  | 'CUSTOMER_STORE'; // Customer-Facing Commerce & Tracking (Spec §161, §189)

export interface ExperienceConfig {
  id: ExperienceType;
  title: string;
  badge: string;
  description: string;
  defaultRoute: string;
  icon: string;
  allowedSections: string[];
}

export const EXPERIENCE_CONFIGS: Record<ExperienceType, ExperienceConfig> = {
  EXECUTIVE: {
    id: 'EXECUTIVE',
    title: 'Executive Command Center',
    badge: 'CEO / Admin',
    description: 'Global enterprise control, financial KPIs, approvals, and platform governance.',
    defaultRoute: '/dashboard',
    icon: 'Crown',
    allowedSections: ['Core', 'Commerce', 'Logistics', 'Customers', 'Pricing', 'Enterprise', 'Platform', 'System'],
  },
  STORE_MANAGER: {
    id: 'STORE_MANAGER',
    title: 'Store Operations Workspace',
    badge: 'Branch Manager',
    description: 'Daily branch sales, inventory alerts, staff shifts, and branch approvals.',
    defaultRoute: '/dashboard',
    icon: 'Store',
    allowedSections: ['Core', 'Commerce', 'Logistics', 'Customers', 'Pricing'],
  },
  POS_CASHIER: {
    id: 'POS_CASHIER',
    title: 'POS Cashier Terminal',
    badge: 'Cashier Station',
    description: 'Fast barcode checkout, numpad, cart, split payments, and shift drawer.',
    defaultRoute: '/sales/new',
    icon: 'ShoppingBag',
    allowedSections: ['Commerce'],
  },
  DELIVERY_DRIVER: {
    id: 'DELIVERY_DRIVER',
    title: 'Courier & Fleet Dispatch App',
    badge: 'Delivery Driver',
    description: 'Mobile-first task queue, live navigation, customer contact, and Proof of Delivery.',
    defaultRoute: '/driver',
    icon: 'Truck',
    allowedSections: ['Logistics'],
  },
  WAREHOUSE_WMS: {
    id: 'WAREHOUSE_WMS',
    title: 'Warehouse & Logistics WMS',
    badge: 'WMS Operator',
    description: 'Bin locations, stock transfers, receiving, dispatch, and barcode scanning.',
    defaultRoute: '/transfers',
    icon: 'Boxes',
    allowedSections: ['Logistics', 'Commerce'],
  },
  HR_OPERATIONS: {
    id: 'HR_OPERATIONS',
    title: 'HR People Operations',
    badge: 'HR Command Center',
    description: 'Employee directory, attendance, leave approval workflows, and monthly payroll.',
    defaultRoute: '/hr',
    icon: 'Users',
    allowedSections: ['Enterprise'],
  },
  FINANCE_LEDGER: {
    id: 'FINANCE_LEDGER',
    title: 'Finance & Accounts Workspace',
    badge: 'Finance / CPA',
    description: 'General ledger, chart of accounts, tax liabilities, and financial statements.',
    defaultRoute: '/finance',
    icon: 'Landmark',
    allowedSections: ['Enterprise', 'Pricing'],
  },
  CUSTOMER_STORE: {
    id: 'CUSTOMER_STORE',
    title: 'Customer Commerce Storefront',
    badge: 'Public Shopping',
    description: 'Customer product catalog, shopping cart, Bakong KHQR checkout, and order tracking.',
    defaultRoute: '/shop',
    icon: 'Sparkles',
    allowedSections: [],
  },
};

interface ExperienceState {
  activeExperience: ExperienceType;
  setExperience: (exp: ExperienceType) => void;
  resolveDefaultExperience: (roles: string[]) => ExperienceType;
}

export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set, get) => ({
      activeExperience: 'EXECUTIVE',
      setExperience: (exp) => set({ activeExperience: exp }),
      resolveDefaultExperience: (roles: string[]) => {
        const r = roles.map((x) => x.toUpperCase());
        if (r.includes('SUPER_ADMIN') || r.includes('ORG_ADMIN') || r.includes('CEO')) {
          return 'EXECUTIVE';
        }
        if (r.includes('COURIER') || r.includes('DELIVERY_DRIVER') || r.includes('DRIVER')) {
          return 'DELIVERY_DRIVER';
        }
        if (r.includes('CASHIER')) {
          return 'POS_CASHIER';
        }
        if (r.includes('STOCK_CLERK') || r.includes('WAREHOUSE_STAFF')) {
          return 'WAREHOUSE_WMS';
        }
        if (r.includes('HR_MANAGER') || r.includes('HR_STAFF')) {
          return 'HR_OPERATIONS';
        }
        if (r.includes('ACCOUNTANT') || r.includes('FINANCE_DIRECTOR')) {
          return 'FINANCE_LEDGER';
        }
        if (r.includes('BRANCH_MANAGER') || r.includes('STORE_MANAGER')) {
          return 'STORE_MANAGER';
        }
        return 'EXECUTIVE';
      },
    }),
    { name: 'mystore-experience-profile' }
  )
);
