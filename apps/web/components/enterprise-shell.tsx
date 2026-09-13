'use client';

import React, { useEffect, useState, useMemo, createContext, useContext, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, useLocation, Link, Navigate, Outlet } from 'react-router-dom';
import { PageSkeleton } from '@/components/page-skeleton';
import {
  Store,
  ShoppingBag,
  Settings,
  LogOut,
  Bell,
  Search,
  Building2,
  WifiOff,
  Sun,
  Moon,
  Laptop,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useThemeStore } from '@/lib/theme-store';
import { CommandPalette } from '@/components/command-palette';
import { AiCopilotDrawer } from '@/components/ai-copilot-drawer';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { useExperienceStore, EXPERIENCE_CONFIGS } from '@/lib/experience-store';
import { Button } from '@/components/ui/button';
import {
  NAVIGATION_ITEMS,
  SECTION_LABELS,
  routeIsActive,
  type NavigationItem,
} from '@/lib/navigation';

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

// Dynamic code-splitting prefetch cache
const ROUTE_PREFETCH_MAP: Record<string, () => Promise<any>> = {
  '/dashboard': () => import('@/app/dashboard/page'),
  '/products': () => import('@/app/products/page'),
  '/locations': () => import('@/app/locations/page'),
  '/inventory': () => import('@/app/inventory/page'),
  '/transfers': () => import('@/app/transfers/page'),
  '/pricing': () => import('@/app/pricing/page'),
  '/taxes': () => import('@/app/taxes/page'),
  '/promotions': () => import('@/app/promotions/page'),
  '/sales': () => import('@/app/sales/page'),
  '/sales/new': () => import('@/app/sales/new/page'),
  '/customers': () => import('@/app/customers/page'),
  '/loyalty': () => import('@/app/loyalty/page'),
  '/storage': () => import('@/app/storage/page'),
  '/notifications': () => import('@/app/notifications/page'),
  '/reports': () => import('@/app/reports/page'),
  '/approvals': () => import('@/app/approvals/page'),
  '/finance': () => import('@/app/finance/page'),
  '/procurement': () => import('@/app/procurement/page'),
  '/delivery': () => import('@/app/delivery/page'),
  '/driver': () => import('@/app/driver/page'),
  '/shop': () => import('@/app/shop/page'),
  '/customer': () => import('@/app/customer/page'),
  '/hr': () => import('@/app/hr/page'),
  '/projects': () => import('@/app/projects/page'),
  '/tickets': () => import('@/app/tickets/page'),
  '/assets': () => import('@/app/assets/page'),
  '/developers': () => import('@/app/developers/page'),
  '/telegram': () => import('@/app/telegram/page'),
  '/automations': () => import('@/app/automations/page'),
  '/settings': () => import('@/app/settings/page'),
  '/users': () => import('@/app/users/page'),
};

export function prefetchRoute(href: string) {
  const loader = ROUTE_PREFETCH_MAP[href];
  if (loader) {
    loader().catch(() => {});
  }
}

export const EnterpriseShellContext = createContext<boolean>(false);

