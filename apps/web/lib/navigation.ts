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
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  Users,
  Workflow,
} from 'lucide-react';

export type NavigationSection =
  | 'Core'
  | 'Commerce'
  | 'Logistics'
  | 'Customers'
  | 'Pricing'
  | 'Enterprise'
  | 'Platform'
  | 'System';

export interface NavigationItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  section: NavigationSection;
  keywords?: string[];
}

export const SECTION_LABELS: Record<NavigationSection, string> = {
  Core: 'Overview & analytics',
  Commerce: 'Commercial operations',
  Logistics: 'Supply chain & logistics',
  Customers: 'Customers & CRM',
  Pricing: 'Pricing & fiscal',
  Enterprise: 'Enterprise governance',
  Platform: 'Platform & integrations',
  System: 'System administration',
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Core', keywords: ['overview', 'kpi'] },
  { name: 'Analytics & Reports', href: '/reports', icon: BarChart3, section: 'Core', keywords: ['insights', 'business intelligence'] },
  { name: 'Sales & Orders', href: '/sales', icon: ShoppingBag, section: 'Commerce' },
  { name: 'POS Terminal', href: '/sales/new', icon: ShoppingBag, section: 'Commerce', keywords: ['checkout', 'register'] },
  { name: 'Product Catalog', href: '/products', icon: Package, section: 'Commerce' },
  { name: 'Inventory Ledger', href: '/inventory', icon: Boxes, section: 'Commerce' },
  { name: 'Stock Transfers & WMS', href: '/transfers', icon: ArrowLeftRight, section: 'Logistics' },
  { name: 'Procurement & POs', href: '/procurement', icon: Truck, section: 'Logistics' },
  { name: 'Delivery & Live Fleet', href: '/delivery', icon: Navigation, section: 'Logistics' },
  { name: 'Driver Dispatch', href: '/driver', icon: Truck, section: 'Logistics' },
  { name: 'Locations & Branches', href: '/locations', icon: Building2, section: 'Logistics' },
  { name: 'Customers & CRM', href: '/customers', icon: Users, section: 'Customers' },
  { name: 'Loyalty & Credit', href: '/loyalty', icon: Award, section: 'Customers' },
  { name: 'Pricing & Price Lists', href: '/pricing', icon: Coins, section: 'Pricing' },
  { name: 'Promotions & Deals', href: '/promotions', icon: Tag, section: 'Pricing' },
  { name: 'Tax Rates & Fiscal', href: '/taxes', icon: Percent, section: 'Pricing' },
  { name: 'Finance & Accounts', href: '/finance', icon: Landmark, section: 'Enterprise' },
  { name: 'Approvals Inbox', href: '/approvals', icon: CheckSquare, section: 'Enterprise' },
  { name: 'Fixed Assets', href: '/assets', icon: Coins, section: 'Enterprise' },
  { name: 'HR & Workforce', href: '/hr', icon: Briefcase, section: 'Enterprise' },
  { name: 'Projects & Tasks', href: '/projects', icon: FolderKanban, section: 'Enterprise' },
  { name: 'Service Desk', href: '/tickets', icon: LifeBuoy, section: 'Platform' },
  { name: 'Documents & Storage', href: '/storage', icon: FolderArchive, section: 'Platform' },
  { name: 'Notifications & Alerts', href: '/notifications', icon: Bell, section: 'Platform' },
  { name: 'Developer & API', href: '/developers', icon: Code2, section: 'Platform' },
  { name: 'Telegram Platform', href: '/telegram', icon: Send, section: 'Platform' },
  { name: 'Flow Automations', href: '/automations', icon: Workflow, section: 'Platform' },
  { name: 'Users & Access Control', href: '/users', icon: ShieldCheck, section: 'System' },
  { name: 'Settings', href: '/settings', icon: Settings, section: 'System' },
];

export function routeIsActive(pathname: string, href: string): boolean {
  if (href === '/sales') return pathname === href;
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
}
