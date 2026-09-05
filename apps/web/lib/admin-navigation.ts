import type { ComponentType } from 'react';
import {
  ArrowLeftRight,
  Award,
  BarChart3,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  CheckSquare,
  Code2,
  Coins,
  FolderArchive,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Navigation,
  Package,
  Percent,
  PlusCircle,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  Users,
  Workflow,
} from 'lucide-react';

export type AdminNavigationSection =
  | 'Core'
  | 'Commerce'
  | 'Logistics'
  | 'Customers'
  | 'Pricing'
  | 'Enterprise'
  | 'Platform'
  | 'System';

export interface AdminNavigationItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  section: AdminNavigationSection;
  keywords?: string[];
}

export const ADMIN_SECTION_LABELS: Record<AdminNavigationSection, string> = {
  Core: 'Overview & Analytics',
  Commerce: 'Commercial & Sales',
  Logistics: 'Supply Chain & Logistics',
  Customers: 'Customers & CRM',
  Pricing: 'Pricing & Fiscal',
  Enterprise: 'Enterprise Governance',
  Platform: 'Platform & Integrations',
  System: 'System Administration',
};

export const ADMIN_NAVIGATION: AdminNavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Core', keywords: ['overview', 'kpi'] },
  { name: 'Analytics & Reports', href: '/reports', icon: BarChart3, section: 'Core', keywords: ['insights', 'metrics'] },
  { name: 'Sales & Orders', href: '/sales', icon: ShoppingBag, section: 'Commerce', keywords: ['receipts', 'transactions'] },
  { name: 'POS Terminal', href: '/sales/new', icon: PlusCircle, section: 'Commerce', keywords: ['checkout', 'cashier', 'new sale'] },
  { name: 'Products Catalog', href: '/products', icon: Package, section: 'Commerce', keywords: ['sku', 'items'] },
  { name: 'Inventory Ledger', href: '/inventory', icon: Boxes, section: 'Commerce', keywords: ['stock', 'adjustment'] },
  { name: 'Stock Transfers & WMS', href: '/transfers', icon: ArrowLeftRight, section: 'Logistics', keywords: ['warehouse', 'move stock'] },
  { name: 'Procurement & POs', href: '/procurement', icon: Truck, section: 'Logistics', keywords: ['purchase orders', 'suppliers'] },
  { name: 'Delivery & Live Fleet', href: '/delivery', icon: Navigation, section: 'Logistics', keywords: ['shipping', 'routes'] },
  { name: 'Driver Dispatch', href: '/driver', icon: Truck, section: 'Logistics', keywords: ['courier', 'fleet'] },
  { name: 'Locations & Branches', href: '/locations', icon: Building2, section: 'Logistics', keywords: ['stores', 'warehouses'] },
  { name: 'Customers & CRM', href: '/customers', icon: Users, section: 'Customers', keywords: ['accounts', 'contacts'] },
  { name: 'Loyalty & Credit', href: '/loyalty', icon: Award, section: 'Customers', keywords: ['rewards', 'points'] },
  { name: 'Pricing & Price Lists', href: '/pricing', icon: Coins, section: 'Pricing', keywords: ['prices', 'matrix'] },
  { name: 'Promotions & Deals', href: '/promotions', icon: Tag, section: 'Pricing', keywords: ['discounts', 'offers'] },
  { name: 'Tax Rates & Fiscal', href: '/taxes', icon: Percent, section: 'Pricing', keywords: ['vat', 'rules'] },
  { name: 'Finance & Accounts', href: '/finance', icon: Landmark, section: 'Enterprise', keywords: ['ledger', 'accounting'] },
  { name: 'Approvals Inbox', href: '/approvals', icon: CheckSquare, section: 'Enterprise', keywords: ['review', 'requests'] },
  { name: 'Fixed Assets', href: '/assets', icon: Coins, section: 'Enterprise', keywords: ['depreciation', 'equipment'] },
  { name: 'HR & Workforce', href: '/hr', icon: Briefcase, section: 'Enterprise', keywords: ['employees', 'payroll', 'leave'] },
  { name: 'Projects & Tasks', href: '/projects', icon: FolderKanban, section: 'Enterprise', keywords: ['work', 'planning'] },
  { name: 'Service Desk', href: '/tickets', icon: LifeBuoy, section: 'Platform', keywords: ['support', 'issues'] },
  { name: 'Documents & Storage', href: '/storage', icon: FolderArchive, section: 'Platform', keywords: ['files', 'archive'] },
  { name: 'Notifications & Alerts', href: '/notifications', icon: Bell, section: 'Platform', keywords: ['messages', 'inbox'] },
  { name: 'Developer & API', href: '/developers', icon: Code2, section: 'Platform', keywords: ['integrations', 'keys'] },
  { name: 'Telegram Platform', href: '/telegram', icon: Send, section: 'Platform', keywords: ['bot', 'messaging'] },
  { name: 'Flow Automations', href: '/automations', icon: Workflow, section: 'Platform', keywords: ['workflows', 'jobs'] },
  { name: 'Users & Access Control', href: '/users', icon: ShieldCheck, section: 'System', keywords: ['roles', 'permissions', 'rbac'] },
  { name: 'Settings', href: '/settings', icon: Settings, section: 'System', keywords: ['preferences', 'configuration'] },
];

export function isAdminRouteActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== '/dashboard' && href !== '/sales' && pathname.startsWith(`${href}/`))
  );
}
