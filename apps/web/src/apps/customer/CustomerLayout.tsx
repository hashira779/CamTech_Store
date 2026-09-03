import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Store, User } from 'lucide-react';
import { Toaster } from 'sonner';

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { name: 'Shop', path: '/shop' },
    { name: 'My Portal', path: '/customer' },
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-rose-500/30">
      <Toaster position="top-right" richColors />
      
      {/* Customer Storefront Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-zinc-100 shadow-sm">
        <div className="flex items-center gap-8">
          <Link to="/shop" className="flex items-center gap-3">
            <div className="bg-rose-500/10 p-2 rounded-xl text-rose-600 border border-rose-500/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-zinc-900">CamTech Store</h1>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {tabs.map((tab) => {
              const active = location.pathname.startsWith(tab.path);
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`text-sm font-bold transition-colors ${
                    active 
                      ? 'text-rose-600' 
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/customer')}
            className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <User className="w-5 h-5" />
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full transition-all text-sm font-bold shadow-lg shadow-zinc-900/20"
          >
            <ShoppingCart className="w-4 h-4" />
            Cart (0)
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
      
      <footer className="bg-zinc-50 border-t border-zinc-200 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-zinc-500 text-sm">
          &copy; {new Date().getFullYear()} CamTech Store. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
