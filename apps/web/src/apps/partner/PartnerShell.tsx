import React from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Code2, Key, Webhook, FileCode, LogOut } from 'lucide-react';
import { Toaster } from 'sonner';

export function PartnerShell({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    navigate('/login');
    return null;
  }

  const tabs = [
    { name: 'Developer Apps & Keys', path: '/developers', icon: Code2 },
    { name: 'Flow Automations', path: '/automations', icon: Webhook },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-pink-500/30">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* Partner Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-pink-500/10 p-2 rounded-xl text-pink-400 border border-pink-500/20">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Partner & Developer Hub</h1>
              <p className="text-xs text-slate-400 font-medium">{user.name} • API Integrations</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {tabs.map((tab) => {
              const active = location.pathname.startsWith(tab.path);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    active 
                      ? 'bg-slate-800 text-pink-400 shadow-sm border border-slate-700' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
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
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-xs font-bold border border-slate-700"
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
