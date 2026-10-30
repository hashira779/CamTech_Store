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
    <div className="min-h-screen bg-card text-foreground font-sans selection:bg-primary-500/30">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* Executive Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-card/90 border-b border-border shadow-md backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary-500/20 p-2.5 rounded-lg text-primary-400 border border-primary-500/30 shadow-inner">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-foreground">Executive Command Center</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                  CEO / Decision Support
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">Enterprise Health • Real-time Telemetry</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1.5 bg-card/80 p-1.5 rounded-lg border border-border">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${
                    active 
                      ? 'bg-primary-600 text-foreground shadow-md shadow-primary-600/30' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-card'
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
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border text-xs text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-warning" />
            <span className="font-semibold">{user.name}</span>
          </div>

          <button 
            onClick={() => { clear(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted text-foreground hover:text-foreground rounded-md transition-colors text-xs font-bold border border-border shadow-xs"
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
