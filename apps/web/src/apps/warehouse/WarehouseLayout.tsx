import React from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import { Boxes, Package, LogOut, ArrowRightLeft, ClipboardCheck } from 'lucide-react';
import { Toaster } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const { user, token, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: pickingOrders = [] } = useQuery({
    queryKey: ['wms-picking-badge'],
    queryFn: () => api.listPickingOrders(token!),
    enabled: Boolean(token),
    refetchInterval: 5000,
  });
  const pendingCount = pickingOrders.filter((o) => o.wmsStatus === 'PENDING_PICKING').length;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const tabs = [
    { name: 'Order Picking', path: '/wms/picking', icon: ClipboardCheck, badge: pendingCount },
    { name: 'Inventory Ledger', path: '/inventory', icon: Package },
    { name: 'Transfers & WMS', path: '/transfers', icon: ArrowRightLeft },
  ];

  return (
    <div className="min-h-screen bg-card text-foreground font-sans selection:bg-warning/30">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* WMS Top Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-warning/10 p-2 rounded-md text-warning border border-warning/20">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">WMS Console</h1>
              <p className="text-xs text-muted-foreground font-medium">{user.name} • Warehouse 1</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-4 bg-card p-1 rounded-md border border-border">
            {tabs.map((tab) => {
              const active = location.pathname.startsWith(tab.path);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active 
                      ? 'bg-muted text-warning shadow-sm border border-border' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-card'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                  {Boolean(tab.badge && tab.badge > 0) && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-warning text-foreground animate-pulse">
                      {tab.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => { clear(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted text-foreground hover:text-foreground rounded-lg transition-colors text-sm font-semibold border border-border"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
