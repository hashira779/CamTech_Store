import React from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import { Landmark, LogOut, FileText, PieChart } from 'lucide-react';
import { Toaster } from 'sonner';

export function FinanceLayout({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const tabs = [
    { name: 'General Ledger', path: '/finance', icon: FileText },
    { name: 'Taxes & Compliance', path: '/taxes', icon: PieChart },
  ];

  return (
    <div className="min-h-screen bg-muted text-foreground font-sans selection:bg-success/30">
      <Toaster position="top-right" richColors />
      
      {/* Finance Top Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white border-b border-border shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-success/10 p-2 rounded-md text-success border border-success/20">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">CamTech Finance</h1>
              <p className="text-xs text-muted-foreground font-medium">{user.name}</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-4 bg-muted/50 p-1 rounded-md border border-border">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active 
                      ? 'bg-white text-success shadow-sm border border-border' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-muted text-foreground hover:text-foreground rounded-lg transition-colors text-sm font-semibold border border-border shadow-sm"
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
