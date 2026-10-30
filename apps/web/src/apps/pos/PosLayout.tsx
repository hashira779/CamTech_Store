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
    <div className="min-h-screen bg-card text-foreground font-sans selection:bg-success/30">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* POS Top Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-success/10 p-2 rounded-md text-success border border-success/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">CamTech Register</h1>
            <p className="text-xs text-muted-foreground font-medium">Terminal A1 • {user.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${isOnline ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>

          <button 
            onClick={() => { clear(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted text-foreground hover:text-foreground rounded-lg transition-colors text-sm font-medium border border-border"
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
