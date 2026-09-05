'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-card/95 backdrop-blur-md border-r border-border/80 transition-all duration-300 lg:static ${
          collapsed ? 'w-18' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border/80 shrink-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 font-bold text-base tracking-tight text-foreground overflow-hidden group"
          >
            <div className="bg-primary p-2 rounded-xl text-primary-foreground shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
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
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
            variant="outline"
            className={`w-full border-primary/20 bg-primary/5 hover:bg-primary/10 text-foreground font-semibold shadow-2xs transition-all ${
              collapsed ? 'px-0 justify-center' : 'justify-start gap-2.5'
            }`}
          >
            <div className="w-5 h-5 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
            {!collapsed && <span className="text-xs">Open POS Terminal</span>}
          </Button>
        </div>

        {/* Grouped Navigation List with Accordion Sections */}
        <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-2 select-none">
          {groupedNavigation.map((group) => {
            const isSectionOpen = openSections[group.section] ?? true;
            const hasActiveItem = group.items.some((item) => routeIsActive(pathname, item.href));

            return (
              <div key={group.section} className="space-y-0.5">
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(group.section)}
                    className="flex w-full items-center justify-between px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer group/sec"
                  >
                    <span className={hasActiveItem ? 'text-primary font-bold' : ''}>{group.label}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-muted-foreground/40 transition-transform duration-200 group-hover/sec:text-foreground ${
                        isSectionOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>
                ) : (
                  <div className="border-t border-border/40 my-2 mx-2" />
                )}

                {/* Section Items */}
                {(!collapsed ? isSectionOpen : true) && (
                  <div className="space-y-0.5 animate-fade-in">
                    {group.items.map((item) => {
                      const isActive = routeIsActive(pathname, item.href);

                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          title={collapsed ? item.name : undefined}
                          className={`group/item flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-primary/15 text-primary font-semibold shadow-2xs border-l-[3px] border-primary pl-2'
                              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                          } ${collapsed ? 'justify-center px-2' : ''}`}
                        >
                          <item.icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
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

        {/* User Context & Branch Footer */}
        <div className="p-3 border-t border-border/80 shrink-0 bg-card/60 backdrop-blur-sm">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2.5 p-2 rounded-xl border border-border/70 bg-muted/30 text-xs">
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div className="truncate flex-1">
                <p className="font-semibold text-foreground truncate">
                  {isSuperAdmin ? 'Global Headquarters (Admin)' : 'Branch Store #1'}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Active Location</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 overflow-hidden text-left hover:opacity-80 transition-opacity cursor-pointer">
                  <Avatar className="h-8 w-8 shrink-0 border border-border/80 shadow-2xs">
                    <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="truncate">
                      <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl border-border/80 bg-card/95 backdrop-blur-md shadow-xl">
                <DropdownMenuLabel className="text-xs">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    clear();
                    navigate('/login');
                  }}
                  className="text-destructive focus:text-destructive cursor-pointer"
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
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-w-0 overflow-hidden outline-none">
        {/* Top Header */}
        <header className="h-16 border-b border-border/80 bg-card/70 backdrop-blur-xl flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/70 text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium border-l border-border/80 pl-3 ml-1">
              <span className="text-muted-foreground/70">{SECTION_LABELS[activeItem?.section || 'Core']}</span>
              <span className="text-muted-foreground/30">/</span>
              <span className="text-foreground font-semibold flex items-center gap-1.5">
                {activeItem && <activeItem.icon className="w-3.5 h-3.5 text-primary" />}
                {activeItem?.name || 'Dashboard'}
              </span>
            </div>

            {/* Quick Command Palette Launcher */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted/70 text-xs text-muted-foreground hover:text-foreground transition-all w-44 sm:w-60 justify-between cursor-pointer shadow-2xs group"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="truncate">Search or Cmd+K...</span>
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] bg-background/80 px-1.5 py-0.5 rounded-md border border-border/80 text-muted-foreground">
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
