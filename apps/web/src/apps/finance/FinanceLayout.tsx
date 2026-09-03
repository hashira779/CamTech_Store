import React from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Landmark, LogOut, FileText, PieChart } from 'lucide-react';
import { Toaster } from 'sonner';

export function FinanceLayout({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    navigate('/login');
    return null;
  }

  const tabs = [
    { name: 'General Ledger', path: '/finance', icon: FileText },
    { name: 'Taxes & Compliance', path: '/taxes', icon: PieChart },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-500/30">
      <Toaster position="top-right" richColors />
      
      {/* Finance Top Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-600 border border-emerald-500/20">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">CamTech Finance</h1>
              <p className="text-xs text-slate-500 font-medium">{user.name}</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-4 bg-slate-100/50 p-1 rounded-xl border border-slate-200">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active 
                      ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
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
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-sm font-semibold border border-slate-200 shadow-sm"
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
