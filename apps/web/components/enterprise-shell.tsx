'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import {
  Store,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Boxes,
  Settings,
  ShieldCheck,
  LogOut,
  Bell,
  Search,
  Building2,
  Truck,
  Navigation,
  Tag,

  Coins,
  ArrowLeftRight,
  Percent,
  Award,
  FolderArchive,
  Wifi,
  WifiOff,
  BarChart3,
  Landmark,
  CheckSquare,
  Briefcase,
  FolderKanban,
  LifeBuoy,
  Code2,
  Send,
  Workflow,
  Sun,
  Moon,
  Laptop,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  PlusCircle,
  Command,
} from 'lucide-react';
import { useThemeStore } from '@/lib/theme-store';
import { CommandPalette } from '@/components/command-palette';
import { AiCopilotDrawer } from '@/components/ai-copilot-drawer';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { useExperienceStore, EXPERIENCE_CONFIGS } from '@/lib/experience-store';
import { Button } from '@/components/ui/button';


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section: string;
}

export function EnterpriseShell({ children }: { children: React.ReactNode }) {
  const { user, token, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const [isOnline, setIsOnline] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const { theme, setTheme } = useThemeStore();

  // Protect route
  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

  // Online status
  useEffect(() => {
    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Global Cmd+K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const { activeExperience } = useExperienceStore();
  const currentExpConfig = EXPERIENCE_CONFIGS[activeExperience] || EXPERIENCE_CONFIGS.EXECUTIVE;

  const allNavigation: NavItem[] = useMemo(
    () => [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Core' },
      { name: 'Analytics & Reports', href: '/reports', icon: BarChart3, section: 'Core' },
      { name: 'Sales & Orders', href: '/sales', icon: ShoppingBag, section: 'Commerce' },
      { name: 'POS Terminal', href: '/sales/new', icon: PlusCircle, section: 'Commerce' },
      { name: 'Products Catalog', href: '/products', icon: Package, section: 'Commerce' },
      { name: 'Inventory Ledger', href: '/inventory', icon: Boxes, section: 'Commerce' },
      { name: 'Stock Transfers & WMS', href: '/transfers', icon: ArrowLeftRight, section: 'Logistics' },
      { name: 'Procurement & POs', href: '/procurement', icon: Truck, section: 'Logistics' },
      { name: 'Delivery & Live Fleet', href: '/delivery', icon: Navigation, section: 'Logistics' },
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
    ],
    []
  );

  const userRoles = useMemo<string[]>(() => {
    const rawRoles = user?.roles as unknown;
    if (Array.isArray(rawRoles)) {
      return rawRoles.map((r) => String(r).toUpperCase());
    }
    if (typeof rawRoles === 'string') {
      try {
        const parsed = JSON.parse(rawRoles);
        if (Array.isArray(parsed)) return parsed.map((r) => String(r).toUpperCase());
      } catch {
        return [rawRoles.toUpperCase()];
      }
    }
    return [];
  }, [user?.roles]);

  const isSuperAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('ORG_ADMIN');

  const navigation = useMemo(() => {
    // Super Admins or Executive profile ALWAYS get complete enterprise navigation
    if (isSuperAdmin || activeExperience === 'EXECUTIVE') return allNavigation;
    const filtered = allNavigation.filter((item) => currentExpConfig?.allowedSections?.includes(item.section));
    return filtered.length > 0 ? filtered : allNavigation;
  }, [allNavigation, activeExperience, currentExpConfig, isSuperAdmin]);


  const sectionLabels: Record<string, string> = {
    Core: 'Overview & Analytics',
    Commerce: 'Commercial & Sales',
    Logistics: 'Supply Chain & Logistics',
    Customers: 'Customers & CRM',
    Pricing: 'Pricing & Fiscal',
    Enterprise: 'Enterprise Governance',
    Platform: 'Platform & Integrations',
    System: 'System Administration',
  };

  const groupedNavigation = useMemo(() => {
    const groups: { section: string; label: string; items: NavItem[] }[] = [];
    navigation.forEach((item) => {
      let group = groups.find((g) => g.section === item.section);
      if (!group) {
        group = {
          section: item.section,
          label: sectionLabels[item.section] || item.section,
          items: [],
        };
        groups.push(group);
      }
      group.items.push(item);
    });
    return groups;
  }, [navigation]);

  const activeItem = useMemo(() => {
    return (
      navigation.find(
        (item) =>
          pathname === item.href ||
          (item.href !== '/dashboard' && item.href !== '/sales' && pathname.startsWith(item.href)) ||
          (item.href === '/sales' && pathname === '/sales')
      ) || navigation[0]
    );
  }, [navigation, pathname]);

  if (!token || !user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <AiCopilotDrawer />

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-200 lg:static ${
          collapsed ? 'w-18' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 font-bold text-base tracking-tight text-foreground overflow-hidden group"
          >
            <div className="bg-primary p-2 rounded-xl text-primary-foreground shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="whitespace-nowrap font-bold tracking-tight text-sm text-foreground flex items-center gap-1.5">
                  MyStore <span className="text-primary text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">ERP</span>
                </span>
                <span className="text-[10px] text-muted-foreground truncate font-normal">Enterprise Management</span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Launch POS Terminal */}
        <div className="p-3 border-b border-border/60 shrink-0">
          <Button
            onClick={() => navigate('/pos')}
            size="sm"
            className={`w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs transition-all ${
              collapsed ? 'px-0 justify-center' : 'justify-start gap-2'
            }`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Open POS Terminal</span>}
          </Button>
        </div>

        {/* Grouped Navigation List */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
          {groupedNavigation.map((group) => (
            <div key={group.section} className="space-y-0.5">
              {!collapsed ? (
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  {group.label}
                </div>
              ) : (
                <div className="border-t border-border/40 my-2 mx-2" />
              )}
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && item.href !== '/sales' && pathname.startsWith(item.href)) ||
                  (item.href === '/sales' && pathname === '/sales');

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    title={collapsed ? item.name : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    } ${collapsed ? 'justify-center px-2' : ''}`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Context & Branch Footer */}
        <div className="p-3 border-t border-border shrink-0 bg-card">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg border border-border/80 bg-background/50 text-xs">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="truncate flex-1">
                <p className="font-semibold text-foreground truncate">
                  {isSuperAdmin ? 'Global Headquarters (Super Admin)' : 'Branch Store #1'}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Workspace</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 overflow-hidden text-left hover:opacity-80 transition-opacity cursor-pointer">
                  <Avatar className="h-8 w-8 shrink-0 border border-border">
                    <AvatarFallback className="bg-primary/20 text-primary font-semibold text-xs">
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="truncate">
                      <p className="text-xs font-medium text-foreground truncate">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    clear();
                    navigate('/login');
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!collapsed && (
              <button
                onClick={() => {
                  clear();
                  navigate('/login');
                }}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium border-l border-border/80 pl-3 ml-1">
              <span className="text-muted-foreground/70">{sectionLabels[activeItem?.section || 'Core'] || 'Enterprise'}</span>
              <span className="text-muted-foreground/30">/</span>
              <span className="text-foreground font-semibold flex items-center gap-1.5">
                {activeItem && <activeItem.icon className="w-3.5 h-3.5 text-primary" />}
                {activeItem?.name || 'Dashboard'}
              </span>
            </div>

            {/* Quick Command Palette Launcher */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-input bg-background/50 hover:bg-accent/70 text-xs text-muted-foreground hover:text-foreground transition-all w-44 sm:w-64 justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Search or Cmd+K...</span>
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] bg-muted/80 px-1.5 py-0.5 rounded border border-border">
                <span>⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Multi-Experience Workspace Switcher (Spec §151–§176) */}
            <WorkspaceSwitcher />

            {/* Online / Offline Indicator */}
            {isOnline ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}

            {/* Theme Toggle Button with Smooth Transition */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg transition-transform hover:scale-105"
                  title={`Current theme: ${theme}. Click for options.`}
                >
                  {theme === 'dark' ? (
                    <Moon className="h-4 w-4 text-blue-400" />
                  ) : theme === 'light' ? (
                    <Sun className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Laptop className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => setTheme('light')} className="flex items-center gap-2 cursor-pointer">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')} className="flex items-center gap-2 cursor-pointer">
                  <Moon className="h-4 w-4 text-blue-400" />
                  <span>Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')} className="flex items-center gap-2 cursor-pointer">
                  <Laptop className="h-4 w-4 text-muted-foreground" />
                  <span>System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Bell */}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-card" />
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
