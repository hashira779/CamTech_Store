import React from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import { LifeBuoy, CheckSquare, MessageSquare, LogOut, ShieldAlert } from 'lucide-react';
import { Toaster } from 'sonner';

export function SupportShell({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const tabs = [
    { name: 'Incident Queue', path: '/tickets', icon: LifeBuoy },
    { name: 'Workflows & SLAs', path: '/approvals', icon: CheckSquare },
  ];

  return (
    <div className="min-h-screen bg-card text-foreground font-sans selection:bg-info/30">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* Support Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-info/10 p-2 rounded-md text-info border border-info/20">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Support & Service Desk</h1>
              <p className="text-xs text-muted-foreground font-medium">{user.name} • Resolution Desk</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1.5 bg-card p-1 rounded-md border border-border">
            {tabs.map((tab) => {
              const active = location.pathname.startsWith(tab.path);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    active 
                      ? 'bg-muted text-info shadow-sm border border-border' 
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
          <button 
            onClick={() => { clear(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted text-foreground hover:text-foreground rounded-lg transition-colors text-xs font-bold border border-border"
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
