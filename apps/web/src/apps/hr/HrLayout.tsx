import React from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Users, LogOut, Briefcase, Calendar, DollarSign, Building2 } from 'lucide-react';
import { Toaster } from 'sonner';

export function HrLayout({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    navigate('/login');
    return null;
  }

  const tabs = [
    { name: 'Dashboard', path: '/dashboard', icon: Briefcase },
    { name: 'Employees', path: '/employees', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-500/30">
      <Toaster position="top-right" richColors />
      
      {/* HR Top Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-600 border border-indigo-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">CamTech HR Portal</h1>
              <p className="text-xs text-zinc-500 font-medium">{user.name}</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-4 bg-zinc-100/50 p-1 rounded-xl border border-zinc-200">
            {tabs.map((tab) => {
              const active = location.pathname.startsWith(tab.path);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active 
                      ? 'bg-white text-indigo-600 shadow-sm border border-zinc-200' 
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
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
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 rounded-lg transition-colors text-sm font-semibold border border-zinc-200 shadow-sm"
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
