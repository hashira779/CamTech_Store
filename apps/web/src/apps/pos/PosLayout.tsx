import React from 'react';
import { useAuth } from '@/lib/auth-store';
import { useNavigate } from 'react-router-dom';
import { Store, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useRealtimeStream } from '@/lib/use-realtime-stream';
import { Toaster } from 'sonner';

export function PosLayout({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  useRealtimeStream();
  const isOnline = navigator.onLine;

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* POS Top Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400 border border-emerald-500/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">CamTech Register</h1>
            <p className="text-xs text-zinc-400 font-medium">Terminal A1 • {user.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>

          <button 
            onClick={() => { clear(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors text-sm font-medium border border-zinc-700"
          >
            <LogOut className="w-4 h-4" />
            End Shift
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
