import React from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import { TrendingUp, BarChart3, LogOut, ShieldCheck, Sparkles, Building2 } from 'lucide-react';
import { Toaster } from 'sonner';

export function ExecutiveShell({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const tabs = [
    { name: 'Executive Overview', path: '/dashboard', icon: BarChart3 },
    { name: 'Financial Rollups', path: '/reports', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* Executive Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2.5 rounded-2xl text-indigo-400 border border-indigo-500/30 shadow-inner">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">Executive Command Center</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  CEO / Decision Support
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Enterprise Health • Real-time Telemetry</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    active 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
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
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">{user.name}</span>
          </div>

          <button 
            onClick={() => { clear(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors text-xs font-bold border border-slate-700 shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] mx-auto p-6">
        {children}
      </main>
    </div>
  );
}
