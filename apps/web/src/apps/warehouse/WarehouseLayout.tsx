import React from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import { Boxes, Package, LogOut, ArrowRightLeft } from 'lucide-react';
import { Toaster } from 'sonner';

export function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const tabs = [
    { name: 'Inventory Ledger', path: '/inventory', icon: Package },
    { name: 'Transfers & WMS', path: '/transfers', icon: ArrowRightLeft },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-amber-500/30">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* WMS Top Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500 border border-amber-500/20">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">WMS Console</h1>
              <p className="text-xs text-zinc-400 font-medium">{user.name} • Warehouse 1</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-4 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {tabs.map((tab) => {
              const active = location.pathname.startsWith(tab.path);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active 
                      ? 'bg-zinc-800 text-amber-400 shadow-sm border border-zinc-700' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => { clear(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors text-sm font-semibold border border-zinc-700"
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