export function EnterpriseShell({ children }: { children?: React.ReactNode }) {
  const isNested = useContext(EnterpriseShellContext);
  if (isNested) {
    return <>{children}</>;
  }

  const { user, token, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const [isOnline, setIsOnline] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const { theme, setTheme } = useThemeStore();

  const { data: notifStats } = useQuery({
    queryKey: ['notificationStats'],
    queryFn: () => (token ? api.getNotificationStats(token) : null),
    enabled: Boolean(token),
    refetchInterval: 15000,
  });

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

  const allNavigation = NAVIGATION_ITEMS;

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

  const groupedNavigation = useMemo(() => {
    const groups: { section: NavigationItem['section']; label: string; items: NavigationItem[] }[] = [];
    navigation.forEach((item) => {
      let group = groups.find((g) => g.section === item.section);
      if (!group) {
        group = {
          section: item.section,
          label: SECTION_LABELS[item.section],
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
          routeIsActive(pathname, item.href)
      ) || navigation[0]
    );
  }, [navigation, pathname]);

  // Collapsible section state for organized, clutter-free sidebar
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Core: true,
    Commerce: true,
    Logistics: true,
    Customers: false,
    Pricing: false,
    Enterprise: false,
    Platform: false,
    System: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Automatically expand section containing current active route
  useEffect(() => {
    if (activeItem?.section) {
      setOpenSections((prev) => ({
        ...prev,
        [activeItem.section]: true,
      }));
    }
  }, [activeItem?.section]);

  if (!token || !user) return <Navigate to="/login" replace />;

  return (
    <EnterpriseShellContext.Provider value={true}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <AiCopilotDrawer />

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-200 lg:static ${
          collapsed ? 'w-16' : 'w-60'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-border shrink-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 font-semibold text-sm text-foreground overflow-hidden"
          >
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <Store className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm leading-tight">MyStore</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Enterprise</span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Launch POS */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-border shrink-0">
            <button
              onClick={() => navigate('/pos')}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Open POS Terminal
            </button>
          </div>
        )}

        {/* ─── Navigation ─── */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1 select-none">
          {groupedNavigation.map((group) => {
            const isSectionOpen = openSections[group.section] ?? true;
            const hasActiveItem = group.items.some((item) => routeIsActive(pathname, item.href));

            return (
              <div key={group.section}>
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(group.section)}
                    className="flex w-full items-center justify-between px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span className={hasActiveItem ? 'text-primary' : ''}>{group.label}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-muted-foreground/50 transition-transform duration-150 ${
                        isSectionOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>
                ) : (
                  <div className="border-t border-border my-2 mx-1" />
                )}

                {/* Section Items */}
                {(!collapsed ? isSectionOpen : true) && (
                  <div className="space-y-px">
                    {group.items.map((item) => {
                      const isActive = routeIsActive(pathname, item.href);

                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onMouseEnter={() => prefetchRoute(item.href)}
                          onFocus={() => prefetchRoute(item.href)}
                          title={collapsed ? item.name : undefined}
                          className={`group/item flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors ${
                            isActive
                              ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-1.5'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          } ${collapsed ? 'justify-center px-2' : ''}`}
                        >
                          <item.icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-primary' : 'text-muted-foreground group-hover/item:text-foreground'
                            }`}
                          />
                          {!collapsed && <span className="truncate">{item.name}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ─── User Footer ─── */}
        <div className="p-2 border-t border-border shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2 p-2 rounded-md bg-accent/50 text-xs">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="truncate flex-1">
                <p className="font-medium text-foreground truncate text-[11px]">
                  {isSuperAdmin ? 'Headquarters' : 'Branch #1'}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 overflow-hidden text-left hover:opacity-80 transition-opacity cursor-pointer">
                  <Avatar className="h-7 w-7 shrink-0 border border-border">
                    <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
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
              <DropdownMenuContent align="end" className="w-52 rounded-lg border-border bg-card shadow-lg">
                <DropdownMenuLabel className="text-xs">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer text-xs">
                  <Settings className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    clear();
                    navigate('/login');
                  }}
                  className="text-destructive focus:text-destructive cursor-pointer text-xs"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
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
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-w-0 overflow-hidden outline-none">
        {/* Top Header */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">{SECTION_LABELS[activeItem?.section || 'Core']}</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-foreground font-medium flex items-center gap-1.5">
                {activeItem && <activeItem.icon className="w-3.5 h-3.5 text-primary" />}
                {activeItem?.name || 'Dashboard'}
              </span>
            </div>

            {/* Search */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors w-44 sm:w-56 justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Search...</span>
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 font-mono text-[10px] bg-accent px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                <span>⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Workspace Switcher */}
            <WorkspaceSwitcher />

            {/* Online/Offline */}
            {isOnline ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}

            {/* Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-md"
                  title={`Current theme: ${theme}`}
                >
                  {theme === 'dark' ? (
                    <Moon className="h-4 w-4" />
                  ) : theme === 'light' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Laptop className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => setTheme('light')} className="flex items-center gap-2 cursor-pointer text-xs">
                  <Sun className="h-3.5 w-3.5" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')} className="flex items-center gap-2 cursor-pointer text-xs">
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')} className="flex items-center gap-2 cursor-pointer text-xs">
                  <Laptop className="h-3.5 w-3.5" />
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Bell */}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors cursor-pointer"
              title={`Notifications (${notifStats?.unreadInApp || 0} unread)`}
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              {Boolean(notifStats?.unreadInApp && notifStats.unreadInApp > 0) ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {notifStats!.unreadInApp > 99 ? '99+' : notifStats!.unreadInApp}
                </span>
              ) : null}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          <div className="mx-auto max-w-7xl">
            <Suspense fallback={<PageSkeleton variant="table" />}>
              {children || <Outlet />}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
    </EnterpriseShellContext.Provider>
  );
}
